import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createUnsecuredInfo = (user: User) => {
	return {
		id: user.id,
		username: user.username,
		zipcode: user.zipcode,
	};
};

export const generateAccessToken = (user: { id: number; username: string; zipcode: string }) => {
	return jwt.sign(user, process.env.JWT_SECRET as string, {
		expiresIn: '1d',
	});
};

export const getDataFromToken = (token?: string) => {
	if (!token) {
		return null;
	}
	try {
		return jwt.verify(token, process.env.JWT_SECRET as string);
	} catch (error) {
		console.error('Token verification error:', error);
		return null;
	}
};
export const encryptPassword = async (password: string) => {
	const saltRounds = 11;
	return await bcrypt.hash(password, saltRounds);
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
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
