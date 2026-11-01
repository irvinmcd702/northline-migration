// Every old WordPress URL must exist in dist/, be a _redirects source, or be a ?p= id the middleware knows.
// Run after `npm run build`: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(site, 'dist');
const oldUrls = readFileSync(path.join(site, '..', 'docs', 'old-urls.txt'), 'utf8').split('\n').filter(Boolean);
const rules = readFileSync(path.join(dist, '_redirects'), 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')[0]);
const ids = JSON.parse(readFileSync(path.join(site, 'src', 'data', 'wp-ids.json'), 'utf8'));

const page = (p) => path.join(dist, ...p.split('/').filter(Boolean), 'index.html');
// Cloudflare _redirects syntax: :name matches one segment, * matches the rest.
const ruleRe = (r) => new RegExp('^' + r.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[a-z]+/g, '[^/]+').replace(/\*/g, '.*') + '$');
const redirected = (p) => rules.some((r) => ruleRe(r).test(p));

test('every old URL resolves on the new site', () => {
	const missing = oldUrls.filter((u) => {
		const url = new URL(u, 'http://x');
		const p = url.searchParams.get('p');
		if (p) return !ids[p];
		return !existsSync(page(url.pathname)) && !redirected(url.pathname);
	});
	assert.deepEqual(missing, []);
});

test('every built page has a title and the demo note', () => {
	const pages = [];
	const walk = (d) => readdirSync(d).forEach((n) => {
		const f = path.join(d, n);
		if (statSync(f).isDirectory()) walk(f);
		else if (n === 'index.html') pages.push(f);
	});
	walk(dist);
	assert.ok(pages.length >= 50, `only ${pages.length} pages`);
	const bad = pages.filter((f) => {
		const html = readFileSync(f, 'utf8');
		return !/<title>[^<]+<\/title>/.test(html) || !html.includes('Demo project — fictional company');
	});
	assert.deepEqual(bad.map((f) => path.relative(dist, f)), []);
});

test('quote page explains errors and the JavaScript requirement without JavaScript', () => {
	const html = readFileSync(path.join(dist, 'request-a-quote', 'index.html'), 'utf8');
	for (const code of ['invalid', 'captcha', 'delivery']) assert.ok(html.includes(`id="quote-error-${code}"`), code);
	assert.match(html, /<noscript>[\s\S]*555-0142[\s\S]*<\/noscript>/);
});
