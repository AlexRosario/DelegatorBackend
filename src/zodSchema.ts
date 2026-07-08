import { z } from 'zod';
export const loginSchema = {
	body: z.object({
		username: z.string().min(3),
		password: z.string().min(6),
	}),
};
export const registerSchema = {
	body: z
		.object({
			username: z.string().min(3),
			email: z.string().email(),
			password: z.string().min(8),
			address: z
				.object({
					street: z.string().min(1),
					city: z.string().min(1),
					state: z.string().min(1),
					zipcode: z.string().regex(/^\d{5}(-\d{4})?$/, {
						message: 'Invalid US zipcode format',
					}),
				})
				.required(),
			// Constituent self-attestation is required (CWC anti-astroturf posture).
			attest: z.literal(true, {
				errorMap: () => ({ message: 'You must attest that you reside at this address' }),
			}),
		})
		.required(),
};

export const voteSchema = z.object({
	billId: z.string(),
	vote: z.enum(['Yes', 'No']),
	date: z.preprocess((val) => new Date(val as string), z.instanceof(Date)),
});

export const commentSchema = z.object({
	body: z.string().trim().min(1).max(2000),
});

export const memberVoteSchema = z.object({
	bioguideId: z.string(),
	billId: z.string(),
	vote: z.enum(['Yea', 'Nay', 'Present', 'Not Voting']),
	date: z.preprocess((val) => new Date(val as string), z.instanceof(Date)),
});
