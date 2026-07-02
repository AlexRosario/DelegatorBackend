"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestBillsBatch = ingestBillsBatch;
const congressGovClient_1 = require("../services/congressGovClient");
const ingestBill_1 = require("./ingestBill");
const PAGE_SIZE = 250;
async function ingestBillsBatch(params) {
    let offset = 0;
    let processed = 0;
    let failed = 0;
    const reachedCap = () => params.maxBills !== undefined && processed + failed >= params.maxBills;
    while (!reachedCap()) {
        const remaining = params.maxBills !== undefined ? params.maxBills - (processed + failed) : undefined;
        const page = await (0, congressGovClient_1.getBills)({
            congress: String(params.congress),
            billType: params.billType,
            offset,
            limit: remaining !== undefined ? Math.min(PAGE_SIZE, remaining) : PAGE_SIZE,
            fromDateTime: params.fromDateTime,
        });
        const bills = page.bills ?? [];
        if (bills.length === 0)
            break;
        for (const bill of bills) {
            if (reachedCap())
                break;
            try {
                await (0, ingestBill_1.ingestBill)({
                    congress: bill.congress,
                    billType: bill.type,
                    billNumber: bill.number,
                });
                processed++;
            }
            catch (err) {
                failed++;
                console.error(`Failed to ingest ${bill.congress}-${bill.type}-${bill.number}:`, err.message);
            }
        }
        // Stop when congress.gov reports no further page.
        if (!page.pagination?.next)
            break;
        offset += bills.length;
    }
    return { processed, failed };
}
