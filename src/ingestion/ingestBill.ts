import prisma from '../../prisma/prisma';
import {
	getFullBill,
	getBillSummaries,
	getBillSubjects,
	getBillTextVersions,
	getBillActions,
} from '../services/congressGovClient';
import { upsertBill } from './upsertBill';
import { upsertMember } from './upsertMember';
import { upsertRollCalls } from './upsertRollCalls';

/** A missing sub-resource shouldn't sink the whole bill — degrade gracefully. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await fn();
	} catch {
		return fallback;
	}
}

export async function ingestBill(params: { congress: number; billType: string; billNumber: string }) {
	const ref = {
		congress: String(params.congress),
		// List endpoint returns uppercase types ("HR", "S"); the detail/sub-resource
		// endpoints expect lowercase. Normalize once for every downstream call.
		billType: String(params.billType).toLowerCase(),
		billNumber: String(params.billNumber),
	};

	const detail = await getFullBill(ref);
	const bill = detail.bill;
	if (!bill) return;

	// Enrich from sub-resources in parallel (rate-limited by the client).
	const [summaries, subjects, textVersions, actions] = await Promise.all([
		safe(() => getBillSummaries(ref), [] as any[]),
		safe(() => getBillSubjects(ref), { legislativeSubjects: [] as any[] }),
		safe(() => getBillTextVersions(ref), [] as any[]),
		safe(() => getBillActions(ref), [] as any[]),
	]);

	await prisma.$transaction(async (tx) => {
		// Upsert the sponsor as a Member first so the Bill FK resolves.
		const sponsor = bill.sponsors?.[0];
		if (sponsor?.bioguideId) {
			await upsertMember(tx, sponsor);
		}

		const saved = await upsertBill(tx, { bill, summaries, subjects, textVersions, actions });

		// Promote recorded votes out of the actions JSON into queryable rows.
		await upsertRollCalls(tx, saved.id, actions);

		await tx.billEnrichment.upsert({
			where: { billId: saved.id },
			create: { billId: saved.id, status: 'done', attempts: 1 },
			update: { status: 'done', attempts: { increment: 1 }, lastError: null },
		});
	});
}
