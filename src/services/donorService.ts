import prisma from '../../prisma/prisma';
import { getFecCandidateIds } from './fecMapping';
import { getCandidateCommittees, getScheduleAByEmployer, getScheduleAPacReceipts } from './fecClient';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // donor data moves on filing deadlines, not days
const TOP_N = 10;

// by_employer junk buckets: employment-status strings, not organizations.
const EXCLUDED_EMPLOYERS = new Set([
	'NOT EMPLOYED',
	'UNEMPLOYED',
	'SELF EMPLOYED',
	'SELF-EMPLOYED',
	'SELF',
	'RETIRED',
	'NONE',
	'N/A',
	'NULL',
	'HOMEMAKER',
	'INFORMATION REQUESTED',
	'INFORMATION REQUESTED PER BEST EFFORTS',
]);

export type DonorEntry = { name: string; total: number };

export type DonorSummary = {
	bioguideId: string;
	candidateId: string;
	committee: { id: string; name: string };
	/** Two-year cycle the numbers cover, e.g. 2026 = 2025–2026. */
	cycle: number;
	/** Individual donations aggregated by self-reported employer. */
	topEmployers: DonorEntry[];
	/** PAC / committee contributions (Schedule A line 11C; excludes JFC transfers). */
	topPacs: DonorEntry[];
	fetchedAt: string;
};

/** The FEC two-year cycle a date falls in: cycles are labeled by their even year. */
function currentCycle(now = new Date()): number {
	const year = now.getFullYear();
	return year % 2 === 0 ? year : year + 1;
}

function buildTopEmployers(rows: any[]): DonorEntry[] {
	return rows
		.filter((r) => r.employer && !EXCLUDED_EMPLOYERS.has(String(r.employer).trim().toUpperCase()))
		.map((r) => ({ name: String(r.employer).trim(), total: Number(r.total) || 0 }))
		.slice(0, TOP_N);
}

function buildTopPacs(rows: any[]): DonorEntry[] {
	const totals = new Map<string, number>();
	for (const r of rows) {
		const name = r.contributor_name?.trim();
		if (!name) continue;
		totals.set(name, (totals.get(name) ?? 0) + (Number(r.contribution_receipt_amount) || 0));
	}
	return [...totals.entries()]
		.map(([name, total]) => ({ name, total }))
		.sort((a, b) => b.total - a.total)
		.slice(0, TOP_N);
}

async function fetchCycleData(committeeId: string, cycle: number) {
	const [employerRows, pacRows] = await Promise.all([
		getScheduleAByEmployer(committeeId, cycle),
		getScheduleAPacReceipts(committeeId, cycle),
	]);
	return { topEmployers: buildTopEmployers(employerRows), topPacs: buildTopPacs(pacRows) };
}

/**
 * Assemble (or serve from cache) a member's donor summary for the most recent
 * cycle with data. Returns null when the member has no FEC candidate mapping.
 */
export async function getDonorSummary(bioguideId: string, chamber?: string | null): Promise<DonorSummary | null> {
	const cached = await prisma.memberDonorCache.findUnique({ where: { bioguideId } });
	if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
		return cached.payload as unknown as DonorSummary;
	}

	const fecIds = await getFecCandidateIds(bioguideId);
	if (!fecIds) return null;

	// A member can have candidate ids from past runs for other offices — prefer
	// the one matching their current chamber (H…/S…).
	const prefix = chamber === 'House' ? 'H' : chamber === 'Senate' ? 'S' : null;
	const candidateId = (prefix && fecIds.find((id) => id.startsWith(prefix))) || fecIds[0];

	const committees = await getCandidateCommittees(candidateId);
	if (committees.length === 0) return null;

	// The committee active in the most recent cycle (members can retire a
	// committee and designate a new one).
	const committee = committees.reduce((best, c) =>
		Math.max(...(c.cycles ?? [0])) > Math.max(...(best.cycles ?? [0])) ? c : best
	);
	const committeeCycles: number[] = committee.cycles ?? [];

	// Off-cycle senators often have an empty current cycle — walk back (max two
	// cycles) to the most recent one with itemized data.
	let cycle = Math.min(currentCycle(), Math.max(...committeeCycles, currentCycle()));
	let data = await fetchCycleData(committee.committee_id, cycle);
	for (let back = 0; back < 2 && data.topEmployers.length === 0 && data.topPacs.length === 0; back++) {
		cycle -= 2;
		data = await fetchCycleData(committee.committee_id, cycle);
	}

	const summary: DonorSummary = {
		bioguideId,
		candidateId,
		committee: { id: committee.committee_id, name: committee.name },
		cycle,
		...data,
		fetchedAt: new Date().toISOString(),
	};

	await prisma.memberDonorCache.upsert({
		where: { bioguideId },
		create: { bioguideId, cycle, payload: summary as any },
		update: { cycle, payload: summary as any, fetchedAt: new Date() },
	});

	return summary;
}
