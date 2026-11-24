import { Router } from 'express';
import 'express-async-errors';
import { z } from 'zod';
import type { Prisma, SocialPlatform } from '@prisma/client';
import prisma from '../../prisma/prisma';
import { INGESTERS } from '../wire/ingesters';

const wireController = Router();

const wireQuery = z.object({
	kind: z.enum(['member', 'agency', 'organization']).optional(),
	platform: z.enum(['bluesky', 'youtube', 'instagram', 'x']).optional(),
	cursor: z.coerce.number().int().positive().optional(), // id of the last post on the previous page
	limit: z.coerce.number().int().min(1).max(50).default(24),
});

/**
 * GET /wire — The Wire, newest first. Curated sources only (lane WIRE, active).
 * Paginate by passing the response's `nextCursor` back as `cursor`.
 */
wireController.get('/wire', async (req, res) => {
	const parsed = wireQuery.safeParse(req.query);
	if (!parsed.success) {
		return res.status(400).json({ message: 'Invalid query', issues: parsed.error.issues });
	}
	const { kind, platform, cursor, limit } = parsed.data;

	// Only platforms that are switched on; posts stored from a platform that has
	// since been turned off stay in the database but drop out of The Wire.
	const enabled = (Object.keys(INGESTERS) as SocialPlatform[]).filter(
		(p) => !platform || p === platform.toUpperCase()
	);

	const where: Prisma.SocialPostWhereInput = {
		account: {
			platform: { in: enabled },
			source: {
				lane: 'WIRE',
				active: true,
				...(kind ? { kind: kind.toUpperCase() as Prisma.EnumFeedSourceKindFilter['equals'] } : {}),
			},
		},
	};

	const rows = await prisma.socialPost.findMany({
		where,
		orderBy: [{ postedAt: 'desc' }, { id: 'desc' }],
		take: limit + 1,
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		include: {
			account: {
				select: {
					platform: true,
					handle: true,
					url: true,
					source: {
						select: {
							slug: true,
							name: true,
							kind: true,
							member: { select: { id: true, party: true, state: true, district: true, chamber: true } },
						},
					},
				},
			},
		},
	});

	const page = rows.slice(0, limit);
	res.json({
		posts: page.map((p) => ({
			id: p.id,
			platform: p.account.platform.toLowerCase(),
			url: p.url,
			title: p.title,
			text: p.text,
			mediaUrl: p.mediaUrl,
			postedAt: p.postedAt,
			stats: {
				likes: p.likeCount,
				comments: p.commentCount,
				reposts: p.repostCount,
				views: p.viewCount,
			},
			account: { handle: p.account.handle, url: p.account.url },
			source: {
				slug: p.account.source.slug,
				name: p.account.source.name,
				kind: p.account.source.kind.toLowerCase(),
				member: p.account.source.member,
			},
		})),
		nextCursor: rows.length > limit ? page[page.length - 1].id : null,
		// Lets the client show only the platforms that actually have posts flowing.
		livePlatforms: Object.keys(INGESTERS).map((p) => p.toLowerCase()),
	});
});

export { wireController };
