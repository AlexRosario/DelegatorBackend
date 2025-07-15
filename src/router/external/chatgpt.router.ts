import { Request, Response, Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

router.post('/', async (req: Request, res: Response) => {
	const { text } = req.body;

	if (!text) return res.status(400).json({ error: 'Text is required' });

	try {
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{
					role: 'system',
					content: `You are a legal expert. Simplify the following U.S. bill and explain it to me as if I was 12 years old, preserving all legal points and considerations.`,
				},
				{
					role: 'user',
					content: text,
				},
			],
			temperature: 0.2,
		});

		res.json({ translation: completion.choices[0].message.content });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Translation failed' });
	}
});

export default router;
