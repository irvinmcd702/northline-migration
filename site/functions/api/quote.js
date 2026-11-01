// POST /api/quote — checks Cloudflare Turnstile and forwards the request to a webhook.
// Nothing is stored on the site. Env: TURNSTILE_SECRET, WEBHOOK_URL (optional: unset = demo mode).
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const FIELDS = ['name', 'email', 'company', 'message', 'product'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
	const wantsJson = (request.headers.get('Accept') ?? '').includes('application/json');
	const fail = (status, error) => wantsJson
		? Response.json({ error }, { status })
		// The fragment shows the matching message via CSS :target, so the error is visible without JavaScript.
		: new Response(null, { status: 303, headers: { Location: `/request-a-quote/?error=${error}#quote-error-${error}` } });

	const form = await request.formData();
	const data = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? '').trim()]));
	if (!data.name || !data.message || !EMAIL_RE.test(data.email)) return fail(400, 'invalid');

	const token = String(form.get('cf-turnstile-response') ?? '');
	if (!token) return fail(400, 'captcha');
	const verify = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
	const ip = request.headers.get('CF-Connecting-IP');
	if (ip) verify.set('remoteip', ip);
	// An unreachable Turnstile is our outage, not the visitor's failed check.
	let outcome;
	try {
		const res = await fetch(SITEVERIFY, { method: 'POST', body: verify, signal: AbortSignal.timeout(5000) });
		if (!res.ok) return fail(503, 'delivery');
		outcome = await res.json();
	} catch {
		return fail(503, 'delivery');
	}
	if (!outcome.success) return fail(400, 'captcha');

	const thanks = new Response(null, { status: 303, headers: { Location: '/request-a-quote/thanks/' } });
	// Demo mode: without a webhook the request is checked but sent nowhere.
	if (!env.WEBHOOK_URL) return thanks;

	try {
		const res = await fetch(env.WEBHOOK_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return fail(502, 'delivery');
	} catch {
		return fail(502, 'delivery');
	}
	return thanks;
}
