import { getMember, getMembersByLocation } from './congressGovClient';
import { normalizeMember } from '../ingestion/normalizeMember';

/**
 * Seat history ("Past District Reps"): everyone who has held a House district
 * number or a state's Senate seats, built from congress.gov per-Congress terms.
 *
 * Coverage: congress.gov member data is complete for anyone who served in or
 * after the 93rd Congress (1973). Earlier members appear only if they also
 * served after 1973, so spans that ENDED before 1973 are dropped. A span that
 * started earlier but ran into 1973+ keeps its real startYear.
 *
 * Redistricting: this is the history of the district NUMBER. Lines are redrawn
 * after every census, so a span's geography may differ from the user's.
 */

export const COVERAGE_FROM_YEAR = 1973;
export const COVERAGE_FROM_CONGRESS = 93; // 1973-1975

const STATE_CODES: Record<string, string> = {
	Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
	Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA',
	Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
	Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
	Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
	'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
	Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
	'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
	Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
	'American Samoa': 'AS', Guam: 'GU', 'Northern Mariana Islands': 'MP', 'Puerto Rico': 'PR',
	'Virgin Islands': 'VI',
};
const CODE_TO_NAME = Object.fromEntries(Object.entries(STATE_CODES).map(([n, c]) => [c, n]));

/** Accepts a full state name or a 2-letter code; returns both, or null. */
export function resolveState(input: string | null | undefined): { code: string; name: string } | null {
	if (!input) return null;
	const trimmed = input.trim();
	const code = STATE_CODES[trimmed] ?? (CODE_TO_NAME[trimmed.toUpperCase()] ? trimmed.toUpperCase() : null);
	return code ? { code, name: CODE_TO_NAME[code] } : null;
}

/**
 * Census district → congress.gov district. Census uses 0 for at-large and 98
 * for non-voting delegates (DC, territories); congress.gov lists both as 0.
 */
export function toCongressDistrict(censusDistrict: number): number {
	return censusDistrict === 98 ? 0 : censusDistrict;
}

export type Seat =
	| { chamber: 'House'; stateCode: string; stateName: string; district: number } // congress.gov numbering
	| { chamber: 'Senate'; stateCode: string; stateName: string };

export type SeatTerm = {
	member: {
		id: string;
		name: string;
		firstName: string | null;
		lastName: string | null;
		party: string;
		state: string;
		district: number | null;
		chamber: 'House' | 'Senate';
		photoURL: string;
		url: string;
	};
	chamber: 'House' | 'Senate';
	state: string;
	district: number | null;
	startYear: number;
	endYear: number | null;
	startCongress: number;
	endCongress: number;
};

function termList(terms: any): any[] {
	return Array.isArray(terms) ? terms : terms?.item ?? [];
}

function termOnSeat(t: any, seat: Seat): boolean {
	if (t.stateCode !== seat.stateCode || typeof t.congress !== 'number') return false;
	if (seat.chamber === 'Senate') return /senate/i.test(t.chamber ?? '');
	// At-large and delegate terms carry no district on congress.gov; treat as 0.
	return /house/i.test(t.chamber ?? '') && (t.district ?? 0) === seat.district;
}

/**
 * Pure: one member's congress.gov detail → their continuous spans on `seat`
 * (consecutive Congresses merged), clipped to coverage by END year only.
 */
export function spansForMember(detail: any, seat: Seat): SeatTerm[] {
	const terms = termList(detail?.terms)
		.filter((t) => termOnSeat(t, seat))
		.sort((a, b) => a.congress - b.congress);
	if (!detail?.bioguideId || terms.length === 0) return [];

	const base = normalizeMember(detail);
	const district = seat.chamber === 'House' ? seat.district : null;
	const member: SeatTerm['member'] = {
		id: detail.bioguideId,
		name: base.name,
		firstName: base.firstName,
		lastName: base.lastName,
		party: base.party,
		state: seat.stateName,
		district,
		chamber: seat.chamber, // the seat's chamber, not their latest (e.g. Schumer's House years)
		photoURL: base.photoURL,
		url: base.url,
	};

	const spans: SeatTerm[] = [];
	for (const t of terms) {
		const last = spans[spans.length - 1];
		// Senate terms are per-Congress too; a 6-year term shows as 3 consecutive Congresses.
		// Same Congress repeated (e.g. two House entries for one Congress) also merges.
		if (last && t.congress <= last.endCongress + 1) {
			last.endCongress = Math.max(last.endCongress, t.congress);
			last.endYear = t.endYear ?? null;
			continue;
		}
		spans.push({
			member,
			chamber: seat.chamber,
			state: seat.stateName,
			district,
			startYear: t.startYear,
			endYear: t.endYear ?? null,
			startCongress: t.congress,
			endCongress: t.congress,
		});
	}
	// Clip on Congress, not year: a 92nd-Congress term ends in 1973 but predates coverage.
	return spans.filter((s) => s.endYear === null || s.endCongress >= COVERAGE_FROM_CONGRESS);
}

/**
 * Pure: merge all members' spans, drop the seat's CURRENT holders, newest first.
 * A current holder's span is ongoing (no endYear), or, as a backstop, belongs to
 * one of `currentIds` and reaches the latest Congress on this seat. Exclusion is
 * per span, not per member: a current senator's earlier House years on this
 * district (e.g. Schumer, NY-9 1993-1999) still count as past holders.
 */
export function assembleSeatHistory(details: any[], seat: Seat, currentIds: Set<string>): SeatTerm[] {
	const spans = details.flatMap((d) => spansForMember(d, seat));
	const latestCongress = Math.max(0, ...spans.map((s) => s.endCongress));
	return spans
		.filter((s) => s.endYear !== null && !(currentIds.has(s.member.id) && s.endCongress === latestCongress))
		.sort((a, b) => b.endCongress - a.endCongress || b.startCongress - a.startCongress || a.member.id.localeCompare(b.member.id));
}

// ---------------------------------------------------------------------------
// Fetch + cache. History changes at most a few times a Congress; 24h is plenty.
// ---------------------------------------------------------------------------

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; details: any[] }>();
const inflight = new Map<string, Promise<any[]>>();

function seatKey(seat: Seat) {
	return seat.chamber === 'House' ? `${seat.stateCode}-H-${seat.district}` : `${seat.stateCode}-S`;
}

/** congress.gov detail records for everyone who ever held `seat`. Cached. */
async function seatHolderDetails(seat: Seat): Promise<any[]> {
	const key = seatKey(seat);
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.details;
	const running = inflight.get(key);
	if (running) return running;

	const job = (async () => {
		const listed =
			seat.chamber === 'House'
				? await getMembersByLocation(seat.stateCode, seat.district)
				: (await getMembersByLocation(seat.stateCode)).filter((m) =>
						termList(m.terms).some((t: any) => /senate/i.test(t.chamber ?? ''))
					);
		const ids = [...new Set(listed.map((m) => m.bioguideId).filter(Boolean))];
		const details = (await Promise.all(ids.map((id) => getMember(id)))).map((r) => r.member).filter(Boolean);
		cache.set(key, { at: Date.now(), details });
		return details;
	})().finally(() => inflight.delete(key));
	inflight.set(key, job);
	return job;
}

export async function getSeatHistory(seat: Seat, excludeIds: Set<string>): Promise<SeatTerm[]> {
	return assembleSeatHistory(await seatHolderDetails(seat), seat, excludeIds);
}
