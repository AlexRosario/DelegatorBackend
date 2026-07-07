/**
 * Transactional email with a pluggable provider:
 *  - RESEND_API_KEY set → sends via Resend (also set EMAIL_FROM, e.g. "Delegator <noreply@yourdomain>")
 *  - otherwise → logs the message to the server console (dev mode)
 *
 * APP_ORIGIN is the base for links in emails (defaults to the local backend).
 */

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:8080';

async function send(to: string, subject: string, html: string): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${html}\n`);
		return;
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			from: process.env.EMAIL_FROM ?? 'Delegator <onboarding@resend.dev>',
			to: [to],
			subject,
			html,
		}),
	});
	if (!res.ok) {
		throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
	}
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
	const link = `${APP_ORIGIN}/auth/verify-email?token=${token}`;
	await send(
		to,
		'Verify your email for Delegator',
		`<p>Confirm your email to activate your Delegator account:</p><p><a href="${link}">${link}</a></p>` +
			`<p>If you didn't create this account, ignore this message.</p>`
	);
}
