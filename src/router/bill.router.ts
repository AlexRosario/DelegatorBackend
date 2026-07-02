import { Router } from 'express';
import 'express-async-errors';
import prisma from '../../prisma/prisma';
import { getFullBill, getBillSummaries, getBillSubjects, getBillTextVersions, getBillActions } from '../services/congressGovClient';

const billController = Router();

/**
 * Map a stored Bill row into the congress.gov-ish shape the frontend already
 * consumes, so the app can read pre-assembled bills from our DB instead of
 * fanning out to the live proxy per bill.
 */
function serializeBill(row: any) {
	const subjectNames: string[] = Array.isArray(row.subjects) ? row.subjects : [];
	return {
		id: row.id,
		type: row.billType,
		number: row.billNumber,
		congress: row.congress,
		title: row.title,
		summary: row.summary ?? 'No Summary Available',
		plainSummary: row.plainSummary ?? null, // cached Claude translation, if any
		stage: row.stage ?? null,
		introducedDate: row.introducedDate ?? null,
		originChamber: row.originChamber ?? row.chamber ?? null,
		originChamberCode: row.chamber === 'Senate' ? 'S' : row.chamber === 'House' ? 'H' : null,
		url: row.congressGovUrl ?? null,
		latestAction: {
			text: row.latestActionText ?? row.status ?? '',
			actionDate: row.latestActionDate ?? null,
		},
		// Frontend reads bill.subjects.legislativeSubjects (BillCollection.tsx).
		subjects: { legislativeSubjects: subjectNames.map((name) => ({ name })) },
		// Stored raw from congress.gov — already carries recordedVotes for vote-alignment.
		actions: Array.isArray(row.actions) ? row.actions : [],
		policyArea: row.policyArea ? { name: row.policyArea } : null,
		cosponsors: { count: row.cosponsorCount ?? 0 },
		sponsors: row.sponsor ? [row.sponsor] : [],
		textVersions: row.textVersionUrl ? { count: 1, url: row.textVersionUrl } : undefined,
	};
}

/**
 * Single source of bills for the frontend — served from our DB (populated by the
 * daily ingest), pre-assembled so there's no per-bill congress.gov fan-out.
 *
 * GET /bills?congress=119&billType=hr&policyArea=Energy&q=energy&limit=20&offset=0
 */
billController.get('/bills', async (req, res) => {
	const { congress, billType, policyArea, q } = req.query;
	const take = Math.min(Number(req.query.limit ?? 20), 100);
	const skip = Number(req.query.offset ?? 0);

	const where: any = {};
	if (congress) where.congress = Number(congress);
	if (billType) where.billType = String(billType).toLowerCase();
	if (policyArea) where.policyArea = String(policyArea);
	if (q) where.title = { contains: String(q) };

	try {
		const [bills, total] = await Promise.all([
			prisma.bill.findMany({
				where,
				orderBy: { latestActionDate: 'desc' },
				take,
				skip,
				include: { sponsor: true },
			}),
			prisma.bill.count({ where }),
		]);

		return res.status(200).json({ total, limit: take, offset: skip, bills: bills.map(serializeBill) });
	} catch (error) {
		console.error('Error fetching bills:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

/** Assemble a bill from congress.gov when it isn't in our DB yet (coverage gap). */
async function assembleFromCongress(id: string) {
	const m = id.match(/^(\d+)-([a-z]+)-(\w+)$/i);
	if (!m) return null;
	const [, congress, billType, billNumber] = m;
	const ref = { congress, billType: billType.toLowerCase(), billNumber };

	let detail: any;
	try {
		detail = await getFullBill(ref);
	} catch {
		return null; // congress.gov 404/error — bill not found
	}
	const bill = detail.bill;
	if (!bill) return null;

	const [summaries, subjects, , actions] = await Promise.all([
		getBillSummaries(ref).catch(() => []),
		getBillSubjects(ref).catch(() => ({ legislativeSubjects: [] })),
		getBillTextVersions(ref).catch(() => []),
		getBillActions(ref).catch(() => []),
	]);
	const latestSummary = summaries[summaries.length - 1];

	return {
		id,
		type: bill.type,
		number: bill.number,
		congress: Number(bill.congress),
		title: bill.title,
		summary: latestSummary?.text ?? 'No Summary Available',
		stage: null,
		introducedDate: bill.introducedDate ?? null,
		originChamber: bill.originChamber ?? null,
		url: bill.legislationUrl ?? null,
		latestAction: bill.latestAction ?? { text: '', actionDate: null },
		subjects: { legislativeSubjects: subjects.legislativeSubjects ?? [] },
		actions,
		policyArea: bill.policyArea ?? null,
		cosponsors: bill.cosponsors ?? { count: 0 },
		sponsors: bill.sponsors ?? [],
		textVersions: bill.textVersions ?? undefined,
	};
}

billController.get('/bills/:id', async (req, res) => {
	try {
		const row = await prisma.bill.findUnique({
			where: { id: req.params.id },
			include: { sponsor: true },
		});
		if (row) {
			return res.status(200).json(serializeBill(row));
		}

		// Not ingested yet — fall back to the live proxy so arbitrary lookups work.
		const assembled = await assembleFromCongress(req.params.id);
		if (!assembled) {
			return res.status(404).json({ message: 'Bill not found' });
		}
		return res.status(200).json(assembled);
	} catch (error) {
		console.error('Error fetching bill:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

export { billController };
