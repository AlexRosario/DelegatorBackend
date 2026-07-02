"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIngestion = runIngestion;
const prisma_1 = __importDefault(require("../../prisma/prisma"));
/**
 * Wraps an ingestion job in an IngestionRun row: opens it "running", runs `fn`,
 * then closes it "success" (recording `fn`'s message) or "failed". Passes the
 * last successful run's start time so incremental jobs know where to resume.
 */
async function runIngestion(job, fn) {
    const lastSuccess = await prisma_1.default.ingestionRun.findFirst({
        where: { job, status: 'success' },
        orderBy: { startedAt: 'desc' },
    });
    const run = await prisma_1.default.ingestionRun.create({ data: { job, status: 'running' } });
    try {
        const result = await fn({ lastSuccessAt: lastSuccess?.startedAt ?? null });
        await prisma_1.default.ingestionRun.update({
            where: { id: run.id },
            data: { status: 'success', endedAt: new Date(), message: result.message },
        });
        return result;
    }
    catch (err) {
        await prisma_1.default.ingestionRun.update({
            where: { id: run.id },
            data: { status: 'failed', endedAt: new Date(), message: err.message },
        });
        throw err;
    }
}
