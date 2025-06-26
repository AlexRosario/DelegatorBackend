import express from 'express';
import cors from 'cors';
import { authController } from './src/router/auth.router';
import { voteController } from './src/router/vote.router';
import { repController } from './src/router/rep.router';

import positionstackRoutes from './src/router/external/positionstack.router';
import fiveCallsRoutes from './src/router/external/fivecalls.router';
import congressGovRoutes from './src/router/external/congressgov.router';
const app = express();

app.use(
	cors({
		origin: 'http://localhost:5173',
		credentials: true,
	})
);
app.use(express.json());

app.get('/', (_req, res) => {
	res.send('API is live');
});

app.get('/api/house-roll-call/:rollId/:year', async (req, res) => {
	const { rollId, year } = req.params;
	const url = `https://clerk.house.gov/evs/${year}/roll${rollId}.xml`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return res.status(response.status).send(`Failed: ${response.statusText}`);
		}
		console.log(`Fetching House roll call from: ${url}`);
		const xml = await response.text();
		res.setHeader('Content-Type', 'application/xml');
		res.send(xml);
	} catch (error) {
		console.error('Error fetching House roll call:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/api/senate-roll-call/:rollId/:congress/:session', async (req, res) => {
	const { rollId, congress, session } = req.params;
	const paddedRoll = rollId.toString().padStart(5, '0');
	const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${paddedRoll}.xml`;
	console.log(`Fetching Senate roll call from: ${url}`);
	try {
		const response = await fetch(url);
		if (!response.ok) {
			return res.status(response.status).send(`Failed: ${response.statusText}`);
		}

		const xml = await response.text();
		res.setHeader('Content-Type', 'application/xml');
		res.send(xml);
	} catch (error) {
		console.error('Error fetching Senate roll call:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.use('/location', positionstackRoutes);
app.use('/fiveCallsRoutes', fiveCallsRoutes);
app.use('/congressGovRoutes', congressGovRoutes);
app.use(authController);
app.use(voteController);
app.use(repController);
app.use((err: Error, _req: any, res: any, _next: any) => {
	console.error(err);
	res.status(500).json({ message: 'Something went wrong', error: err.message });
});

app.listen(8080, () => {
	console.log('🚀 Server is running on port 8080');
});
