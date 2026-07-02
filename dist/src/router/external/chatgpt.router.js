"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const openai_1 = __importDefault(require("openai"));
const router = (0, express_1.Router)();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
router.post('/', async (req, res) => {
    const { text } = req.body;
    if (!text)
        return res.status(400).json({ error: 'Text is required' });
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Translation failed' });
    }
});
exports.default = router;
