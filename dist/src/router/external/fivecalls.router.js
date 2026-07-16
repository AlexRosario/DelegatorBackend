"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dotenv_1 = __importDefault(require("dotenv"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const auth_utils_1 = require("../../utils/auth-utils");
dotenv_1.default.config();
const router = (0, express_1.Router)();
const fiveCallsKey = process.env.FIVECALLS_API_KEY;
async function fetchFiveCallsReps(location, res) {
    const url = `https://api.5calls.org/v1/representatives?location=${encodeURIComponent(location)}`;
    try {
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'X-5Calls-Token': fiveCallsKey ?? '',
            },
        });
        const data = await response.json();
        res.json(data);
    }
    catch (err) {
        console.error('5Calls error:', err);
        res.status(500).json({ error: 'Failed to fetch reps' });
    }
}
// The caller's own reps, located by the zipcode on their account — the client
// never holds the zipcode (PII stays server-side).
router.get('/representatives/mine', auth_utils_1.authenticate, async (req, res) => {
    const zipcode = req.user?.zipcode;
    if (!zipcode)
        return res.status(404).json({ error: 'No location on file for this account' });
    return fetchFiveCallsReps(zipcode, res);
});
router.get('/representatives', async (req, res) => {
    const location = req.query.location;
    if (!location)
        return res.status(400).json({ error: 'Missing location' });
    return fetchFiveCallsReps(location, res);
});
exports.default = router;
