"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dotenv_1 = __importDefault(require("dotenv"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
const positionStackKey = process.env.POSITIONSTACK_KEY;
router.get('/geocode', async (req, res) => {
    const query = req.query.query;
    if (!query)
        return res.status(400).json({ error: 'Missing query' });
    try {
        const url = `http://api.positionstack.com/v1/forward?access_key=${positionStackKey}&query=${encodeURIComponent(query)}`;
        const response = await (0, node_fetch_1.default)(url);
        const data = await response.json();
        res.json(data);
    }
    catch (err) {
        console.error('PositionStack error:', err);
        res.status(500).json({ error: 'Failed to fetch geolocation' });
    }
});
exports.default = router;
