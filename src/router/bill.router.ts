import { Router } from 'express';
import 'express-async-errors';
import { Prisma } from '@prisma/client';
import { validateRequest } from 'zod-express-middleware';
import prisma from '../../prisma/prisma';
import { authenticate } from '../utils/auth-utils';
import { commentSchema } from '../zodSchema';
import { getFullBill, getBillSummaries, getBillSubjects, getBillTextVersions, getBillActions } from '../services/congressGovClient';

const billController = Router();

/** What both bill endpoints load: the sponsor, plus a cheap comment count so the
 *  feed can show a 💬 badge without ever shipping the comments themselves. */
const BILL_INCLUDE = { sponsor: true, _count: { select: { comments: true } } } as const;
type BillWithSponsor = Prisma.BillGetPayload<{ include: typeof BILL_INCLUDE }>;

/**
 * Map a stored Bill row into the congress.gov-ish shape the frontend already
 * consumes, so the app can read pre-assembled bills from our DB instead of
 * fanning out to the live proxy per bill.
 */
function serializeBill(row: BillWithSponsor) {
	const subjectNames: string[] = Array.isArray(row.subjects) ? (row.subjects as string[]) : [];
	return {
		id: row.id,
		type: row.billType,
		number: row.billNumber,
		congress: row.congress,
		title: row.title,
		summary: row.summary ?? 'No Summary Available',
		plainSummary: row.plainSummary ?? null, // cached Claude translation, if any
		stage: row.stage ?? null,
		introducedDate: row.introducedDate ?? null,
		originChamber: row.originChamber ?? row.chamber ?? null,
		originChamberCode: row.chamber === 'Senate' ? 'S' : row.chamber === 'House' ? 'H' : null,
		url: row.congressGovUrl ?? null,
		latestAction: {
			text: row.latestActionText ?? row.status ?? '',
			actionDate: row.latestActionDate ?? null,
		},
		// Frontend reads bill.subjects.legislativeSubjects (BillCollection.tsx).
		subjects: { legislativeSubjects: subjectNames.map((name) => ({ name })) },
		// Stored raw from congress.gov — already carries recordedVotes for vote-alignment.
		actions: Array.isArray(row.actions) ? row.actions : [],
		policyArea: row.policyArea ? { name: row.policyArea } : null,
		commentCount: row._count?.comments ?? 0,
		cosponsors: { count: row.cosponsorCount ?? 0 },
		sponsors: row.sponsor ? [row.sponsor] : [],
		textVersions: row.textVersionUrl ? { count: 1, url: row.textVersionUrl } : undefined,
	};
}

/**
 * Single source of bills for the frontend — served from our DB (populated by the
 * daily ingest), pre-assembled so there's no per-bill congress.gov fan-out.
 *
 * GET /bills?congress=119&billType=hr&policyArea=Energy&q=energy&limit=20&offset=0
 */
