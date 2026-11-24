import 'dotenv/config'; // load env before any module that reads process.env at import time
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { authController } from './src/router/auth.router';
import { voteController } from './src/router/vote.router';
import { repController } from './src/router/rep.router';
import { billController } from './src/router/bill.router';
import { contactController } from './src/router/contact.router';
import { wireController } from './src/router/wire.router';
import { runDailyBillIngest } from './src/workers/dailyBillIngest';
import { runDailyMemberIngest } from './src/workers/dailyMemberIngest';
import { runDelegationReconcile } from './src/workers/reconcileDelegations';
import { runWireSync } from './src/workers/wireSync';
import { runWireIngest } from './src/workers/wireIngest';
import prisma from './prisma/prisma';

import locationRoutes from './src/router/location.router';
import fiveCallsRoutes from './src/router/external/fivecalls.router';
import translateRoutes from './src/router/external/translate.router';

const app = express();

// CLIENT_ORIGIN is the canonical frontend URL; its www. variant is accepted too
// so www visitors aren't silently CORS-blocked.
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const allowedOrigins = [clientOrigin, clientOrigin.replace('://', '://www.')];
app.use(
	cors({
		origin: allowedOrigins,
		credentials: true,
	})
);
app.use(express.json());
app.use(cookieParser()); // session JWT rides in an httpOnly cookie

app.get('/', (_req, res) => {
	res.send('API is live');
});

// Proxy for clerk.house.gov / senate.gov roll-call XML (browsers can't fetch them
// directly — no CORS). Takes the recordedVote `url` and fetches it, with a strict
// host allowlist so this can't be used as an open proxy.
app.get('/api/roll-call', async (req, res) => {
	const target = req.query.url as string;
	if (!target) return res.status(400).send('Missing url');

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return res.status(400).send('Invalid url');
	}

	const ALLOWED_HOSTS = ['clerk.house.gov', 'www.senate.gov', 'senate.gov'];
	if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
		return res.status(403).send('Host not allowed');
	}

	try {
		const response = await fetch(target);
		if (!response.ok) {
			return res.status(response.status).send(`Failed: ${response.statusText}`);
		}
		const xml = await response.text();
		res.setHeader('Content-Type', 'application/xml');
		res.send(xml);
	} catch (error) {
		console.error('Error fetching roll call:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.use('/location', locationRoutes);
app.use('/fiveCallsRoutes', fiveCallsRoutes);
app.use('/translate', translateRoutes);

app.use(authController);
app.use(voteController);
app.use(repController);
app.use(billController);
app.use(contactController);
app.use(wireController);
app.use((err: Error, _req: any, res: any, _next: any) => {
	console.error(err);
	res.status(500).json({ message: 'Something went wrong', error: err.message });
});

// Daily bill ingest at 08:00 America/New_York. The worker is also runnable
// standalone (`npm run ingest:bills`) so an external scheduler can drive it in
// production instead of the in-process job. The guard prevents overlapping runs.
let ingestRunning = false;
cron.schedule(
	'0 8 * * *',
	async () => {
		if (ingestRunning) {
			console.log('[cron] daily-bills still running from a previous trigger — skipping');
			return;
		}
		ingestRunning = true;
		console.log('[cron] starting daily ingest (bills + members)');
		// Independent jobs: a bill failure must not skip the member roster.
		try {
			const billResult = await runDailyBillIngest();
			console.log('[cron] daily bill ingest complete', billResult);
		} catch (err) {
			console.error('[cron] daily bill ingest failed', err);
		}
		try {
			const memberResult = await runDailyMemberIngest();
			console.log('[cron] daily member ingest complete', memberResult);
		} catch (err) {
			console.error('[cron] daily member ingest failed', err);
		}
		// After the roster refresh: re-verify user→delegation mappings against it.
		try {
			const reconcileResult = await runDelegationReconcile();
			console.log('[cron] delegation reconcile complete', reconcileResult);
		} catch (err) {
			console.error('[cron] delegation reconcile failed', err);
		} finally {
			ingestRunning = false;
		}
	},
	{ timezone: 'America/New_York' }
);

// The Wire: hourly post pull (Bluesky + YouTube RSS are free and unmetered at this
// volume) and a daily source-list refresh after the member roster updates.
// Each job has its own overlap guard.
let wireIngestRunning = false;
cron.schedule('15 * * * *', async () => {
	if (wireIngestRunning) {
		console.log('[cron] wire-ingest still running — skipping');
		return;
	}
	wireIngestRunning = true;
	try {
		console.log('[cron] wire ingest complete', await runWireIngest());
	} catch (err) {
		console.error('[cron] wire ingest failed', err);
	} finally {
		wireIngestRunning = false;
	}
});

let wireSyncRunning = false;
cron.schedule(
	'30 9 * * *',
	async () => {
		if (wireSyncRunning) return;
		wireSyncRunning = true;
		try {
			console.log('[cron] wire source sync complete', await runWireSync());
		} catch (err) {
			console.error('[cron] wire source sync failed', err);
		} finally {
			wireSyncRunning = false;
		}
	},
	{ timezone: 'America/New_York' }
);

// First boot after deploy: the Wire has no sources until the 09:30 sync, so
// seed it now in the background (never blocks listen).
void (async () => {
	try {
		if ((await prisma.feedSource.count()) > 0) return;
		wireSyncRunning = wireIngestRunning = true;
		console.log('[wire] no sources yet — running first sync + ingest');
		console.log('[wire] first sync', await runWireSync());
		console.log('[wire] first ingest', await runWireIngest());
	} catch (err) {
		console.error('[wire] first-boot seed failed', err);
	} finally {
		wireSyncRunning = wireIngestRunning = false;
	}
})();

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
	console.log(`🚀 Server is running on port ${PORT}`);
	console.log('⏰ Daily ingest (bills + members) scheduled for 08:00 America/New_York');
});
