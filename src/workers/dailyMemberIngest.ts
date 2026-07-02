import 'dotenv/config'; // must load before importing the congress.gov client
import { ingestMembersBatch } from '../ingestion/ingestMembersBatch';
import { runIngestion } from '../ingestion/runIngestion';

/**
 * Daily current-member roster ingest from congress.gov. Full pull each run
 * (~537 members is cheap), wrapped in an IngestionRun. Safe from cron or CLI.
 */
export async function runDailyMemberIngest(opts: { maxPages?: number } = {}) {
	return runIngestion('daily-members', async () => {
		const result = await ingestMembersBatch({ maxPages: opts.maxPages });
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
