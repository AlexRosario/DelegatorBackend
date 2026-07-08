import { Router } from 'express';
import 'express-async-errors';
import crypto from 'crypto';
import { loginSchema, registerSchema } from '../zodSchema';
import { encryptPassword } from '../utils/auth-utils';
import { validateRequest } from 'zod-express-middleware';
import bcrypt from 'bcrypt';
import { generateAccessToken, createUnsecuredInfo } from '../utils/auth-utils';
import prisma from '../../prisma/prisma';
import { resolveDelegation } from '../services/districtResolver';
import { sendVerificationEmail } from '../services/emailProvider';
const authController = Router();

authController.post('/auth/register', validateRequest(registerSchema), async (req, res) => {
	const { email, username, password, address } = req.body;

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		return res.status(409).json({ message: 'Account with that email already exists in record' });
	}

	const existingUsername = await prisma.user.findUnique({
		where: { username },
	});
	if (existingUsername) {
		return res.status(409).json({
			message: `Username ${username} already exists. Pick another username`,
		});
	}

	// Server-side delegation resolution: Census district + our roster is the
	// single source of truth (the frontend pre-validates the address against
	// /location/verify, so an unresolved signup here means a transient Census
	// failure — the nightly reconcile worker retries those).
	const delegation = await resolveDelegation(address);
	const memberIds = delegation?.memberIds ?? [];
	const verificationSource = delegation && memberIds.length > 0 ? 'census+roster' : 'unresolved';
	if (verificationSource === 'unresolved') {
		console.warn(`[register] Census resolution failed for ${username}; delegation deferred to reconcile`);
	}

	const emailVerifyToken = crypto.randomBytes(32).toString('hex');

	const newUser = await prisma.user.create({
		data: {
			email,
			username,
			passwordHash: await encryptPassword(password),
			street: address.street,
			city: address.city,
			state: address.state,
			zipcode: address.zipcode,
			district: delegation?.resolution.district ?? null,
			derivedState: delegation?.resolution.state ?? null,
			delegationVerifiedAt: delegation ? new Date() : null,
			verificationSource,
			attestedAt: new Date(), // schema requires attest === true to reach here
			emailVerifyToken,
			members: {
				connect: memberIds.map((id: string) => ({ id })),
			},
		},
	});
	if (!newUser) {
		return res.status(500).json({ message: 'User creation failed' });
	}

	// Fire-and-forget: a failed email must not fail the signup.
	sendVerificationEmail(email, emailVerifyToken).catch((err) =>
		console.error('Verification email failed:', err)
	);

	return res.status(201).json({
		message: 'User created successfully',
		userId: newUser.id,
		district: delegation?.resolution.district ?? null,
		state: delegation?.resolution.state ?? null,
		matchedAddress: delegation?.resolution.matchedAddress ?? null,
		verificationSource,
	});
});

// Email verification link target (from the signup email).
authController.get('/auth/verify-email', async (req, res) => {
	const token = String(req.query.token ?? '');
	if (!token) return res.status(400).send('Missing token');

	const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
	if (!user) return res.status(400).send('Invalid or already-used verification link');

	await prisma.user.update({
		where: { id: user.id },
		data: { emailVerified: true, emailVerifyToken: null },
	});
	return res.send('Email verified — you can close this tab and return to Delegator.');
});

authController.get('/logout', async (_req, res) => {
	// Tokens are stored client-side; the server has no session to clear. The
	// client should drop its token/user on logout. (Previously this called
	// `localStorage`, which is undefined in Node and threw on every request.)
	res.status(200).json({ message: 'Logout successful' });
});

authController.post('/auth/login', validateRequest(loginSchema), async (req, res) => {
	const { username, password } = req.body;
	const user = await prisma.user.findUnique({
		where: { username },
	});
	if (!user) {
		return res.status(404).json({ message: 'User not found ' });
	}
	const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
	if (!isPasswordValid) {
		return res.status(401).json({ message: 'Invalid credentials' });
	}

	const userInfo = createUnsecuredInfo(user);
	const token = generateAccessToken(user);

	return res.status(200).json({
		token,
		userInfo,
	});
});

export { authController };
