"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const ingestBill_1 = require("../ingestion/ingestBill");
async function run() {
    console.log('Ingesting single bill...');
    await (0, ingestBill_1.ingestBill)({
        congress: 118,
        billType: 'hr',
        billNumber: '1',
    });
    console.log('Done');
    process.exit(0);
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
