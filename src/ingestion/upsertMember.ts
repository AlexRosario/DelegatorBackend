import { normalizeSponsor } from './normalizeSponsor';

export async function upsertMember(prisma: any, rawSponsor: any) {
	const sponsor = normalizeSponsor(rawSponsor);

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
