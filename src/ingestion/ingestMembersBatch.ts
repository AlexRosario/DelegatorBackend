import prisma from '../../prisma/prisma';
import { getMembers } from '../services/congressGovClient';
import { ingestMember } from './ingestMember';

const PAGE_SIZE = 250;

// A full roster is ~535 seats (435 House + 100 Senate) plus 6 non-voting
// delegates, minus vacancies. A "complete" run that lists far fewer is more
// likely a congress.gov glitch than mass departure, so retiring members off it
// would strip real members from users' delegations. Skip retirement below this.
const MIN_ROSTER_SIZE = 500;

// Full current-member roster (~537) is cheap — one detail call each, well under
// the rate limit, so no incremental window needed. `maxPages` bounds it for
// verification slices.
export async function ingestMembersBatch(opts: { maxPages?: number } = {}) {
	let offset = 0;
	let processed = 0;
	let failed = 0;
	let pages = 0;
	let reachedEnd = false;
	const seen = new Set<string>();

	while (true) {
		const page = await getMembers({ offset, limit: PAGE_SIZE, currentMember: true });
		const members = page.members ?? [];
		if (members.length === 0) {
			reachedEnd = true;
			break;
		}

		for (const m of members) {
			if (m.bioguideId) seen.add(m.bioguideId);
			try {
				await ingestMember(m.bioguideId);
				processed++;
			} catch (err) {
				failed++;
				console.error(`Failed to ingest member ${m.bioguideId}:`, (err as Error).message);
			}
		}

		pages++;
		if (!page.pagination?.next) {
			reachedEnd = true;
			break;
		}
		if (opts.maxPages && pages >= opts.maxPages) break;
		offset += members.length;
	}

	const retired = await retireDepartedMembers(seen, { reachedEnd, failed });
	return { processed, failed, retired };
}

/**
 * Flip currentMember=false on roster members congress.gov no longer lists
 * (resignation, death, special-election successor seated). This is what lets
 * the delegation reconcile find users still linked to a departed member.
 *
 * Only runs after a complete pass — every page read, no maxPages cap, no
 * per-member failures — because a partial pass would retire members we
 * simply didn't reach. Returns how many were retired, or null if skipped.
 */
async function retireDepartedMembers(
	seen: Set<string>,
	run: { reachedEnd: boolean; failed: number }
): Promise<number | null> {
	if (!run.reachedEnd || run.failed > 0) {
		console.warn(
			`[members] incomplete roster pass (reachedEnd=${run.reachedEnd} failed=${run.failed}); not retiring departed members`
		);
		return null;
	}
	if (seen.size < MIN_ROSTER_SIZE) {
		console.warn(`[members] roster listed only ${seen.size} members (< ${MIN_ROSTER_SIZE}); not retiring departed members`);
		return null;
	}

	const { count } = await prisma.member.updateMany({
		where: { source: 'congressgov', currentMember: true, id: { notIn: [...seen] } },
		data: { currentMember: false },
	});
	if (count > 0) console.log(`[members] retired ${count} member(s) no longer on the congress.gov roster`);
	return count;
}
