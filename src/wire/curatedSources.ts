import type { FeedSourceKind, SocialPlatform } from '@prisma/client';

/**
 * Hand-picked, non-member sources for The Wire: federal agencies and reputable
 * organizations. Members of Congress are imported automatically from the
 * congress-legislators dataset and don't belong here.
 *
 * To add a source, append an entry and run `npm run wire:sync`. Take handles
 * from the organization's own website (footer / about page), never from a
 * platform search, so impersonator accounts can't slip in. YouTube needs the
 * channel id (UC…): open the channel page and copy it from the canonical link.
 */
export type CuratedAccount = {
	platform: SocialPlatform;
	handle?: string;
	platformId?: string;
	url?: string;
};

export type CuratedSource = {
	slug: string;
	name: string;
	kind: Extract<FeedSourceKind, 'AGENCY' | 'ORGANIZATION'>;
	accounts: CuratedAccount[];
};

export const CURATED_SOURCES: CuratedSource[] = [
	{
		// Handles from propublica.org/about (checked 2026-11-23).
		slug: 'org-propublica',
		name: 'ProPublica',
		kind: 'ORGANIZATION',
		accounts: [
			{ platform: 'BLUESKY', handle: 'propublica.org', url: 'https://bsky.app/profile/propublica.org' },
			{
				platform: 'YOUTUBE',
				handle: 'propublica',
				platformId: 'UCtCL58_DaVdVRmev3yHK7pg',
				url: 'https://www.youtube.com/@propublica',
			},
			{ platform: 'INSTAGRAM', handle: 'propublica', url: 'https://www.instagram.com/propublica' },
			{ platform: 'X', handle: 'propublica', url: 'https://x.com/propublica' },
			{ platform: 'THREADS', handle: 'propublica', url: 'https://www.threads.net/@propublica' },
			{ platform: 'FACEBOOK', handle: 'propublica', url: 'https://www.facebook.com/propublica' },
		],
	},
	{
		// Handles from ground.news footer + its Bluesky bio (checked 2026-11-23).
		// YouTube isn't linked from ground.news; @ground_news confirmed by the
		// owner. (@groundnews is an unrelated Indian channel — don't use it.)
		slug: 'org-ground-news',
		name: 'Ground News',
		kind: 'ORGANIZATION',
		accounts: [
			{ platform: 'BLUESKY', handle: 'groundnews.bsky.social', url: 'https://bsky.app/profile/groundnews.bsky.social' },
			{
				platform: 'YOUTUBE',
				handle: 'ground_news',
				platformId: 'UCoix4vRpJhsN_MelspSiuwg',
				url: 'https://www.youtube.com/@ground_news',
			},
			{ platform: 'INSTAGRAM', handle: 'groundnews', url: 'https://www.instagram.com/groundnews' },
			{ platform: 'X', handle: 'Ground_app', url: 'https://x.com/Ground_app' },
			{ platform: 'FACEBOOK', handle: 'ground.newsapp', url: 'https://www.facebook.com/ground.newsapp' },
		],
	},
];
