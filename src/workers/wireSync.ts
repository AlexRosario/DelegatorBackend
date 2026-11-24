import 'dotenv/config';
import { runIngestion } from '../ingestion/runIngestion';
import { syncWireSources } from '../wire/syncWireSources';

/** Refreshes The Wire's source list (members + curated). Safe from cron or CLI. */
export async function runWireSync() {
	return runIngestion('wire-sync', () => syncWireSources());
}

// CLI entry: `npm run wire:sync` (or wire:sync:dev).
if (require.main === module) {
	runWireSync()
		.then((r) => {
			console.log('Wire source sync complete', r);
			process.exit(0);
		})
		.catch((err) => {
			console.error('Wire source sync failed', err);
			process.exit(1);
		});
}
