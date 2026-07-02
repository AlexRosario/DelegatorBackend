// Maps a congress.gov /member detail object → our Member roster fields.
// Distinct from normalizeSponsor.ts, which handles the bill-sponsor shape.

function termList(terms: any): any[] {
	return Array.isArray(terms) ? terms : terms?.item ?? [];
}

/** Most recent term wins (senators/representatives can have many). */
function latestTerm(terms: any): any {
	return [...termList(terms)].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0)).pop() ?? {};
}

function normalizeChamber(chamber?: string): string | null {
	if (!chamber) return null;
	if (/senate/i.test(chamber)) return 'Senate';
	if (/house/i.test(chamber)) return 'House';
	return chamber;
}

/** Canonical single-letter party code (D/R/I) — stable regardless of source wording. */
function toPartyCode(raw?: string): string {
	if (!raw) return '';
	const v = raw.trim().toLowerCase();
	if (v === 'd' || v.startsWith('democrat')) return 'D'; // Democrat / Democratic
	if (v === 'r' || v.startsWith('republican')) return 'R';
	if (v === 'i' || v.startsWith('independent')) return 'I';
	return raw.trim().charAt(0).toUpperCase();
}

/** Current party from partyHistory (prefer abbreviation; fallback to flat partyName). */
function latestParty(member: any): string {
	const hist = member.partyHistory;
	if (Array.isArray(hist) && hist.length) {
		const latest = [...hist].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0)).pop();
		return toPartyCode(latest?.partyAbbreviation ?? latest?.partyName);
	}
	return toPartyCode(member.partyName ?? member.partyAbbreviation);
}

function composeOfficeAddress(addr: any): string | null {
	if (!addr) return null;
	const parts = [addr.officeAddress, addr.city, addr.district, addr.zipCode].filter(Boolean);
	return parts.length ? parts.join(', ') : null;
}

export function normalizeMember(member: any) {
	const term = latestTerm(member.terms);
	const name =
		member.directOrderName ??
		[member.firstName, member.lastName].filter(Boolean).join(' ') ??
		member.invertedOrderName ??
		'Unknown';

	return {
		id: member.bioguideId,
		name,
		firstName: member.firstName ?? null,
		lastName: member.lastName ?? null,
		party: latestParty(member),
		state: member.state ?? term.stateName ?? '',
		district: member.district ?? term.district ?? null,
		chamber: normalizeChamber(term.chamber),
		phone: member.addressInformation?.phoneNumber ?? '',
		officeAddress: composeOfficeAddress(member.addressInformation),
		photoURL: member.depiction?.imageUrl ?? '',
		url: member.officialWebsiteUrl ?? '',
	};
}
