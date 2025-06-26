import { Router } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = Router();
const fiveCallsKey = process.env.FIVECALLS_API_KEY;
router.get('/representatives', async (req, res) => {
	const location = req.query.location as string;
	if (!location) return res.status(400).json({ error: 'Missing location' });

	const url = `https://api.5calls.org/v1/representatives?location=${encodeURIComponent(location)}`;

	try {
		const response = await fetch(url, {
			headers: {
				'X-5Calls-Token': fiveCallsKey ?? '',
			},
		});

		const data = await response.json();
		res.json(data);
	} catch (err) {
		console.error('5Calls error:', err);
		res.status(500).json({ error: 'Failed to fetch reps' });
	}
});
export default router;
