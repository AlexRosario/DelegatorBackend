/**
 * Extract recorded votes from a bill's action history into RollCall rows.
 *
 * Roll calls have always ridden along inside the actions JSON blob; promoting
 * them to rows makes "bills with roll calls" a where-clause instead of a
 * client-side scan, and gives alignment features a joinable voting event.
 */

type RecordedVoteJson = {
	chamber?: string;
	rollNumber?: number | string;
	date?: string;
	url?: string;
};

type ActionJson = {
	text?: string;
	type?: string;
	actionDate?: string;
	recordedVotes?: RecordedVoteJson[];
};

export type ExtractedRollCall = {
	chamber: string;
	rollNumber: number;
	date: Date;
	question: string;
	result: string;
};

/** Dedupe on (chamber, rollNumber) — the same roll call can appear on several actions. */
export function extractRollCalls(actions: ActionJson[] | null | undefined): ExtractedRollCall[] {
	const byKey = new Map<string, ExtractedRollCall>();
	for (const action of actions ?? []) {
		for (const rv of action.recordedVotes ?? []) {
			const rollNumber = Number(rv.rollNumber);
			const chamber = rv.chamber === 'House' || rv.chamber === 'Senate' ? rv.chamber : null;
			if (!chamber || !Number.isFinite(rollNumber)) continue;

			const date = rv.date ? new Date(rv.date) : action.actionDate ? new Date(action.actionDate) : null;
			if (!date || Number.isNaN(date.getTime())) continue;

			byKey.set(`${chamber}-${rollNumber}`, {
				chamber,
				rollNumber,
				date,
				// congress.gov's recordedVotes carry no question/result of their own —
				// the owning action's text is the closest description we have.
				question: action.text ?? '',
				result: action.type ?? '',
			});
		}
	}
	return [...byKey.values()];
}

/** Idempotent write — keyed on the (billId, chamber, rollNumber) unique. */
export async function upsertRollCalls(prisma: any, billId: string, actions: ActionJson[] | null | undefined) {
	const rollCalls = extractRollCalls(actions);
	for (const rc of rollCalls) {
		await prisma.rollCall.upsert({
			where: {
				billId_chamber_rollNumber: { billId, chamber: rc.chamber, rollNumber: rc.rollNumber },
			},
			create: { billId, ...rc },
			update: { date: rc.date, question: rc.question, result: rc.result },
		});
	}
	return rollCalls.length;
}
