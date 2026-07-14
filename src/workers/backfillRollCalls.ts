import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../../prisma/prisma';
import { upsertRollCalls } from '../ingestion/upsertRollCalls';

/**
 * One-time backfill: extract RollCall rows from the actions JSON of bills
 * ingested before roll-call promotion existed. Idempotent — safe to re-run.
 */
export async function runRollCallBackfill() {
	const BATCH = 200;
	let cursor: string | undefined;
	let scanned = 0;
	let written = 0;

	for (;;) {
		const bills: { id: string; actions: unknown }[] = await prisma.bill.findMany({
			where: { actions: { not: Prisma.DbNull } },
			select: { id: true, actions: true },
			orderBy: { id: 'asc' },
			take: BATCH,
			...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
		});
		if (bills.length === 0) break;

		for (const bill of bills) {
			written += await upsertRollCalls(prisma, bill.id, bill.actions as any[]);
		}
		scanned += bills.length;
		cursor = bills[bills.length - 1].id;
		console.log(`[rollcall-backfill] scanned ${scanned} bills, ${written} roll calls so far`);
	}

	return { scanned, written };
}

// Standalone entrypoint: `npm run backfill:rollcalls`
if (require.main === module) {
	runRollCallBackfill()
		.then((result) => {
			console.log('[rollcall-backfill] done', result);
			process.exit(0);
		})
		.catch((err) => {
			console.error('[rollcall-backfill] failed', err);
			process.exit(1);
		});
}
