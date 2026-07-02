"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteController = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../../prisma/prisma"));
const zod_express_middleware_1 = require("zod-express-middleware");
const zodSchema_1 = require("../zodSchema");
const auth_utils_1 = require("../utils/auth-utils");
const voteController = (0, express_1.Router)();
exports.voteController = voteController;
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || '';
    const data = (0, auth_utils_1.getDataFromToken)(token);
    if (!data) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
    const userFromJwt = await prisma_1.default.user.findUnique({
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
        const votes = await prisma_1.default.vote.findMany({
            where: { userId: req.user?.id },
        });
        return res.status(200).json(votes);
    }
    catch (error) {
        console.error('Error fetching votes:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
voteController.post('/votes', authenticate, (0, zod_express_middleware_1.validateRequest)({ body: zodSchema_1.voteSchema }), async (req, res) => {
    const { billId, vote, date } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
    }
    try {
        const newVote = await prisma_1.default.vote.create({
            data: {
                userId,
                billId,
                vote,
                date: date,
            },
        });
        res.status(201).json(newVote);
    }
    catch (error) {
        console.error('Error posting vote:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
voteController.post('/member_votes', (0, zod_express_middleware_1.validateRequest)({ body: zodSchema_1.memberVoteSchema }), async (req, res) => {
    const { bioguideId, billId, vote, date } = req.body;
    const existingVote = await prisma_1.default.memberVote.findFirst({
        where: {
            bioguideId,
            billId,
        },
    });
    if (existingVote) {
        return res.status(400).json({ message: 'Vote for this bill by this member already exists' });
    }
    try {
        const newVote = await prisma_1.default.memberVote.create({
            data: {
                bioguideId: bioguideId,
                billId,
                vote,
                date: date,
            },
        });
        res.status(201).json(newVote);
    }
    catch (error) {
        console.error('Error posting vote:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
voteController.get('/member_votes/:bioguideId', async (req, res) => {
    const { bioguideId } = req.params;
    try {
        const memberVotes = await prisma_1.default.memberVote.findMany({
            where: { bioguideId },
        });
        res.status(200).json(memberVotes);
    }
    catch (error) {
        console.error('Error fetching member votes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
