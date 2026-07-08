"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // load env before any module that reads process.env at import time
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const auth_router_1 = require("./src/router/auth.router");
const vote_router_1 = require("./src/router/vote.router");
const rep_router_1 = require("./src/router/rep.router");
const bill_router_1 = require("./src/router/bill.router");
const contact_router_1 = require("./src/router/contact.router");
const dailyBillIngest_1 = require("./src/workers/dailyBillIngest");
const dailyMemberIngest_1 = require("./src/workers/dailyMemberIngest");
const reconcileDelegations_1 = require("./src/workers/reconcileDelegations");
const location_router_1 = __importDefault(require("./src/router/location.router"));
const fivecalls_router_1 = __importDefault(require("./src/router/external/fivecalls.router"));
const translate_router_1 = __importDefault(require("./src/router/external/translate.router"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    // Set CLIENT_ORIGIN to the deployed frontend URL when going live.
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.get('/', (_req, res) => {
    res.send('API is live');
});
// Proxy for clerk.house.gov / senate.gov roll-call XML (browsers can't fetch them
// directly — no CORS). Takes the recordedVote `url` and fetches it, with a strict
// host allowlist so this can't be used as an open proxy.
app.get('/api/roll-call', async (req, res) => {
    const target = req.query.url;
    if (!target)
        return res.status(400).send('Missing url');
    let parsed;
    try {
        parsed = new URL(target);
    }
    catch {
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
    }
    catch (error) {
        console.error('Error fetching roll call:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.use('/location', location_router_1.default);
app.use('/fiveCallsRoutes', fivecalls_router_1.default);
app.use('/translate', translate_router_1.default);
app.use(auth_router_1.authController);
app.use(vote_router_1.voteController);
app.use(rep_router_1.repController);
app.use(bill_router_1.billController);
app.use(contact_router_1.contactController);
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
});
// Daily bill ingest at 08:00 America/New_York. The worker is also runnable
// standalone (`npm run ingest:bills`) so an external scheduler can drive it in
// production instead of the in-process job. The guard prevents overlapping runs.
let ingestRunning = false;
node_cron_1.default.schedule('0 8 * * *', async () => {
    if (ingestRunning) {
        console.log('[cron] daily-bills still running from a previous trigger — skipping');
        return;
    }
    ingestRunning = true;
    console.log('[cron] starting daily ingest (bills + members)');
    // Independent jobs: a bill failure must not skip the member roster.
    try {
        const billResult = await (0, dailyBillIngest_1.runDailyBillIngest)();
        console.log('[cron] daily bill ingest complete', billResult);
    }
    catch (err) {
        console.error('[cron] daily bill ingest failed', err);
    }
    try {
        const memberResult = await (0, dailyMemberIngest_1.runDailyMemberIngest)();
        console.log('[cron] daily member ingest complete', memberResult);
    }
    catch (err) {
        console.error('[cron] daily member ingest failed', err);
    }
    // After the roster refresh: re-verify user→delegation mappings against it.
    try {
        const reconcileResult = await (0, reconcileDelegations_1.runDelegationReconcile)();
        console.log('[cron] delegation reconcile complete', reconcileResult);
    }
    catch (err) {
        console.error('[cron] delegation reconcile failed', err);
    }
    finally {
        ingestRunning = false;
    }
}, { timezone: 'America/New_York' });
const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log('⏰ Daily ingest (bills + members) scheduled for 08:00 America/New_York');
});
