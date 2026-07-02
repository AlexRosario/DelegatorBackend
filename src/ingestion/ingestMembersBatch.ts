import { getMembers } from '../services/congressGovClient';
import { ingestMember } from './ingestMember';

const PAGE_SIZE = 250;

// Full current-member roster (~537) is cheap — one detail call each, well under
// the rate limit, so no incremental window needed. `maxPages` bounds it for
// verification slices.
export async function ingestMembersBatch(opts: { maxPages?: number } = {}) {
	let offset = 0;
	let processed = 0;
	let failed = 0;
	let pages = 0;

	while (true) {
		const page = await getMembers({ offset, limit: PAGE_SIZE, currentMember: true });
		const members = page.members ?? [];
		if (members.length === 0) break;

		for (const m of members) {
			try {
				await ingestMember(m.bioguideId);
				processed++;
			} catch (err) {
				failed++;
				console.error(`Failed to ingest member ${m.bioguideId}:`, (err as Error).message);
			}
		}

		pages++;
		if (opts.maxPages && pages >= opts.maxPages) break;
		if (!page.pagination?.next) break;
		offset += members.length;
	}

	return { processed, failed };
}
