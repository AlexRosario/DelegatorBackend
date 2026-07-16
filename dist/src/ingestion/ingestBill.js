"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestBill = ingestBill;
const prisma_1 = __importDefault(require("../../prisma/prisma"));
const congressGovClient_1 = require("../services/congressGovClient");
const upsertBill_1 = require("./upsertBill");
const upsertMember_1 = require("./upsertMember");
const upsertRollCalls_1 = require("./upsertRollCalls");
/** A missing sub-resource shouldn't sink the whole bill — degrade gracefully. */
async function safe(fn, fallback) {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
}
async function ingestBill(params) {
    const ref = {
        congress: String(params.congress),
        // List endpoint returns uppercase types ("HR", "S"); the detail/sub-resource
        // endpoints expect lowercase. Normalize once for every downstream call.
        billType: String(params.billType).toLowerCase(),
        billNumber: String(params.billNumber),
    };
    const detail = await (0, congressGovClient_1.getFullBill)(ref);
    const bill = detail.bill;
    if (!bill)
        return;
    // Enrich from sub-resources in parallel (rate-limited by the client).
    const [summaries, subjects, textVersions, actions] = await Promise.all([
        safe(() => (0, congressGovClient_1.getBillSummaries)(ref), []),
        safe(() => (0, congressGovClient_1.getBillSubjects)(ref), { legislativeSubjects: [] }),
        safe(() => (0, congressGovClient_1.getBillTextVersions)(ref), []),
        safe(() => (0, congressGovClient_1.getBillActions)(ref), []),
    ]);
    await prisma_1.default.$transaction(async (tx) => {
        // Upsert the sponsor as a Member first so the Bill FK resolves.
        const sponsor = bill.sponsors?.[0];
        if (sponsor?.bioguideId) {
            await (0, upsertMember_1.upsertMember)(tx, sponsor);
        }
        const saved = await (0, upsertBill_1.upsertBill)(tx, { bill, summaries, subjects, textVersions, actions });
        // Promote recorded votes out of the actions JSON into queryable rows.
        await (0, upsertRollCalls_1.upsertRollCalls)(tx, saved.id, actions);
        await tx.billEnrichment.upsert({
            where: { billId: saved.id },
            create: { billId: saved.id, status: 'done', attempts: 1 },
            update: { status: 'done', attempts: { increment: 1 }, lastError: null },
        });
    });
}
