"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberVoteSchema = exports.voteSchema = exports.registerSchema = exports.loginSchema = void 0;
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
        memberIds: zod_1.z.array(zod_1.z.string()),
    })
        .required(),
};
exports.voteSchema = zod_1.z.object({
    billId: zod_1.z.string(),
    vote: zod_1.z.enum(['Yes', 'No']),
    date: zod_1.z.preprocess((val) => new Date(val), zod_1.z.instanceof(Date)),
});
exports.memberVoteSchema = zod_1.z.object({
    bioguideId: zod_1.z.string(),
    billId: zod_1.z.string(),
    vote: zod_1.z.enum(['Yea', 'Nay', 'Present', 'Not Voting']),
    date: zod_1.z.preprocess((val) => new Date(val), zod_1.z.instanceof(Date)),
});
