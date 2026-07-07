"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberVoteSchema = exports.commentSchema = exports.voteSchema = exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = {
    body: zod_1.z.object({
        username: zod_1.z.string().min(3),
        password: zod_1.z.string().min(6),
    }),
};
exports.registerSchema = {
    body: zod_1.z
        .object({
        username: zod_1.z.string().min(3),
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(8),
        address: zod_1.z
            .object({
            street: zod_1.z.string().min(1),
            city: zod_1.z.string().min(1),
            state: zod_1.z.string().min(1),
            zipcode: zod_1.z.string().regex(/^\d{5}(-\d{4})?$/, {
                message: 'Invalid US zipcode format',
            }),
        })
            .required(),
        // Advisory only — the server derives the real delegation from the Census
        // district + our roster; these (from 5Calls) are kept as a cross-check.
        memberIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
        // Constituent self-attestation is required (CWC anti-astroturf posture).
        attest: zod_1.z.literal(true, {
            errorMap: () => ({ message: 'You must attest that you reside at this address' }),
        }),
    })
        .required(),
};
exports.voteSchema = zod_1.z.object({
    billId: zod_1.z.string(),
    vote: zod_1.z.enum(['Yes', 'No']),
    date: zod_1.z.preprocess((val) => new Date(val), zod_1.z.instanceof(Date)),
});
exports.commentSchema = zod_1.z.object({
    body: zod_1.z.string().trim().min(1).max(2000),
});
exports.memberVoteSchema = zod_1.z.object({
    bioguideId: zod_1.z.string(),
    billId: zod_1.z.string(),
    vote: zod_1.z.enum(['Yea', 'Nay', 'Present', 'Not Voting']),
    date: zod_1.z.preprocess((val) => new Date(val), zod_1.z.instanceof(Date)),
});
