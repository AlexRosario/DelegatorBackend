import { Router } from 'express';
import 'express-async-errors';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';
import prisma from '../../prisma/prisma';
import { authenticate } from '../utils/auth-utils';

const contactController = Router();

const contactMessageSchema = z.object({
	bioguideId: z.string().min(1),
	billId: z.string().min(1),
	body: z.string().trim().min(1).max(10000),
});

/**
 * THE CWC VERIFICATION GATE — the policy that makes us an honest vendor,
 * as code. A message may only be recorded (and later, delivered) when:
 *  1. the sender is authenticated,
 *  2. their email is verified (they control a real inbox),
 *  3. their district was Census-verified (they are a real constituent),
 *  4. the target member is actually IN their delegation.
 */
contactController.post('/contact/messages', authenticate, validateRequest({ body: contactMessageSchema }), async (req, res) => {
	const user = await prisma.user.findUnique({
		where: { id: req.user!.id },
		include: { members: { select: { id: true } } },
	});
	if (!user) return res.status(401).json({ message: 'User not found' });

	if (!user.emailVerified) {
		return res.status(403).json({ code: 'email_unverified', message: 'Verify your email before contacting members.' });
	}
	if (!user.verificationSource?.startsWith('census')) {
		return res.status(403).json({
			code: 'district_unverified',
			message: 'Your address has not been verified to a congressional district yet.',
		});
	}
	if (!user.members.some((m) => m.id === req.body.bioguideId)) {
		return res.status(403).json({ code: 'not_constituent', message: 'That member is not in your delegation.' });
	}

	const bill = await prisma.bill.findUnique({ where: { id: req.body.billId }, select: { id: true } });
	if (!bill) return res.status(404).json({ message: 'Bill not found' });

	const message = await prisma.contactMessage.create({
		data: {
			userId: user.id,
			bioguideId: req.body.bioguideId,
			billId: req.body.billId,
			body: req.body.body,
			deliveryMethod: 'draft-copy', // becomes "cwc"/"scwc" when direct delivery lands
		},
	});

	return res.status(201).json({ id: message.id, deliveryMethod: message.deliveryMethod, createdAt: message.createdAt });
});

/** Aggregate: how many constituents contacted each member about a bill (public counts only). */
contactController.get('/bills/:id/contact-counts', async (req, res) => {
	const counts = await prisma.contactMessage.groupBy({
		by: ['bioguideId'],
		where: { billId: req.params.id },
		_count: { _all: true },
	});
	return res.json({
		billId: req.params.id,
		counts: counts.map((c) => ({ bioguideId: c.bioguideId, messages: c._count._all })),
	});
});

export { contactController };
