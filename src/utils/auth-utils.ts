import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PII stays server-side: no zipcode/district/address in anything the client
// stores. Features that need them (5Calls enrichment, CWC gating) read the
// user's row from the DB behind an authenticated route instead.
export const createUnsecuredInfo = (user: User) => {
	return {
		id: user.id,
		username: user.username,
		emailVerified: user.emailVerified,
	};
};

export const generateAccessToken = (user: { id: number; username: string }) => {
	// Sign ONLY the fields the token needs — a JWT is decodable base64, so
	// anything signed here is readable from localStorage. Identity only, no PII.
	return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
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

/** Session token: httpOnly cookie primarily (JS can't read it — XSS-proof),
 *  with Bearer-header fallback so pre-cookie clients keep working. */
export const tokenFromRequest = (req: Request): string =>
	(req as any).cookies?.token || req.headers.authorization?.split(' ')[1] || '';

/** Options for the session cookie (set at login, cleared at logout). */
export const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: 'lax' as const,
	// CLIENT_ORIGIN is https in prod, unset (http://localhost) in dev.
	secure: (process.env.CLIENT_ORIGIN ?? '').startsWith('https'),
	maxAge: 24 * 60 * 60 * 1000, // matches the JWT's 1d expiry
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
	const token = tokenFromRequest(req);
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
