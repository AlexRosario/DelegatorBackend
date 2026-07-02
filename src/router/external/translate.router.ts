import { Request, Response, Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import prisma from '../../../prisma/prisma';

const router = Router();

const TRANSLATION_MODEL = 'claude-opus-4-8';

// Construct lazily so a missing ANTHROPIC_API_KEY doesn't crash the whole server
// at boot — only translation requests fail (with a clear error) until it's set.
let _anthropic: Anthropic | null = null;
function getAnthropic() {
	if (!_anthropic) _anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env
	return _anthropic;
}

const SYSTEM_PROMPT =
	'You are a legal expert. Simplify the U.S. bill the user gives you and explain it as if to a 12-year-old, ' +
	'while preserving all the legal points and considerations. Use plain language and short paragraphs.';

/**
 * Payment gate — STUB. Wire to Stripe later: verify a PaymentIntent for this
 * bill's translation before allowing the (billable) LLM call. Returns true for
 * now so the flow works end-to-end; flip the default to require payment once
 * Stripe is connected.
 */
async function verifyTranslationPayment(_req: Request, _billId: string): Promise<boolean> {
	// TODO: confirm a successful charge for translating this bill.
	return true;
}

/** The text Claude translates: prefer the full bill text, fall back to the CRS summary. */
async function getBillSourceText(bill: { textVersionUrl: string | null; summary: string | null; title: string }) {
	if (bill.textVersionUrl) {
		try {
			const res = await fetch(bill.textVersionUrl);
			if (res.ok) {
				const $ = cheerio.load(await res.text());
				const text = ($('pre').text() || $('.billTextContent').text() || $('body').text()).trim();
				if (text) return text;
			}
		} catch {
			/* fall through to the summary */
		}
	}
	if (bill.summary) return cheerio.load(bill.summary).root().text().trim();
	return bill.title;
}

// Free: return the cached translation if this bill already has one.
router.get('/:billId', async (req: Request, res: Response) => {
	const bill = await prisma.bill.findUnique({
		where: { id: req.params.billId },
		select: { plainSummary: true, plainSummaryModel: true, plainSummaryAt: true },
	});
	if (!bill) return res.status(404).json({ error: 'Bill not found' });

	return res.json({
		cached: Boolean(bill.plainSummary),
		translation: bill.plainSummary ?? null,
		model: bill.plainSummaryModel ?? null,
		generatedAt: bill.plainSummaryAt ?? null,
	});
});

// Coalesces concurrent first-requests for the same bill onto ONE generation so we
// never make duplicate LLM calls (or charges). In-process — fine for a single
// server; a multi-instance deployment would want a DB/redis lock instead.
const inFlight = new Map<string, Promise<string>>();

/** Payment gate + LLM call + cache write. Runs at most once per uncached bill. */
async function generateAndStore(req: Request, billId: string, bill: { title: string; summary: string | null; textVersionUrl: string | null }) {
	if (!(await verifyTranslationPayment(req, billId))) {
		const err = new Error('Payment required to generate a translation') as Error & { status?: number };
		err.status = 402;
		throw err;
	}

	const sourceText = await getBillSourceText(bill);

	// Stream server-side so a long bill can't hit a request timeout.
	const stream = getAnthropic().messages.stream({
		model: TRANSLATION_MODEL,
		max_tokens: 16000,
		thinking: { type: 'adaptive' },
		system: SYSTEM_PROMPT,
		messages: [{ role: 'user', content: sourceText }],
	});
	const message = await stream.finalMessage();
	const translation = message.content
		.filter((block): block is Anthropic.TextBlock => block.type === 'text')
		.map((block) => block.text)
		.join('\n');

	// Cache on the bill so every future reader gets it free.
	await prisma.bill.update({
		where: { id: billId },
		data: { plainSummary: translation, plainSummaryModel: TRANSLATION_MODEL, plainSummaryAt: new Date() },
	});
	return translation;
}

// Paid: generate the translation once, store it on the bill, and return it.
// If it already exists (or is being generated), return that copy — no extra call.
router.post('/:billId', async (req: Request, res: Response) => {
	const { billId } = req.params;

	const bill = await prisma.bill.findUnique({
		where: { id: billId },
		select: { id: true, title: true, summary: true, textVersionUrl: true, plainSummary: true },
	});
	if (!bill) return res.status(404).json({ error: 'Bill not found' });

	// Already translated → free, no LLM call.
	if (bill.plainSummary) {
		return res.json({ translation: bill.plainSummary, cached: true });
	}

	// Claim the in-flight slot SYNCHRONOUSLY (no await between get and set) so two
	// concurrent requests can't both become generators. The winner runs the
	// payment gate + LLM call; losers await its result for free.
	let generating = inFlight.get(billId);
	const isGenerator = !generating;
	if (isGenerator) {
		generating = generateAndStore(req, billId, bill);
		inFlight.set(billId, generating);
		generating.finally(() => inFlight.delete(billId)).catch(() => {}); // clear on settle; swallow to avoid unhandled rejection
	}

	try {
		const translation = await generating!;
		return res.json({ translation, cached: !isGenerator });
	} catch (error) {
		if ((error as { status?: number })?.status === 402) {
			return res.status(402).json({ error: 'Payment required to generate a translation' });
		}
		console.error('Translation failed:', error);
		return res.status(500).json({ error: 'Translation failed' });
	}
});

export default router;
