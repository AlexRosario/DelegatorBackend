/**
 * bioguide → FEC candidate ID bridge, via the unitedstates/congress-legislators
 * dataset (the standard public mapping; congress.gov itself doesn't carry FEC ids).
 * A member can have several FEC ids — one per office sought (H…/S…/P…).
 */
const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // roster churn is slow; daily is plenty

let cache: { map: Map<string, string[]>; fetchedAt: number } | null = null;

async function loadMap(): Promise<Map<string, string[]>> {
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.map;

	const res = await fetch(LEGISLATORS_URL);
	if (!res.ok) {
		// Serve stale data over failing hard — the mapping barely changes.
		if (cache) return cache.map;
		throw new Error(`congress-legislators fetch failed: ${res.status}`);
	}
	const legislators: any[] = await res.json();

	const map = new Map<string, string[]>();
	for (const leg of legislators) {
		const bioguide = leg?.id?.bioguide;
		const fec = leg?.id?.fec;
		if (bioguide && Array.isArray(fec) && fec.length > 0) map.set(bioguide, fec);
	}
	cache = { map, fetchedAt: Date.now() };
	return map;
}

/** FEC candidate ids for a sitting member, or null if unmapped (rare: ~1/536). */
export async function getFecCandidateIds(bioguideId: string): Promise<string[] | null> {
	const map = await loadMap();
	return map.get(bioguideId) ?? null;
}
