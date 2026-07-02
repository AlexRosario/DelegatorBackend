"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // must load before importing the congress.gov client
const ingestBillsBatch_1 = require("../ingestion/ingestBillsBatch");
async function run() {
    for (const congress of [116, 117, 118]) {
        console.log(`Backfilling congress ${congress}`);
        await (0, ingestBillsBatch_1.ingestBillsBatch)({ congress });
    }
    process.exit(0);
}
run().catch((err) => {
    console.error('Backfill failed', err);
    process.exit(1);
});
