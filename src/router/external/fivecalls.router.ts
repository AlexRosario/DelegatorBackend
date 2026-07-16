import { Router } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { Response } from 'express';
import { authenticate } from '../../utils/auth-utils';

dotenv.config();

const router = Router();
const fiveCallsKey = process.env.FIVECALLS_API_KEY;

async function fetchFiveCallsReps(location: string, res: Response) {
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
}

// The caller's own reps, located by the zipcode on their account — the client
// never holds the zipcode (PII stays server-side).
router.get('/representatives/mine', authenticate, async (req, res) => {
	const zipcode = req.user?.zipcode;
	if (!zipcode) return res.status(404).json({ error: 'No location on file for this account' });
	return fetchFiveCallsReps(zipcode, res);
});

router.get('/representatives', async (req, res) => {
	const location = req.query.location as string;
	if (!location) return res.status(400).json({ error: 'Missing location' });
	return fetchFiveCallsReps(location, res);
});
export default router;
