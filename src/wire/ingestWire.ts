import type { SocialAccount, SocialPlatform } from '@prisma/client';
import prisma from '../../prisma/prisma';
import { INGESTERS } from './ingesters';

const CONCURRENCY = 4;

async function ingestAccount(account: SocialAccount): Promise<number> {
	const ingester = INGESTERS[account.platform]!;
	try {
		const result = await ingester(account);
		const fresh = result.posts.filter((p) => !Number.isNaN(p.postedAt.getTime()));

		await prisma.$transaction(
			fresh.map((p) =>
				prisma.socialPost.upsert({
					where: { accountId_platformPostId: { accountId: account.id, platformPostId: p.platformPostId } },
					create: { accountId: account.id, ...p },
					// Refresh engagement counts and edits; keep the original post time.
					update: {
						title: p.title,
						text: p.text,
						mediaUrl: p.mediaUrl,
						likeCount: p.likeCount,
						commentCount: p.commentCount,
						repostCount: p.repostCount,
						viewCount: p.viewCount,
					},
				})
			)
		);

		await prisma.socialAccount.update({
			where: { id: account.id },
			data: {
				lastFetchedAt: new Date(),
				lastError: null,
				...(result.platformId && !account.platformId ? { platformId: result.platformId } : {}),
				...(result.handle && result.handle !== account.handle ? { handle: result.handle } : {}),
			},
		});
		return fresh.length;
	} catch (err) {
		await prisma.socialAccount.update({
			where: { id: account.id },
			data: { lastFetchedAt: new Date(), lastError: (err as Error).message.slice(0, 500) },
		});
		throw err;
	}
}

/**
 * Pulls recent posts for every active Wire account on a platform that has an
 * ingester. One account failing never stops the others; its error is kept on
 * the account row (SocialAccount.lastError) for debugging.
 */
export async function ingestWire(opts: { platforms?: SocialPlatform[] } = {}) {
	const platforms = (opts.platforms ?? (Object.keys(INGESTERS) as SocialPlatform[])).filter((p) => INGESTERS[p]);
	const accounts = await prisma.socialAccount.findMany({
		where: { platform: { in: platforms }, source: { active: true, lane: 'WIRE' } },
		orderBy: { id: 'asc' },
	});

	let posts = 0;
	let failed = 0;
	const queue = [...accounts];
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			for (let account = queue.shift(); account; account = queue.shift()) {
				try {
					// Await first: `posts += await …` would read `posts` before the await
					// and drop other workers' increments.
					const n = await ingestAccount(account);
					posts += n;
				} catch {
					failed++;
				}
			}
		})
	);

	return {
		accounts: accounts.length,
		posts,
		failed,
		message: `accounts=${accounts.length} posts=${posts} failed=${failed} platforms=${platforms.join(',')}`,
	};
}
