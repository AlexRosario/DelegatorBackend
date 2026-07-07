import prisma from '../../prisma/prisma';

/**
 * Constituent → district → delegation resolution.
 *
 * The Census Bureau geocoder is the authoritative (and free, key-less) source
 * for which congressional district an address is in; our congress.gov roster
 * then supplies the members for that district/state. 5Calls (client-side, at
 * signup) becomes an advisory cross-check rather than the source of truth —
 * ZIP codes straddle district lines, so ZIP-based mapping misassigns ~1 in 5.
 */

// Census returns state as a FIPS code; our roster stores full state names.
const FIPS_TO_STATE: Record<string, string> = {
	'01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
	'08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
	'12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois',
	'18': 'Indiana', '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana',
	'23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
	'28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada',
	'33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
	'37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon',
	'42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
	'47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia',
	'53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
	'60': 'American Samoa', '66': 'Guam', '69': 'Northern Mariana Islands',
	'72': 'Puerto Rico', '78': 'Virgin Islands',
};

export type DistrictResolution = {
	matchedAddress: string; // Census-standardized form of what the user typed
	state: string; // full state name (matches our roster)
	district: number; // 0 = at-large; 98 = non-voting delegate districts (DC etc.)
	source: 'census';
};

/** Resolve an address to its congressional district via the Census geocoder. */
export async function resolveDistrict(oneLineAddress: string): Promise<DistrictResolution | null> {
	const url =
		'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress' +
		`?address=${encodeURIComponent(oneLineAddress)}` +
		'&benchmark=Public_AR_Current&vintage=Current_Current&layers=54&format=json';

	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const data: any = await res.json();
		const match = data?.result?.addressMatches?.[0];
		if (!match) return null;

		// The layer name is congress-numbered (e.g. "119th Congressional Districts") —
		// find it by suffix so a new congress doesn't break resolution.
		const geographies = match.geographies ?? {};
		const layerKey = Object.keys(geographies).find((k) => k.endsWith('Congressional Districts'));
		const cd = layerKey ? geographies[layerKey]?.[0] : undefined;
		if (!cd) return null;

		const state = FIPS_TO_STATE[cd.STATE];
		const districtField = Object.keys(cd).find((k) => /^CD\d+$/.test(k)); // CD119, CD120, …
		const district = districtField ? Number(cd[districtField]) : NaN;
		if (!state || Number.isNaN(district)) return null;

		return { matchedAddress: match.matchedAddress, state, district, source: 'census' };
	} catch (err) {
		console.error('Census district resolution failed:', err);
		return null;
	}
}

export type DelegationResult = {
	resolution: DistrictResolution;
	memberIds: string[]; // house rep (if seated) + senators
	houseRepId: string | null;
	senatorIds: string[];
};

/** Resolve an address to its current members using the Census district + our roster. */
export async function resolveDelegation(address: {
	street: string;
	city: string;
	state: string;
	zipcode: string;
}): Promise<DelegationResult | null> {
	const oneLine = `${address.street}, ${address.city}, ${address.state} ${address.zipcode}`;
	const resolution = await resolveDistrict(oneLine);
	if (!resolution) return null;

	const [houseRep, senators] = await Promise.all([
		prisma.member.findFirst({
			where: { currentMember: true, chamber: 'House', state: resolution.state, district: resolution.district },
		}),
		prisma.member.findMany({
			where: { currentMember: true, chamber: 'Senate', state: resolution.state },
		}),
	]);

	return {
		resolution,
		houseRepId: houseRep?.id ?? null, // null = vacant seat or roster gap — not an error
		senatorIds: senators.map((s) => s.id),
		memberIds: [houseRep?.id, ...senators.map((s) => s.id)].filter((id): id is string => Boolean(id)),
	};
}
