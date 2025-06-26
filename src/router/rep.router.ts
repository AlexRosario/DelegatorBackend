import { Router } from 'express';
import 'express-async-errors';
import prisma from '../../prisma/prisma';

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
repController.get('/members', async (_req, res) => {
	try {
		const reps = await prisma.member.findMany();
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
