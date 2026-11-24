import type { FeedSourceKind, SocialPlatform } from '@prisma/client';
import prisma from '../../prisma/prisma';
import { CURATED_SOURCES, type CuratedAccount } from './curatedSources';

// Maintained by the @unitedstates project; keyed by bioguide id, which is Member.id.
const LEGISLATOR_SOCIAL_URL = 'https://unitedstates.github.io/congress-legislators/legislators-social-media.json';

type LegislatorSocial = {
	id: { bioguide: string };
	social: Partial<
		Record<
			'twitter' | 'twitter_id' | 'instagram' | 'instagram_id' | 'youtube' | 'youtube_id' | 'facebook' | 'mastodon',
			string
		>
	>;
};

function memberAccounts(social: LegislatorSocial['social']): CuratedAccount[] {
	const accounts: CuratedAccount[] = [];
	if (social.twitter || social.twitter_id) {
		accounts.push({
			platform: 'X',
			handle: social.twitter,
			platformId: social.twitter_id,
			url: social.twitter ? `https://x.com/${social.twitter}` : undefined,
		});
	}
	if (social.instagram || social.instagram_id) {
		accounts.push({
			platform: 'INSTAGRAM',
			handle: social.instagram,
			platformId: social.instagram_id,
			url: social.instagram ? `https://www.instagram.com/${social.instagram}` : undefined,
		});
	}
	if (social.youtube || social.youtube_id) {
		accounts.push({
			platform: 'YOUTUBE',
			handle: social.youtube, // legacy username; resolved to a channel id only with YOUTUBE_API_KEY
			platformId: social.youtube_id,
			url: social.youtube_id
				? `https://www.youtube.com/channel/${social.youtube_id}`
				: `https://www.youtube.com/user/${social.youtube}`,
		});
	}
	if (social.facebook) {
		accounts.push({ platform: 'FACEBOOK', handle: social.facebook, url: `https://www.facebook.com/${social.facebook}` });
	}
	if (social.mastodon) {
		accounts.push({ platform: 'MASTODON', handle: social.mastodon });
	}
	return accounts;
}

async function upsertSource(input: {
	slug: string;
	name: string;
	kind: FeedSourceKind;
	memberId?: string;
	accounts: CuratedAccount[];
}): Promise<{ accounts: number; failed: string[] }> {
	const source = await prisma.feedSource.upsert({
		where: { slug: input.slug },
		create: { slug: input.slug, name: input.name, kind: input.kind, memberId: input.memberId, lane: 'WIRE' },
		update: { name: input.name, kind: input.kind, active: true },
	});

	const failed: string[] = [];
	let accounts = 0;
	for (const acct of input.accounts) {
		try {
			await prisma.socialAccount.upsert({
				where: { sourceId_platform: { sourceId: source.id, platform: acct.platform } },
				create: {
					sourceId: source.id,
					platform: acct.platform,
					handle: acct.handle,
					platformId: acct.platformId,
					url: acct.url,
				},
				// Never clear a platformId an ingester resolved (e.g. a Bluesky DID).
				update: {
					handle: acct.handle,
					url: acct.url,
					...(acct.platformId ? { platformId: acct.platformId } : {}),
				},
			});
			accounts++;
		} catch (err) {
			// Usually the same platform id claimed by two sources in the upstream data.
			failed.push(`${input.slug}/${acct.platform as SocialPlatform}: ${(err as Error).message.split('\n').pop()}`);
		}
	}
	return { accounts, failed };
}

/**
 * Syncs The Wire's source list: every current member of Congress (with their
 * accounts from congress-legislators) plus the curated agencies and
 * organizations. Members who leave office are deactivated, not deleted, so
 * their past posts and any future ratings stay attached.
 */
export async function syncWireSources() {
	const res = await fetch(LEGISLATOR_SOCIAL_URL);
	if (!res.ok) throw new Error(`congress-legislators social fetch failed: ${res.status}`);
	const legislators = (await res.json()) as LegislatorSocial[];
	// Some ids (e.g. instagram_id) arrive as JSON numbers; the schema stores strings.
	const socialByBioguide = new Map(
		legislators.map((l) => [
			l.id.bioguide,
			Object.fromEntries(Object.entries(l.social).map(([k, v]) => [k, String(v)])) as LegislatorSocial['social'],
		])
	);

	const members = await prisma.member.findMany({
		where: { currentMember: true },
		select: { id: true, name: true },
	});

	let sources = 0;
	let accounts = 0;
	const failed: string[] = [];

	for (const member of members) {
		const social = socialByBioguide.get(member.id);
		if (!social) continue; // no known accounts
		const r = await upsertSource({
			slug: `member-${member.id}`,
			name: member.name,
			kind: 'MEMBER',
			memberId: member.id,
			accounts: memberAccounts(social),
		});
		sources++;
		accounts += r.accounts;
		failed.push(...r.failed);
	}

	const currentIds = members.map((m) => m.id);
	const { count: deactivated } = await prisma.feedSource.updateMany({
		where: { kind: 'MEMBER', active: true, OR: [{ memberId: null }, { memberId: { notIn: currentIds } }] },
		data: { active: false },
	});

	for (const curated of CURATED_SOURCES) {
		const r = await upsertSource(curated);
		sources++;
		accounts += r.accounts;
		failed.push(...r.failed);
	}
	// A source taken off the curated list leaves The Wire on the next sync.
	const { count: uncurated } = await prisma.feedSource.updateMany({
		where: {
			lane: 'WIRE',
			kind: { in: ['AGENCY', 'ORGANIZATION'] },
			active: true,
			slug: { notIn: CURATED_SOURCES.map((c) => c.slug) },
		},
		data: { active: false },
	});

	if (failed.length) console.warn('[wire-sync] accounts skipped:', failed);
	return {
		sources,
		accounts,
		deactivated: deactivated + uncurated,
		failed: failed.length,
		message: `sources=${sources} accounts=${accounts} deactivated=${deactivated + uncurated} skipped=${failed.length}`,
	};
}
