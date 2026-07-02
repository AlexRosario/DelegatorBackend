"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestMember = ingestMember;
const prisma_1 = __importDefault(require("../../prisma/prisma"));
const congressGovClient_1 = require("../services/congressGovClient");
const upsertRosterMember_1 = require("./upsertRosterMember");
async function ingestMember(bioguideId) {
    const detail = await (0, congressGovClient_1.getMember)(bioguideId);
    const member = detail.member;
    if (!member?.bioguideId)
        return;
    await (0, upsertRosterMember_1.upsertRosterMember)(prisma_1.default, member);
}
