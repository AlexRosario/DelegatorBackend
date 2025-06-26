import { NextFunction, Request, Response, Router } from 'express';
import prisma from '../../prisma/prisma';
import { validateRequest } from 'zod-express-middleware';
import { voteSchema, memberVoteSchema } from '../zod';
import { getDataFromToken } from '../utils/auth-utils';
import { JwtPayload } from 'jsonwebtoken';

const voteController = Router();

declare global {
	namespace Express {
		interface Request {
			user?: { id: number; username: string; zipcode: string };
		}
	}
}
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
	const token = req.headers.authorization?.split(' ')[1] || '';
	const data = getDataFromToken(token) as JwtPayload;
	if (!data) {
		return res.status(401).json({ message: 'Invalid Token' });
	}
	const userFromJwt = await prisma.user.findUnique({
		where: { username: data?.username },
	});

	if (!userFromJwt) {
		return res.status(401).json({ message: 'User not found' });
	}
	req.user = userFromJwt;
	next();
};
voteController.get('/votes', authenticate, async (req, res) => {
	try {
		const votes = await prisma.vote.findMany({
			where: { userId: req.user?.id },
		});

		return res.status(200).json(votes);
	} catch (error) {
		console.error('Error fetching votes:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

voteController.post('/votes', authenticate, validateRequest({ body: voteSchema }), async (req, res) => {
	const { billId, vote, date } = req.body;
	const userId = req.user?.id;

	if (!userId) {
		return res.status(401).json({ message: 'User not authenticated' });
	}
	try {
		const newVote = await prisma.vote.create({
			data: {
				userId,
				billId,
				vote,
				date: date as Date,
			},
		});

		res.status(201).json(newVote);
	} catch (error) {
		console.error('Error posting vote:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});
voteController.post('/member_votes', validateRequest({ body: memberVoteSchema }), async (req, res) => {
	const { bioguideId, billId, vote, date } = req.body;
	const existingVote = await prisma.memberVote.findFirst({
		where: {
			bioguideId,
			billId,
		},
	});
	if (existingVote) {
		return res.status(400).json({ message: 'Vote for this bill by this member already exists' });
	}
	try {
		const newVote = await prisma.memberVote.create({
			data: {
				bioguideId: bioguideId,
				billId,
				vote,
				date: date as Date,
			},
		});
		res.status(201).json(newVote);
	} catch (error) {
		console.error('Error posting vote:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

voteController.get('/member_votes/:bioguideId', async (req, res) => {
	const { bioguideId } = req.params;
	try {
		const memberVotes = await prisma.memberVote.findMany({
			where: { bioguideId },
		});

		res.status(200).json(memberVotes);
	} catch (error) {
		console.error('Error fetching member votes:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});
export { voteController };
