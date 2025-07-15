import { Router } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

dotenv.config();

const router = Router();
const apiKey = process.env.CONGRESS_GOV_API_KEY;

router.get('/bill/:congress?/:billType?/:billNumber?/:billDetail?', async (req, res) => {
	const { congress, billType, billNumber, billDetail } = req.params;
	const offset = req.query.offset;
	let url = `https://api.congress.gov/v3/bill`;

	if (congress) url += `/${congress}`;
	if (billType) url += `/${billType}`;
	if (billNumber) url += `/${billNumber}`;
	if (billDetail) url += `/${billDetail}`;

	const queryParams = new URLSearchParams();

	if (offset) {
		queryParams.append('offset', offset.toString());
	}
	queryParams.append('api_key', apiKey ?? '');

	url += `?${queryParams.toString()}`;

	try {
		const response = await fetch(url);
		const data = await response.json();
		res.json(data);
	} catch (err) {
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
		const response = await fetch(url);
		const data = await response.json();
		res.json(data);
	} catch (err) {
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
		const response = await fetch(url);
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
	} catch (err) {
		console.error('Error extracting bill text:', err);
		res.status(500).json({ error: 'Failed to extract bill text' });
	}
});

export default router;
