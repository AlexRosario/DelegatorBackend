import { Router } from 'express';
import 'express-async-errors';
import prisma from '../../prisma/prisma';
import { authenticate } from '../utils/auth-utils';
import { getDonorSummary } from '../services/donorService';
import { COVERAGE_FROM_YEAR, getSeatHistory, resolveState, toCongressDistrict, type Seat } from '../services/seatHistory';

const repController = Router();

repController.get('/members/test', (_req, res) => {
	res.send('repController works!');
});
// The caller's own delegation. Replaces the unauthenticated /members/by-user/:id
// route, which let anyone enumerate user ids and infer where each user lives
// (a House rep pins down the district).
repController.get('/members/mine', authenticate, async (req, res) => {
	try {
		const userWithMembers = await prisma.user.findUnique({
			where: { id: req.user!.id },
			// Reconcile normally drops departed members within minutes of the roster
			// pass; this filter guarantees they never show here in the meantime.
			include: { members: { where: { currentMember: true } } },
		});
		if (!userWithMembers) {
			return res.status(404).json({ message: 'User not found' });
		}
		res.json(userWithMembers.members);
	} catch (error) {
		console.error('Error fetching own members:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});
// "My past reps": members who used to represent the caller. One entry per
// member (their most recent closed span), newest first, excluding anyone who
// represents the caller again now. startedAt is null for links that predate
// rep history.
repController.get('/members/mine/past', authenticate, async (req, res) => {
	try {
		const userId = req.user!.id;
		const [closed, open] = await Promise.all([
			prisma.userRepTerm.findMany({
				where: { userId, endedAt: { not: null } },
				orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
				include: { member: true },
			}),
			prisma.userRepTerm.findMany({ where: { userId, endedAt: null }, select: { memberId: true } }),
		]);
		const current = new Set(open.map((t) => t.memberId));
		const seen = new Set<string>();
		const past = [];
		for (const term of closed) {
			if (current.has(term.memberId) || seen.has(term.memberId)) continue;
			seen.add(term.memberId);
			past.push({
				member: term.member,
				startedAt: term.startedAt,
				endedAt: term.endedAt,
				reason: term.endReason?.toLowerCase() ?? 'other',
			});
		}
		res.json(past);
	} catch (error) {
		console.error('Error fetching past members:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});
// "Past District Reps": everyone who has held the caller's current House seat
// (by district number) or their state's Senate seats, from congress.gov, back to
// COVERAGE_FROM_YEAR. Current holders excluded. See services/seatHistory.ts.
repController.get('/members/mine/district-history', authenticate, async (req, res) => {
	const user = await prisma.user.findUnique({
		where: { id: req.user!.id },
		select: {
			district: true,
			derivedState: true,
			state: true,
			members: { where: { currentMember: true }, select: { id: true } },
		},
	});
	if (!user) return res.status(404).json({ message: 'User not found' });

	const state = resolveState(user.derivedState) ?? resolveState(user.state);
	if (!state) {
		return res.json({ seats: { house: null, senate: null }, coverageFromYear: COVERAGE_FROM_YEAR, terms: [] });
	}
	const houseSeat: Seat | null =
		user.district === null
			? null
			: { chamber: 'House', stateCode: state.code, stateName: state.name, district: toCongressDistrict(user.district) };
	const senateSeat: Seat = { chamber: 'Senate', stateCode: state.code, stateName: state.name };
	const current = new Set(user.members.map((m) => m.id));

	try {
		const [house, senate] = await Promise.all([
			houseSeat ? getSeatHistory(houseSeat, current) : Promise.resolve([]),
			getSeatHistory(senateSeat, current),
		]);
		return res.json({
			seats: {
				house: houseSeat && houseSeat.chamber === 'House' ? { state: state.name, district: houseSeat.district } : null,
				senate: { state: state.name },
			},
			coverageFromYear: COVERAGE_FROM_YEAR,
			terms: [...house, ...senate].sort((a, b) => b.endCongress - a.endCongress || b.startCongress - a.startCongress),
		});
	} catch (error) {
		console.error('Error fetching district history:', error);
		return res.status(502).json({ message: 'Could not load seat history from congress.gov' });
	}
});
// Campaign-finance summary for a member (FEC data, cached server-side).
repController.get('/members/:bioguideId/donors', async (req, res) => {
	const { bioguideId } = req.params;
	try {
		const member = await prisma.member.findUnique({ where: { id: bioguideId } });
		const summary = await getDonorSummary(bioguideId, member?.chamber);
		if (!summary) {
			return res.status(404).json({ message: 'No FEC campaign-finance data found for this member' });
		}
		return res.status(200).json(summary);
	} catch (error) {
		console.error('Error fetching donor summary:', error);
		const message = error instanceof Error ? error.message : '';
		if (message.includes('FEC_API_KEY')) {
			return res.status(503).json({ message: 'Donor data is not configured on this server' });
		}
		return res.status(500).json({ message: 'Internal server error' });
	}
});
repController.get('/members/:bioguideId', async (req, res) => {
	const { bioguideId } = req.params;
	try {
		const rep = await prisma.member.findUnique({
			where: { id: bioguideId },
		});
		if (!rep) {
			return res.status(404).json({ message: 'Representative not found' });
		}
		return res.status(200).json(rep);
	} catch (error) {
		console.error('Error fetching representative:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});
repController.get('/members', async (req, res) => {
	// Default to the current roster (congress.gov ingest). Historical bill
	// sponsors live in the same table; pass ?all=true to include them.
	const includeAll = req.query.all === 'true';
	try {
		const reps = await prisma.member.findMany({
			where: includeAll ? undefined : { currentMember: true },
			orderBy: { name: 'asc' },
		});
		return res.status(200).json(reps);
	} catch (error) {
		console.error('Error fetching representatives:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

export { repController };
