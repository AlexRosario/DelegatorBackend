"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const express_1 = require("express");
require("express-async-errors");
const zodSchema_1 = require("../zodSchema");
const auth_utils_1 = require("../utils/auth-utils");
const zod_express_middleware_1 = require("zod-express-middleware");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_utils_2 = require("../utils/auth-utils");
const prisma_1 = __importDefault(require("../../prisma/prisma"));
const authController = (0, express_1.Router)();
exports.authController = authController;
authController.post('/auth/register', (0, zod_express_middleware_1.validateRequest)(zodSchema_1.registerSchema), async (req, res) => {
    const { email, username, password, address, memberIds } = req.body;
    console.log('Registering user with email:', email, 'and username:', username);
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
    const newUser = await prisma_1.default.user.create({
        data: {
            email,
            username,
            passwordHash: await (0, auth_utils_1.encryptPassword)(password),
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
    // Tokens are stored client-side; the server has no session to clear. The
    // client should drop its token/user on logout. (Previously this called
    // `localStorage`, which is undefined in Node and threw on every request.)
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
    return res.status(200).json({
        token,
        userInfo,
    });
});
