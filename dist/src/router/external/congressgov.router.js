"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dotenv_1 = __importDefault(require("dotenv"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const cheerio = __importStar(require("cheerio"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
const apiKey = process.env.CONGRESS_GOV_API_KEY;
router.get('/bill/:congress?/:billType?/:billNumber?/:billDetail?', async (req, res) => {
    const { congress, billType, billNumber, billDetail } = req.params;
    const offset = req.query.offset;
    let url = `https://api.congress.gov/v3/bill`;
    if (congress)
        url += `/${congress}`;
    if (billType)
        url += `/${billType}`;
    if (billNumber)
        url += `/${billNumber}`;
    if (billDetail)
        url += `/${billDetail}`;
    const queryParams = new URLSearchParams();
    if (offset) {
        queryParams.append('offset', offset.toString());
    }
    queryParams.append('api_key', apiKey ?? '');
    url += `?${queryParams.toString()}`;
    try {
        const response = await (0, node_fetch_1.default)(url);
        const data = await response.json();
        res.json(data);
    }
    catch (err) {
        console.error('Congress API error:', err);
        res.status(500).json({ error: 'Failed to fetch bills' });
    }
});
router.get('/member/:bioID', async (req, res) => {
    const { bioID } = req.params;
    if (!bioID) {
        return res.status(400).json({ error: 'BioID is required' });
    }
    const url = `https://api.congress.gov/v3/member/${bioID}?api_key=${apiKey}`;
    try {
        const response = await (0, node_fetch_1.default)(url);
        const data = await response.json();
        res.json(data);
    }
    catch (err) {
        console.error('Congress search API error:', err);
        res.status(500).json({ error: 'Failed to search bills' });
    }
});
router.get('/extract-text', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    try {
        if (typeof url !== 'string') {
            return res.status(400).json({ error: 'URL must be a string' });
        }
        const response = await (0, node_fetch_1.default)(url);
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch bill text' });
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        let billText = $('pre').text().trim();
        if (!billText) {
            billText = $('.billTextContent').text();
        }
        billText = billText.trim();
        if (!billText) {
            return res.status(500).json({ error: 'Could not extract bill text' });
        }
        return res.json({ text: billText });
    }
    catch (err) {
        console.error('Error extracting bill text:', err);
        res.status(500).json({ error: 'Failed to extract bill text' });
    }
});
exports.default = router;
