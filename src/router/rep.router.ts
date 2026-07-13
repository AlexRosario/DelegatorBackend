import { Router } from 'express';
import 'express-async-errors';
import prisma from '../../prisma/prisma';
import { getDonorSummary } from '../services/donorService';

const repController = Router();

repController.get('/members/test', (_req, res) => {
	res.send('repController works!');
});
repController.get('/members/by-user/:userId', async (req, res) => {
	const userId = parseInt(req.params.userId);
	console.log('Fetching members for user ID:', userId);

	try {
		const userWithMembers = await prisma.user.findUnique({
			where: { id: userId },
			include: { members: true },
		});

		if (!userWithMembers) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.json(userWithMembers.members); // just return the members
	} catch (error) {
		console.error('Error fetching members by user:', error);
		res.status(500).json({ message: 'Internal server error' });
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

repController.post('/members', async (req, res) => {
	const { id, name, phone, url, photoURL, party, state, district, reason, area, fieldOffices } = req.body;
	try {
		const existingMember = await prisma.member.findUnique({ where: { id } });

		if (existingMember) {
			return res.status(200).json(existingMember);
		}
		// Fallback create: a 5Calls rep not (yet) in the congress.gov roster. Tag
		// it accordingly; the daily roster ingest will enrich/own it if present there.
		const newRep = await prisma.member.create({
			data: {
				id,
				name,
				phone,
				url,
				photoURL,
				party,
				state,
				district: district ?? null, // optional, since senators don't have it
				reason,
				area,
				source: 'fivecalls',
				currentMember: false,
				fieldOffices: fieldOffices ? { create: fieldOffices } : undefined,
			},
		});
		return res.status(201).json(newRep);
	} catch (error) {
		console.error('Error creating representative:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

export { repController };
