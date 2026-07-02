import { normalizeMember } from './normalizeMember';

// The roster (congress.gov) is the SOLE writer of these core member fields, so
// update writes them all. It deliberately never touches 5Calls-owned data
// (reason, area, fieldOffices) — those have a different writer.
export async function upsertRosterMember(prisma: any, rawMember: any) {
	const m = normalizeMember(rawMember);

	const data = {
		name: m.name,
		firstName: m.firstName,
		lastName: m.lastName,
		party: m.party,
		state: m.state,
		district: m.district,
		chamber: m.chamber,
		phone: m.phone,
		officeAddress: m.officeAddress,
		photoURL: m.photoURL,
		url: m.url,
		currentMember: true,
		source: 'congressgov',
	};

	return prisma.member.upsert({
		where: { id: m.id },
		create: { id: m.id, ...data },
		update: data,
	});
}
