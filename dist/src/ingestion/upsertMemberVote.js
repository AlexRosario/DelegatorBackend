"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMemberVote = upsertMemberVote;
async function upsertMemberVote(prisma, billId, sponsor) {
    return prisma.memberVote.upsert({
        where: {
            billId_bioguideId: {
                billId,
                bioguideId: sponsor.bioguideId,
            },
        },
        create: {
            billId,
            bioguideId: sponsor.bioguideId,
            vote: sponsor.vote ?? 'N/A',
            date: sponsor.voteDate ? new Date(sponsor.voteDate) : new Date(),
        },
        update: {
            vote: sponsor.vote ?? 'N/A',
            date: sponsor.voteDate ? new Date(sponsor.voteDate) : new Date(),
        },
    });
}
