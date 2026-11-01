#!/usr/bin/env node
// Every internal link and asset in the built site must exist or be a redirect source.
// Usage: node scripts/linkcheck.mjs site/dist
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { internalLinks } from './lib.mjs';

const dist = path.resolve(process.argv[2] ?? 'site/dist');
const site = 'https://northline-demo-7x9.pages.dev';
const rules = readFileSync(path.join(dist, '_redirects'), 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')[0]);
// Cloudflare _redirects syntax: :name matches one segment, * matches the rest.
const ruleRe = (r) => new RegExp('^' + r.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[a-z]+/g, '[^/]+').replace(/\*/g, '.*') + '$');
const redirected = (p) => rules.some((r) => ruleRe(r).test(p));
const exists = (p) => {
	const local = path.join(dist, decodeURIComponent(p.split('?')[0]));
	return (existsSync(local) && statSync(local).isFile()) || existsSync(path.join(local, 'index.html'));
};
const dynamic = (p) => p.startsWith('/api/');

const pages = [];
const walk = (d) => readdirSync(d).forEach((n) => {
	const f = path.join(d, n);
	if (statSync(f).isDirectory()) walk(f);
	else if (n.endsWith('.html')) pages.push(f);
});
walk(dist);

const broken = new Map();
let checked = 0;
for (const page of pages) {
	for (const link of internalLinks(readFileSync(page, 'utf8'), site)) {
		checked++;
		if (dynamic(link) || exists(link) || redirected(link.split('?')[0])) continue;
		broken.set(link, [...(broken.get(link) ?? []), path.relative(dist, page)]);
	}
}
console.log(`linkcheck: ${pages.length} pages, ${checked} links, ${broken.size} broken`);
for (const [link, from] of broken) console.log(`  BROKEN ${link}  (on ${from.slice(0, 3).join(', ')}${from.length > 3 ? ', …' : ''})`);
process.exit(broken.size ? 1 : 0);
