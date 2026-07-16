"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const express_1 = require("express");
require("express-async-errors");
const crypto_1 = __importDefault(require("crypto"));
const zodSchema_1 = require("../zodSchema");
const auth_utils_1 = require("../utils/auth-utils");
const zod_express_middleware_1 = require("zod-express-middleware");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_utils_2 = require("../utils/auth-utils");
const prisma_1 = __importDefault(require("../../prisma/prisma"));
const districtResolver_1 = require("../services/districtResolver");
const emailProvider_1 = require("../services/emailProvider");
const authController = (0, express_1.Router)();
exports.authController = authController;
authController.post('/auth/register', (0, zod_express_middleware_1.validateRequest)(zodSchema_1.registerSchema), async (req, res) => {
    const { email, username, password, address } = req.body;
    const existing = await prisma_1.default.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ message: 'Account with that email already exists in record' });
    }
    const existingUsername = await prisma_1.default.user.findUnique({
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
    const delegation = await (0, districtResolver_1.resolveDelegation)(address);
    const memberIds = delegation?.memberIds ?? [];
    const verificationSource = delegation && memberIds.length > 0 ? 'census+roster' : 'unresolved';
    if (verificationSource === 'unresolved') {
        console.warn(`[register] Census resolution failed for ${username}; delegation deferred to reconcile`);
    }
    const emailVerifyToken = crypto_1.default.randomBytes(32).toString('hex');
    const newUser = await prisma_1.default.user.create({
        data: {
            email,
            username,
            passwordHash: await (0, auth_utils_1.encryptPassword)(password),
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
                connect: memberIds.map((id) => ({ id })),
            },
        },
    });
    if (!newUser) {
        return res.status(500).json({ message: 'User creation failed' });
    }
    // Fire-and-forget: a failed email must not fail the signup.
    (0, emailProvider_1.sendVerificationEmail)(email, emailVerifyToken).catch((err) => console.error('Verification email failed:', err));
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
    if (!token)
        return res.status(400).send('Missing token');
    const user = await prisma_1.default.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user)
        return res.status(400).send('Invalid or already-used verification link');
    await prisma_1.default.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifyToken: null },
    });
    return res.send('Email verified — you can close this tab and return to Delegator.');
});
authController.get('/logout', async (_req, res) => {
    // The session rides in an httpOnly cookie — clearing it here is the logout.
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    res.status(200).json({ message: 'Logout successful' });
});
authController.post('/auth/login', (0, zod_express_middleware_1.validateRequest)(zodSchema_1.loginSchema), async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma_1.default.user.findUnique({
        where: { username },
    });
    if (!user) {
        return res.status(404).json({ message: 'User not found ' });
    }
    const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const userInfo = (0, auth_utils_2.createUnsecuredInfo)(user);
    const token = (0, auth_utils_2.generateAccessToken)(user);
    // The JWT lives ONLY in an httpOnly cookie: the browser attaches it to API
    // calls automatically, and page scripts can never read it (XSS containment).
    res.cookie('token', token, auth_utils_2.SESSION_COOKIE_OPTIONS);
    return res.status(200).json({ userInfo });
});
