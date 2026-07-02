import { normalizeBill } from './normalizeBill';
import { makeBillId } from './makeBillId';

type CombinedBill = Parameters<typeof normalizeBill>[0];

// Caller (ingestBill) guarantees the sponsor Member exists before this runs, so
// the sponsorBioguideId foreign key resolves cleanly.
export async function upsertBill(prisma: any, combined: CombinedBill) {
	const normalized = normalizeBill(combined);
	const billId = makeBillId(normalized.congress, normalized.billType, normalized.billNumber);

	return prisma.bill.upsert({
		where: { id: billId },
		create: { id: billId, ...normalized },
		update: normalized,
	});
}
