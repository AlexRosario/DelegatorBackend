const BASE_URL = 'https://api.congress.gov/v3';

if (!process.env.CONGRESS_GOV_API_KEY) {
	throw new Error('Missing CONGRESS_GOV_API_KEY environment variable');
}

const API_KEY = process.env.CONGRESS_GOV_API_KEY!;

// congress.gov allows ~5,000 requests/hour. We cap in-flight requests and back
// off on 429/5xx so a large ingest stays well under the limit and self-heals.
const MAX_CONCURRENCY = Number(process.env.CONGRESS_GOV_CONCURRENCY ?? 4);
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Task<T> = () => Promise<T>;

/** Minimal concurrency gate so we never have more than N requests in flight. */
function createLimiter(concurrency: number) {
	let active = 0;
	const queue: (() => void)[] = [];

	const release = () => {
		active--;
		queue.shift()?.();
	};

	return async function run<T>(task: Task<T>): Promise<T> {
		if (active >= concurrency) {
			await new Promise<void>((resolve) => queue.push(resolve));
		}
		active++;
		try {
			return await task();
		} finally {
			release();
		}
	};
}

const limit = createLimiter(MAX_CONCURRENCY);

type Params = Record<string, string | number | undefined>;

function buildQuery(params: Params) {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') query.append(key, String(value));
	}
	return query.toString();
}

async function fetchCongress(path: string, params: Params = {}): Promise<any> {
	const query = buildQuery({ api_key: API_KEY, format: 'json', ...params });
	const url = `${BASE_URL}${path}?${query}`;

	return limit(async () => {
		for (let attempt = 0; ; attempt++) {
			const res = await fetch(url);

			if (res.ok) return res.json();

			// Retry on rate-limit / transient server errors with exponential backoff.
			const retryable = res.status === 429 || res.status >= 500;
			if (retryable && attempt < MAX_RETRIES) {
				const retryAfter = Number(res.headers.get('retry-after'));
				const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
					? retryAfter * 1000
					: BASE_BACKOFF_MS * 2 ** attempt;
				await sleep(waitMs);
				continue;
			}

			throw new Error(`Congress API error ${res.status} for ${path}`);
		}
	});
}

// ----------------------------------------------------------------------------
// Bill list
// ----------------------------------------------------------------------------

export async function getBills(params: {
	congress?: string;
	billType?: string;
	offset?: number;
	limit?: number;
	/** ISO 8601, e.g. 2024-01-01T00:00:00Z — only bills updated on/after this. */
	fromDateTime?: string;
	toDateTime?: string;
}) {
	const path =
		`/bill` + (params.congress ? `/${params.congress}` : '') + (params.billType ? `/${params.billType}` : '');

	return fetchCongress(path, {
		offset: params.offset ?? 0,
		limit: params.limit ?? 250, // 250 is the congress.gov maximum page size
		sort: 'updateDate+desc',
		fromDateTime: params.fromDateTime,
		toDateTime: params.toDateTime,
	});
}

// ----------------------------------------------------------------------------
// Single-bill resources
// ----------------------------------------------------------------------------

export async function getFullBill(params: { congress: string; billType: string; billNumber: string }) {
	return fetchCongress(`/bill/${params.congress}/${params.billType}/${params.billNumber}`);
}

type BillRef = { congress: string; billType: string; billNumber: string };

/**
 * Fetch EVERY page of a bill sub-resource. congress.gov defaults to 20 items
 * per page — without pagination, long action histories silently lose their
 * early entries (including passage markers and recorded votes).
 */
async function fetchAllPages(path: string, extract: (data: any) => any[] | undefined): Promise<any[]> {
	const all: any[] = [];
	let offset = 0;
	for (;;) {
		const data = await fetchCongress(path, { limit: 250, offset });
		const page = extract(data) ?? [];
		all.push(...page);
		if (!data.pagination?.next || page.length === 0) break;
		offset += page.length;
	}
	return all;
}

export async function getBillSummaries(p: BillRef): Promise<any[]> {
	return fetchAllPages(`/bill/${p.congress}/${p.billType}/${p.billNumber}/summaries`, (d) => d.summaries);
}

export async function getBillSubjects(p: BillRef): Promise<{ legislativeSubjects: any[]; policyArea?: any }> {
	const path = `/bill/${p.congress}/${p.billType}/${p.billNumber}/subjects`;
	// policyArea rides on the first page; legislativeSubjects can span pages.
	const first = await fetchCongress(path, { limit: 250 });
	const legislativeSubjects = first.subjects?.legislativeSubjects ?? [];
	let offset = legislativeSubjects.length;
	let pagination = first.pagination;
	while (pagination?.next) {
		const data = await fetchCongress(path, { limit: 250, offset });
		const page = data.subjects?.legislativeSubjects ?? [];
		if (page.length === 0) break;
		legislativeSubjects.push(...page);
		offset += page.length;
		pagination = data.pagination;
	}
	return { legislativeSubjects, policyArea: first.subjects?.policyArea };
}

export async function getBillTextVersions(p: BillRef): Promise<any[]> {
	return fetchAllPages(`/bill/${p.congress}/${p.billType}/${p.billNumber}/text`, (d) => d.textVersions);
}

export async function getBillActions(p: BillRef): Promise<any[]> {
	return fetchAllPages(`/bill/${p.congress}/${p.billType}/${p.billNumber}/actions`, (d) => d.actions);
}

// ----------------------------------------------------------------------------
// Members
// ----------------------------------------------------------------------------

export async function getMembers(params: { offset?: number; limit?: number; currentMember?: boolean }) {
	return fetchCongress(`/member`, {
		offset: params.offset ?? 0,
		limit: params.limit ?? 250,
		currentMember: params.currentMember === false ? 'false' : 'true',
	});
}

export async function getMember(bioguideId: string) {
	return fetchCongress(`/member/${bioguideId}`);
}
