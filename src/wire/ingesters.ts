import * as cheerio from 'cheerio';
import type { SocialAccount, SocialPlatform } from '@prisma/client';

export type IngestedPost = {
	platformPostId: string;
	url: string;
	title?: string;
	text: string;
	mediaUrl?: string;
	postedAt: Date;
	likeCount?: number;
	commentCount?: number;
	repostCount?: number;
	viewCount?: number;
};

export type IngestResult = {
	posts: IngestedPost[];
	// Stable id / current handle discovered while fetching, saved back on the account.
	platformId?: string;
	handle?: string;
};

export type Ingester = (account: SocialAccount) => Promise<IngestResult>;

const toInt = (v: string | number | undefined | null) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
};

// ---------- Bluesky (public AppView, no key) ----------

type BskyEmbed = {
	$type?: string;
	images?: { thumb?: string }[];
	external?: { title?: string; thumb?: string };
	thumbnail?: string; // video
	media?: BskyEmbed; // recordWithMedia
};

type BskyFeedItem = {
	reason?: unknown; // present on reposts
	post: {
		uri: string;
		author: { did: string; handle: string };
		record: { text?: string; createdAt?: string };
		embed?: BskyEmbed;
		indexedAt: string;
		likeCount?: number;
		replyCount?: number;
		repostCount?: number;
		quoteCount?: number;
	};
};

function bskyMedia(embed?: BskyEmbed): { mediaUrl?: string; title?: string } {
	if (!embed) return {};
	if (embed.media) return bskyMedia(embed.media);
	if (embed.images?.length) return { mediaUrl: embed.images[0].thumb };
	if (embed.external) return { mediaUrl: embed.external.thumb, title: embed.external.title };
	if (embed.thumbnail) return { mediaUrl: embed.thumbnail };
	return {};
}

export const fetchBluesky: Ingester = async (account) => {
	const actor = account.platformId ?? account.handle;
	if (!actor) throw new Error('no Bluesky handle or DID');
	const url =
		'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed' +
		`?actor=${encodeURIComponent(actor)}&filter=posts_no_replies&limit=30`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Bluesky ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const { feed } = (await res.json()) as { feed: BskyFeedItem[] };

	let did: string | undefined;
	let handle: string | undefined;
	const posts: IngestedPost[] = [];
	for (const item of feed) {
		const p = item.post;
		// Reposts carry someone else's post under this account; The Wire shows only
		// the curated account's own words.
		if (item.reason) continue;
		did = p.author.did;
		handle = p.author.handle;

		const created = p.record.createdAt ? new Date(p.record.createdAt) : new Date(p.indexedAt);
		const indexed = new Date(p.indexedAt);
		const { mediaUrl, title } = bskyMedia(p.embed);
		posts.push({
			platformPostId: p.uri,
			url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`,
			title,
			text: p.record.text ?? '',
			mediaUrl,
			// createdAt is client-supplied; never let a post claim a time after Bluesky saw it.
			postedAt: created > indexed || Number.isNaN(created.getTime()) ? indexed : created,
			likeCount: p.likeCount,
			commentCount: p.replyCount,
			repostCount: (p.repostCount ?? 0) + (p.quoteCount ?? 0),
		});
	}
	return { posts, platformId: did, handle };
};

// ---------- YouTube (channel RSS, no key; key only resolves legacy usernames) ----------

async function resolveYouTubeChannelId(username: string): Promise<string | undefined> {
	const key = process.env.YOUTUBE_API_KEY;
	if (!key) return undefined;
	for (const param of [`forUsername=${encodeURIComponent(username)}`, `forHandle=${encodeURIComponent('@' + username)}`]) {
		const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&${param}&key=${key}`);
		if (!res.ok) throw new Error(`YouTube API ${res.status}`);
		const body = (await res.json()) as { items?: { id: string }[] };
		if (body.items?.length) return body.items[0].id;
	}
	return undefined;
}

export const fetchYouTube: Ingester = async (account) => {
	let channelId = account.platformId ?? undefined;
	if (!channelId && account.handle) channelId = await resolveYouTubeChannelId(account.handle);
	if (!channelId) {
		throw new Error(
			process.env.YOUTUBE_API_KEY
				? `no YouTube channel found for "${account.handle}"`
				: 'no channel id; set YOUTUBE_API_KEY to resolve legacy usernames'
		);
	}

	const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
	if (!res.ok) throw new Error(`YouTube RSS ${res.status}`);
	const $ = cheerio.load(await res.text(), { xmlMode: true });

	const posts: IngestedPost[] = [];
	$('entry').each((_, el) => {
		const entry = $(el);
		const videoId = entry.find('yt\\:videoId').first().text();
		if (!videoId) return;
		posts.push({
			platformPostId: videoId,
			url: `https://www.youtube.com/watch?v=${videoId}`,
			title: entry.find('title').first().text() || undefined,
			text: entry.find('media\\:description').first().text(),
			mediaUrl: entry.find('media\\:thumbnail').first().attr('url'),
			postedAt: new Date(entry.find('published').first().text()),
			likeCount: toInt(entry.find('media\\:starRating').first().attr('count')),
			viewCount: toInt(entry.find('media\\:statistics').first().attr('views')),
		});
	});
	return { posts, platformId: channelId };
};

/**
 * Platforms The Wire pulls and shows. YouTube only for now; Instagram joins
 * once Meta approves the app. fetchBluesky works but is switched off by
 * choice (Nov 23, 2026): add `BLUESKY: fetchBluesky` here to turn it back on.
 */
export const INGESTERS: Partial<Record<SocialPlatform, Ingester>> = {
	YOUTUBE: fetchYouTube,
};
