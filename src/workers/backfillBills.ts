import 'dotenv/config'; // must load before importing the congress.gov client
import { ingestBillsBatch } from '../ingestion/ingestBillsBatch';

async function run() {
	for (const congress of [116, 117, 118]) {
		console.log(`Backfilling congress ${congress}`);
		await ingestBillsBatch({ congress });
	}
	process.exit(0);
}

run().catch((err) => {
	console.error('Backfill failed', err);
	process.exit(1);
});
