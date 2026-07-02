import prisma from '../../prisma/prisma';
import { getMember } from '../services/congressGovClient';
import { upsertRosterMember } from './upsertRosterMember';

export async function ingestMember(bioguideId: string) {
	const detail = await getMember(bioguideId);
	const member = detail.member;
	if (!member?.bioguideId) return;
	await upsertRosterMember(prisma, member);
}
