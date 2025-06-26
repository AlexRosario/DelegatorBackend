import { Router } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = Router();
const positionStackKey = process.env.POSITIONSTACK_KEY;

router.get('/geocode', async (req, res) => {
	const query = req.query.query as string;
	if (!query) return res.status(400).json({ error: 'Missing query' });

	try {
		const url = `http://api.positionstack.com/v1/forward?access_key=${positionStackKey}&query=${encodeURIComponent(
			query
		)}`;
		const response = await fetch(url);
		const data = await response.json();

		res.json(data);
	} catch (err) {
		console.error('PositionStack error:', err);
		res.status(500).json({ error: 'Failed to fetch geolocation' });
	}
});

export default router;
