export function normalizeSponsor(sponsor: any) {
	const name =
		sponsor.name ?? sponsor.fullName ?? [sponsor.firstName, sponsor.lastName].filter(Boolean).join(' ') ?? 'Unknown';

	return {
		id: sponsor.bioguideId,
		name,
		party: sponsor.party ?? '',
		state: sponsor.state ?? '',
		district: sponsor.district ?? null,
		phone: sponsor.phone ?? '',
		photoURL: sponsor.imageUrl ?? '',
		reason: '',
		area: sponsor.state ?? '',
		url: sponsor.url ?? '',
	};
}
