import { getBills } from '../services/congressGovClient';
import { ingestBill } from './ingestBill';

const PAGE_SIZE = 250;

export async function ingestBillsBatch(params: {
	congress: number;
	billType?: string;
	/** ISO 8601 — only ingest bills updated on/after this (incremental runs). */
	fromDateTime?: string;
	/** Cap total bills ingested (bounded test/validation runs). */
	maxBills?: number;
	/** Skip the first N bills in congress.gov's ordering (resume/extend runs). */
	startOffset?: number;
}) {
	let offset = params.startOffset ?? 0;
	let processed = 0;
	let failed = 0;

	const reachedCap = () => params.maxBills !== undefined && processed + failed >= params.maxBills;

	while (!reachedCap()) {
		const remaining = params.maxBills !== undefined ? params.maxBills - (processed + failed) : undefined;
		const page = await getBills({
			congress: String(params.congress),
			billType: params.billType,
			offset,
			limit: remaining !== undefined ? Math.min(PAGE_SIZE, remaining) : PAGE_SIZE,
			fromDateTime: params.fromDateTime,
		});

		const bills = page.bills ?? [];
		if (bills.length === 0) break;

		for (const bill of bills) {
			if (reachedCap()) break;
			try {
				await ingestBill({
					congress: bill.congress,
					billType: bill.type,
					billNumber: bill.number,
				});
				processed++;
			} catch (err) {
				failed++;
				console.error(
					`Failed to ingest ${bill.congress}-${bill.type}-${bill.number}:`,
					(err as Error).message
				);
			}
		}

		// Stop when congress.gov reports no further page.
		if (!page.pagination?.next) break;
		offset += bills.length;
	}

	return { processed, failed };
}
