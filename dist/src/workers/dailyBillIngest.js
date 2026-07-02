"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyBillIngest = runDailyBillIngest;
require("dotenv/config"); // must load before importing the congress.gov client
const ingestBillsBatch_1 = require("../ingestion/ingestBillsBatch");
const runIngestion_1 = require("../ingestion/runIngestion");
const CURRENT_CONGRESS = Number(process.env.CURRENT_CONGRESS ?? 119);
/** congress.gov rejects millisecond precision: YYYY-MM-DDTHH:mm:ssZ only. */
function toCongressDateTime(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
/**
 * Idempotent, incremental daily bill ingest. Pulls only bills updated since the
 * last successful run (full pull the first time). Safe to call from cron or CLI.
 */
async function runDailyBillIngest(opts = {}) {
    const congress = opts.congress ?? CURRENT_CONGRESS;
    // Congress-scoped job key so the incremental baseline is per-congress: the
    // first run for a new congress finds no prior success → full pull, and the
    // window auto-resets when the congress rolls over.
    return (0, runIngestion_1.runIngestion)(`daily-bills-${congress}`, async ({ lastSuccessAt }) => {
        const fromDateTime = lastSuccessAt ? toCongressDateTime(lastSuccessAt) : undefined;
        const result = await (0, ingestBillsBatch_1.ingestBillsBatch)({ congress, fromDateTime });
        return {
            ...result,
            message: `congress=${congress} from=${fromDateTime ?? 'full'} processed=${result.processed} failed=${result.failed}`,
        };
    });
}
// CLI entry: `node dist/workers/dailyBillIngest.js` (or via npm run ingest:bills).
if (require.main === module) {
    runDailyBillIngest()
        .then((r) => {
        console.log('Daily bill ingest complete', r);
        process.exit(0);
    })
        .catch((err) => {
        console.error('Daily bill ingest failed', err);
        process.exit(1);
    });
}
