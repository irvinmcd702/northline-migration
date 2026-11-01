import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/quote.js';

const env = { TURNSTILE_SECRET: 'secret', WEBHOOK_URL: 'https://hooks.test/quote' };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function request(fields, { json = true } = {}) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	return new Request('https://northline.test/api/quote', {
		method: 'POST', body, headers: json ? { Accept: 'application/json', 'CF-Connecting-IP': '203.0.113.7' } : {},
	});
}
const valid = { name: 'Ann Lee', email: 'ann@example.com', company: 'Acme', message: 'Need 2 pumps', product: 'NL-CP-200', 'cf-turnstile-response': 'tok' };

function stubFetch({ captcha = true, webhook = 'ok', siteverify = 'ok' } = {}) {
	const calls = [];
	globalThis.fetch = async (url, init = {}) => {
		calls.push({ url: String(url), init });
		if (String(url).includes('turnstile')) {
			if (siteverify === 'hang') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
			if (siteverify === 'down') return new Response('bad gateway', { status: 502 });
			return Response.json({ success: captcha });
		}
		if (webhook === 'throw') throw new Error('network down');
		if (webhook === 'hang') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
		return new Response('ok', { status: webhook === 'ok' ? 200 : 500 });
	};
	return calls;
}

test('valid submission: verified, forwarded without the token, 303 to thanks', async () => {
	const calls = stubFetch();
	const res = await onRequestPost({ request: request(valid), env });
	assert.equal(res.status, 303);
	assert.equal(res.headers.get('Location'), '/request-a-quote/thanks/');
	const verify = calls.find((c) => c.url.includes('turnstile'));
	assert.equal(verify.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
	const sent = new URLSearchParams(String(verify.init.body));
	assert.equal(sent.get('secret'), 'secret');
	assert.equal(sent.get('response'), 'tok');
	assert.equal(sent.get('remoteip'), '203.0.113.7');
	const hooks = calls.filter((c) => c.url === env.WEBHOOK_URL);
	assert.equal(hooks.length, 1);
	const payload = JSON.parse(hooks[0].init.body);
	assert.deepEqual(Object.keys(payload).sort(), ['company', 'email', 'message', 'name', 'product']);
	assert.equal(payload.product, 'NL-CP-200');
});

test('failed captcha: 400 captcha, webhook not called', async () => {
	const calls = stubFetch({ captcha: false });
	const res = await onRequestPost({ request: request(valid), env });
	assert.equal(res.status, 400);
	assert.deepEqual(await res.json(), { error: 'captcha' });
	assert.equal(calls.filter((c) => c.url === env.WEBHOOK_URL).length, 0);
});

test('missing token: 400 captcha without calling Turnstile', async () => {
	const calls = stubFetch();
	const res = await onRequestPost({ request: request({ ...valid, 'cf-turnstile-response': '' }), env });
	assert.equal(res.status, 400);
	assert.deepEqual(await res.json(), { error: 'captcha' });
	assert.equal(calls.length, 0);
});

test('bad email or empty message: 400 invalid', async () => {
	stubFetch();
	for (const fields of [{ ...valid, email: 'not-an-email' }, { ...valid, message: '  ' }, { ...valid, name: '' }]) {
		const res = await onRequestPost({ request: request(fields), env });
		assert.equal(res.status, 400);
		assert.deepEqual(await res.json(), { error: 'invalid' });
	}
});

test('webhook down or failing: 502 delivery', async () => {
	for (const webhook of ['throw', 'fail']) {
		stubFetch({ webhook });
		const res = await onRequestPost({ request: request(valid), env });
		assert.equal(res.status, 502, webhook);
		assert.deepEqual(await res.json(), { error: 'delivery' });
	}
});

test('webhook timeout after 5 s: 502 delivery', { timeout: 8000 }, async () => {
	stubFetch({ webhook: 'hang' });
	const started = Date.now();
	const res = await onRequestPost({ request: request(valid), env });
	assert.equal(res.status, 502);
	assert.ok(Date.now() - started >= 4900);
});

test('without JavaScript (no JSON Accept): errors redirect back to the form', async () => {
	stubFetch({ captcha: false });
	const res = await onRequestPost({ request: request(valid, { json: false }), env });
	assert.equal(res.status, 303);
	assert.equal(res.headers.get('Location'), '/request-a-quote/?error=captcha#quote-error-captcha');
});

test('Turnstile outage or timeout is a delivery problem (503), not a failed captcha', { timeout: 8000 }, async () => {
	for (const siteverify of ['down', 'hang']) {
		const calls = stubFetch({ siteverify });
		const res = await onRequestPost({ request: request(valid), env });
		assert.equal(res.status, 503, siteverify);
		assert.deepEqual(await res.json(), { error: 'delivery' });
		assert.equal(calls.filter((c) => c.url === env.WEBHOOK_URL).length, 0);
	}
});

test('demo mode: without WEBHOOK_URL a verified request is accepted and sent nowhere', async () => {
	const calls = stubFetch();
	const res = await onRequestPost({ request: request(valid), env: { TURNSTILE_SECRET: 'secret' } });
	assert.equal(res.status, 303);
	assert.equal(res.headers.get('Location'), '/request-a-quote/thanks/');
	assert.equal(calls.length, 1);
	assert.ok(calls[0].url.includes('turnstile'));
});

test('demo mode still enforces the spam check', async () => {
	stubFetch({ captcha: false });
	const res = await onRequestPost({ request: request(valid), env: { TURNSTILE_SECRET: 'secret' } });
	assert.equal(res.status, 400);
});
