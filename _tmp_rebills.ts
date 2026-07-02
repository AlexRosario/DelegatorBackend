import 'dotenv/config';
import { ingestBillsBatch } from './src/ingestion/ingestBillsBatch';
(async () => {
  console.log('starting re-ingest...');
  const r = await ingestBillsBatch({ congress: 119, maxBills: 100 });
  console.log('RE-INGEST DONE:', JSON.stringify(r));
  process.exit(0);
})().catch((e) => { console.error('RE-INGEST ERROR:', e); process.exit(1); });
