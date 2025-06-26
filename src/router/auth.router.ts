import { Router } from 'express';
import 'express-async-errors';
import { loginSchema, registerSchema } from '../zod';
import { encryptPassword } from '../utils/auth-utils';
import { validateRequest } from 'zod-express-middleware';
import bcrypt from 'bcrypt';
import { generateAccessToken, createUnsecuredInfo } from '../utils/auth-utils';
import prisma from '../../prisma/prisma';
const authController = Router();

authController.post('/auth/register', validateRequest(registerSchema), async (req, res) => {
	const { email, username, password, address, memberIds } = req.body;
	console.log('Registering user with email:', email, 'and username:', username);

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

	const newUser = await prisma.user.create({
		data: {
			email,
			username,
			passwordHash: await encryptPassword(password),
			street: address.street,
			city: address.city,
			state: address.state,
			zipcode: address.zipcode,
			members: {
				connect: memberIds.map((id) => ({ id })),
			},
		},
	});
	if (!newUser) {
		return res.status(500).json({ message: 'User creation failed' });
	}

	return res.status(201).json({ message: 'User created successfully', userId: newUser.id });
});

authController.get('/logout', async (_req, res) => {
	localStorage.removeItem('token');
	localStorage.removeItem('user');
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
