"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyMemberIngest = runDailyMemberIngest;
require("dotenv/config"); // must load before importing the congress.gov client
const ingestMembersBatch_1 = require("../ingestion/ingestMembersBatch");
const runIngestion_1 = require("../ingestion/runIngestion");
/**
 * Daily current-member roster ingest from congress.gov. Full pull each run
 * (~537 members is cheap), wrapped in an IngestionRun. Safe from cron or CLI.
 */
async function runDailyMemberIngest(opts = {}) {
    return (0, runIngestion_1.runIngestion)('daily-members', async () => {
        const result = await (0, ingestMembersBatch_1.ingestMembersBatch)({ maxPages: opts.maxPages });
        return { ...result, message: `roster processed=${result.processed} failed=${result.failed}` };
    });
}
// CLI entry: `node dist/workers/dailyMemberIngest.js` (or via npm run ingest:members).
if (require.main === module) {
    runDailyMemberIngest()
        .then((r) => {
        console.log('Daily member ingest complete', r);
        process.exit(0);
    })
        .catch((err) => {
        console.error('Daily member ingest failed', err);
        process.exit(1);
    });
}
