"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertBill = upsertBill;
const normalizeBill_1 = require("./normalizeBill");
const makeBillId_1 = require("./makeBillId");
// Caller (ingestBill) guarantees the sponsor Member exists before this runs, so
// the sponsorBioguideId foreign key resolves cleanly.
async function upsertBill(prisma, combined) {
    const normalized = (0, normalizeBill_1.normalizeBill)(combined);
    const billId = (0, makeBillId_1.makeBillId)(normalized.congress, normalized.billType, normalized.billNumber);
    return prisma.bill.upsert({
        where: { id: billId },
        create: { id: billId, ...normalized },
        update: normalized,
    });
}
