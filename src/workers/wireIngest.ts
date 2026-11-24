import 'dotenv/config';
import { runIngestion } from '../ingestion/runIngestion';
import { ingestWire } from '../wire/ingestWire';

/** Pulls recent posts for The Wire's accounts. Safe from cron or CLI. */
export async function runWireIngest() {
	return runIngestion('wire-ingest', () => ingestWire());
}

// CLI entry: `npm run wire:ingest` (or wire:ingest:dev).
if (require.main === module) {
	runWireIngest()
		.then((r) => {
			console.log('Wire ingest complete', r);
			process.exit(0);
		})
		.catch((err) => {
			console.error('Wire ingest failed', err);
			process.exit(1);
		});
}
