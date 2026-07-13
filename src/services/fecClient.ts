const BASE_URL = 'https://api.open.fec.gov/v1';

// Unlike CONGRESS_GOV_API_KEY, a missing FEC key must not crash the server at
// import time — donor data is a progressive feature. Callers get a clear error
// and the route degrades to 503 until the key is configured.
function apiKey(): string {
	const key = process.env.FEC_API_KEY;
	if (!key) throw new Error('Missing FEC_API_KEY environment variable');
	return key;
}

// api.data.gov rate limit is 1,000 requests/hour — donor lookups are bursty
// (a few calls per member, cached for days), so a small in-flight cap suffices.
const MAX_CONCURRENCY = Number(process.env.FEC_CONCURRENCY ?? 2);
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Task<T> = () => Promise<T>;

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

async function fetchFec(path: string, params: Params = {}): Promise<any> {
	const query = buildQuery({ api_key: apiKey(), ...params });
	const url = `${BASE_URL}${path}?${query}`;

	return limit(async () => {
		for (let attempt = 0; ; attempt++) {
			const res = await fetch(url);

			if (res.ok) return res.json();

			const retryable = res.status === 429 || res.status >= 500;
			if (retryable && attempt < MAX_RETRIES) {
				const retryAfter = Number(res.headers.get('retry-after'));
				const waitMs =
					Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BASE_BACKOFF_MS * 2 ** attempt;
				await sleep(waitMs);
				continue;
			}

			throw new Error(`FEC API error ${res.status} for ${path}`);
		}
	});
}

/** Principal campaign committee(s) a candidate has designated. */
export async function getCandidateCommittees(candidateId: string): Promise<any[]> {
	const data = await fetchFec(`/candidate/${candidateId}/committees/`, {
		designation: 'P',
		per_page: 20,
	});
	return data.results ?? [];
}

/**
 * Itemized individual contributions to a committee, pre-aggregated by the
 * contributor's self-reported employer. Sorted by total, descending. Includes
 * junk buckets (NOT EMPLOYED / RETIRED / null) the caller must filter out.
 */
export async function getScheduleAByEmployer(committeeId: string, cycle: number, perPage = 30): Promise<any[]> {
	const data = await fetchFec(`/schedules/schedule_a/by_employer/`, {
		committee_id: committeeId,
		cycle,
		sort: '-total',
		per_page: perPage,
	});
	return data.results ?? [];
}

/**
 * Contributions from other political committees (PACs, candidate committees) —
 * Schedule A line 11C. This deliberately EXCLUDES line-12 joint-fundraising
 * transfers, which would otherwise dominate the list with the member's own
 * victory funds. schedule_a uses keyset pagination (last_indexes), not page=N.
 */
export async function getScheduleAPacReceipts(committeeId: string, cycle: number, maxPages = 5): Promise<any[]> {
	const all: any[] = [];
	let lastIndexes: Record<string, string | number> | null = null;

	for (let page = 0; page < maxPages; page++) {
		const data = await fetchFec(`/schedules/schedule_a/`, {
			committee_id: committeeId,
			two_year_transaction_period: cycle,
			line_number: 'F3-11C',
			sort: '-contribution_receipt_amount',
			per_page: 100,
			...(lastIndexes ?? {}),
		});
		const results = data.results ?? [];
		all.push(...results);

		lastIndexes = data.pagination?.last_indexes ?? null;
		if (results.length < 100 || !lastIndexes) break;
	}
	return all;
}