billController.get('/bills', async (req, res) => {
	const { congress, billType, policyArea, q } = req.query;
	const take = Math.min(Number(req.query.limit ?? 20), 100);
	const skip = Number(req.query.offset ?? 0);

	const where: Prisma.BillWhereInput = {};
	if (congress) where.congress = Number(congress);
	if (billType) where.billType = String(billType).toLowerCase();
	if (policyArea) where.policyArea = String(policyArea);
	if (q) where.title = { contains: String(q), mode: 'insensitive' }; // PG contains is case-sensitive (SQLite's wasn't)

	try {
		const [bills, total] = await Promise.all([
			prisma.bill.findMany({
				where,
				// id tiebreaker: many bills share a latestActionDate, and Postgres gives
				// no stable order among ties — without it, offset pages overlap and the
				// client's dedup starves the infinite scroll.
				orderBy: [{ latestActionDate: 'desc' }, { id: 'asc' }],
				take,
				skip,
				include: BILL_INCLUDE,
			}),
			prisma.bill.count({ where }),
		]);

		return res.status(200).json({ total, limit: take, offset: skip, bills: bills.map(serializeBill) });
	} catch (error) {
		console.error('Error fetching bills:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

/** Assemble a bill from congress.gov when it isn't in our DB yet (coverage gap). */
async function assembleFromCongress(id: string) {
	const m = id.match(/^(\d+)-([a-z]+)-(\w+)$/i);
	if (!m) return null;
	const [, congress, billType, billNumber] = m;
	const ref = { congress, billType: billType.toLowerCase(), billNumber };

	let detail: any;
	try {
		detail = await getFullBill(ref);
	} catch {
		return null; // congress.gov 404/error — bill not found
	}
	const bill = detail.bill;
	if (!bill) return null;

	const [summaries, subjects, , actions] = await Promise.all([
		getBillSummaries(ref).catch(() => []),
		getBillSubjects(ref).catch(() => ({ legislativeSubjects: [] })),
		getBillTextVersions(ref).catch(() => []),
		getBillActions(ref).catch(() => []),
	]);
	const latestSummary = summaries[summaries.length - 1];

	return {
		id,
		type: bill.type,
		number: bill.number,
		congress: Number(bill.congress),
		title: bill.title,
		summary: latestSummary?.text ?? 'No Summary Available',
		stage: null,
		introducedDate: bill.introducedDate ?? null,
		originChamber: bill.originChamber ?? null,
		url: bill.legislationUrl ?? null,
		latestAction: bill.latestAction ?? { text: '', actionDate: null },
		subjects: { legislativeSubjects: subjects.legislativeSubjects ?? [] },
		actions,
		policyArea: bill.policyArea ?? null,
		commentCount: 0, // not in our DB yet → no discussion thread yet
		cosponsors: bill.cosponsors ?? { count: 0 },
		sponsors: bill.sponsors ?? [],
		textVersions: bill.textVersions ?? undefined,
	};
}

billController.get('/bills/:id', async (req, res) => {
	try {
		const row = await prisma.bill.findUnique({
			where: { id: req.params.id },
			include: BILL_INCLUDE,
		});
		if (row) {
			return res.status(200).json(serializeBill(row));
		}

		// Not ingested yet — fall back to the live proxy so arbitrary lookups work.
		const assembled = await assembleFromCongress(req.params.id);
		if (!assembled) {
			return res.status(404).json({ message: 'Bill not found' });
		}
		return res.status(200).json(assembled);
	} catch (error) {
		console.error('Error fetching bill:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

/**
 * Discussion thread for a bill — newest first, cursor-paginated so the panel
 * can "load older" without offsets drifting as new comments arrive.
 *
 * GET /bills/:id/comments?cursor=<commentId>&limit=20
 */
billController.get('/bills/:id/comments', async (req, res) => {
	const take = Math.min(Number(req.query.limit ?? 20), 100);
	const cursorId = req.query.cursor ? Number(req.query.cursor) : undefined;

	const comments = await prisma.billComment.findMany({
		where: { billId: req.params.id },
		orderBy: { id: 'desc' }, // autoincrement id ≈ createdAt order, and it's a stable cursor
		take,
		...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
		include: { user: { select: { username: true } } },
	});

	return res.status(200).json({
		comments: comments.map((c) => ({
			id: c.id,
			body: c.body,
			username: c.user.username,
			createdAt: c.createdAt,
		})),
		// Pass this back as ?cursor= to fetch the next (older) page.
		nextCursor: comments.length === take ? comments[comments.length - 1].id : null,
	});
});

billController.post('/bills/:id/comments', authenticate, validateRequest({ body: commentSchema }), async (req, res) => {
	const bill = await prisma.bill.findUnique({ where: { id: req.params.id }, select: { id: true } });
	if (!bill) return res.status(404).json({ message: 'Bill not found' });

	const comment = await prisma.billComment.create({
		data: { billId: bill.id, userId: req.user!.id, body: req.body.body },
		include: { user: { select: { username: true } } },
	});

	return res.status(201).json({
		id: comment.id,
		body: comment.body,
		username: comment.user.username,
		createdAt: comment.createdAt,
	});
});

/**
 * Constituent sentiment per member for one bill: among app users who have the
 * member in their delegation AND voted on this bill, how many voted Yes / No.
 * Aggregates only — individual votes are never exposed.
 *
 * GET /bills/:id/constituent-votes?members=V000081,S000148,G000555
 */
billController.get('/bills/:id/constituent-votes', async (req, res) => {
	const memberIds = String(req.query.members ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean)
		.slice(0, 10); // a user's delegation is 3; cap defensively
	if (memberIds.length === 0) {
		return res.status(400).json({ message: 'members query param required (comma-separated bioguideIds)' });
	}

	const results = await Promise.all(
		memberIds.map(async (bioguideId) => {
			const votes = await prisma.vote.findMany({
				where: {
					billId: req.params.id,
					user: { members: { some: { id: bioguideId } } },
				},
				select: { vote: true },
			});
			const yes = votes.filter((v) => v.vote === 'Yes').length;
			return { bioguideId, yes, no: votes.length - yes, total: votes.length };
		})
	);

	return res.status(200).json({ billId: req.params.id, results });
});

export { billController };
