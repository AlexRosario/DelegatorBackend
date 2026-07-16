"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.billController = void 0;
const express_1 = require("express");
require("express-async-errors");
const zod_express_middleware_1 = require("zod-express-middleware");
const prisma_1 = __importDefault(require("../../prisma/prisma"));
const auth_utils_1 = require("../utils/auth-utils");
const zodSchema_1 = require("../zodSchema");
const congressGovClient_1 = require("../services/congressGovClient");
const billController = (0, express_1.Router)();
exports.billController = billController;
/** What both bill endpoints load: the sponsor, plus a cheap comment count so the
 *  feed can show a 💬 badge without ever shipping the comments themselves. */
const BILL_INCLUDE = { sponsor: true, _count: { select: { comments: true } } };
/**
 * Map a stored Bill row into the congress.gov-ish shape the frontend already
 * consumes, so the app can read pre-assembled bills from our DB instead of
 * fanning out to the live proxy per bill.
 */
function serializeBill(row) {
    const subjectNames = Array.isArray(row.subjects) ? row.subjects : [];
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
// The stage vocabulary deriveStage (ingestion/normalizeBill) can produce —
// requests naming anything else are ignored rather than erroring.
const BILL_STAGES = new Set([
    'Introduced',
    'In Committee',
    'Passed House',
    'Passed Senate',
    'Passed Both Chambers',
    'To President',
    'Became Law',
    'Failed',
    'Vetoed',
]);
/** Facet counts for the filter menu: server truth about which facets are
 *  non-empty and how big, so the client never gates options on loaded pages.
 *  With a valid JWT the counts answer "how many are left for YOU" (unvoted),
 *  matching what the personalized feed will actually show — the menu and the
 *  feed must be answers to the same question. Guests get corpus counts. */
billController.get('/bills/facets', async (req, res) => {
    const congress = Number(req.query.congress ?? 119);
    try {
        const token = (0, auth_utils_1.tokenFromRequest)(req);
        const payload = (0, auth_utils_1.getDataFromToken)(token);
        const caller = payload?.username
            ? await prisma_1.default.user.findUnique({ where: { username: payload.username } })
            : null;
        const where = { congress };
        if (caller)
            where.userVotes = { none: { userId: caller.id } };
        const [total, rollCall, stageGroups] = await Promise.all([
            prisma_1.default.bill.count({ where }),
            prisma_1.default.bill.count({ where: { ...where, rollCalls: { some: {} } } }),
            prisma_1.default.bill.groupBy({ by: ['stage'], where, _count: { _all: true } }),
        ]);
        const stages = {};
        for (const group of stageGroups) {
            if (group.stage)
                stages[group.stage] = group._count._all;
        }
        return res.status(200).json({ total, rollCall, stages });
    }
    catch (error) {
        console.error('Error fetching bill facets:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
billController.get('/bills', async (req, res) => {
    const { congress, billType, policyArea, q, filter } = req.query;
    const take = Math.min(Number(req.query.limit ?? 20), 100);
    const skip = Number(req.query.offset ?? 0);
    const where = {};
    if (congress)
        where.congress = Number(congress);
    if (billType)
        where.billType = String(billType).toLowerCase();
    if (policyArea)
        where.policyArea = String(policyArea);
    if (q)
        where.title = { contains: String(q), mode: 'insensitive' }; // PG contains is case-sensitive (SQLite's wasn't)
    // Facet filters are DB queries, not client-side subsets of loaded pages —
    // each facet paginates over the full corpus independently. Dimensions are
    // orthogonal params so they compose (stage + roll call + voted) for free.
    const stages = String(req.query.stage ?? '')
        .split(',')
        .filter((s) => BILL_STAGES.has(s));
    if (stages.length > 0)
        where.stage = { in: stages };
    if (req.query.hasRollCall === 'true')
        where.rollCalls = { some: {} };
    // Legacy aliases (pre-facet frontend) — keep one deploy cycle, then remove.
    if (filter === 'passed')
        where.stage = 'Became Law';
    if (filter === 'roll-call')
        where.rollCalls = { some: {} };
    // Per-user facets: the server owns the votes, so it can exclude (discover
    // feed) or select (My Bills) the caller's voted bills exactly — no reliance
    // on client-side vote logs. Requires a valid JWT; 401 lets the client fall
    // back to an unpersonalized query rather than a broken feed.
    const voted = req.query.voted;
    if (voted === 'exclude' || voted === 'only') {
        const token = (0, auth_utils_1.tokenFromRequest)(req);
        const payload = (0, auth_utils_1.getDataFromToken)(token);
        const caller = payload?.username
            ? await prisma_1.default.user.findUnique({ where: { username: payload.username } })
            : null;
        if (!caller)
            return res.status(401).json({ message: 'Sign in required for voted filters' });
        where.userVotes = voted === 'exclude' ? { none: { userId: caller.id } } : { some: { userId: caller.id } };
    }
    try {
        const [bills, total] = await Promise.all([
            prisma_1.default.bill.findMany({
                where,
                // id tiebreaker: many bills share a latestActionDate, and Postgres gives
                // no stable order among ties — without it, offset pages overlap and the
                // client's dedup starves the infinite scroll.
                orderBy: [{ latestActionDate: 'desc' }, { id: 'asc' }],
                take,
                skip,
                include: BILL_INCLUDE,
            }),
            prisma_1.default.bill.count({ where }),
        ]);
        return res.status(200).json({ total, limit: take, offset: skip, bills: bills.map(serializeBill) });
    }
    catch (error) {
        console.error('Error fetching bills:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
/** Assemble a bill from congress.gov when it isn't in our DB yet (coverage gap). */
async function assembleFromCongress(id) {
    const m = id.match(/^(\d+)-([a-z]+)-(\w+)$/i);
    if (!m)
        return null;
    const [, congress, billType, billNumber] = m;
    const ref = { congress, billType: billType.toLowerCase(), billNumber };
    let detail;
    try {
        detail = await (0, congressGovClient_1.getFullBill)(ref);
    }
    catch {
        return null; // congress.gov 404/error — bill not found
    }
    const bill = detail.bill;
    if (!bill)
        return null;
    const [summaries, subjects, , actions] = await Promise.all([
        (0, congressGovClient_1.getBillSummaries)(ref).catch(() => []),
        (0, congressGovClient_1.getBillSubjects)(ref).catch(() => ({ legislativeSubjects: [] })),
        (0, congressGovClient_1.getBillTextVersions)(ref).catch(() => []),
        (0, congressGovClient_1.getBillActions)(ref).catch(() => []),
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
        const row = await prisma_1.default.bill.findUnique({
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
    }
    catch (error) {
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
    const comments = await prisma_1.default.billComment.findMany({
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
billController.post('/bills/:id/comments', auth_utils_1.authenticate, (0, zod_express_middleware_1.validateRequest)({ body: zodSchema_1.commentSchema }), async (req, res) => {
    const bill = await prisma_1.default.bill.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!bill)
        return res.status(404).json({ message: 'Bill not found' });
    const comment = await prisma_1.default.billComment.create({
        data: { billId: bill.id, userId: req.user.id, body: req.body.body },
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
    const results = await Promise.all(memberIds.map(async (bioguideId) => {
        const votes = await prisma_1.default.vote.findMany({
            where: {
                billId: req.params.id,
                user: { members: { some: { id: bioguideId } } },
            },
            select: { vote: true },
        });
        const yes = votes.filter((v) => v.vote === 'Yes').length;
        return { bioguideId, yes, no: votes.length - yes, total: votes.length };
    }));
    return res.status(200).json({ billId: req.params.id, results });
});
