import { Router } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

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

export default router;
