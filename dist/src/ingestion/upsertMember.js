"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMember = upsertMember;
const normalizeSponsor_1 = require("./normalizeSponsor");
async function upsertMember(prisma, rawSponsor) {
    const sponsor = (0, normalizeSponsor_1.normalizeSponsor)(rawSponsor);
    return prisma.member.upsert({
        where: { id: sponsor.id },
        create: {
            id: sponsor.id,
            name: sponsor.name,
            party: sponsor.party,
            state: sponsor.state,
            district: sponsor.district,
            phone: sponsor.phone,
            photoURL: sponsor.photoURL,
            reason: sponsor.reason,
            area: sponsor.area,
            url: sponsor.url,
            source: 'congressgov',
            // currentMember left at default false — the roster ingest is the sole
            // writer that promotes a member to currentMember=true.
        },
        // Create-if-missing only. The roster (upsertRosterMember) owns these fields
        // for current members; doing nothing on update avoids clobbering richer
        // roster/5Calls data with a sponsor's partial record.
        update: {},
    });
}
