#!/usr/bin/env node
// Checks every old WordPress URL on the new site: 200 with the same title and text, or a 301 to a working page.
// Usage: node scripts/parity.mjs --old http://localhost:8080 --new http://127.0.0.1:8788
import { parseArgs } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textOf, titleOf, recall } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({ options: { old: { type: 'string' }, new: { type: 'string' }, min: { type: 'string', default: '0.9' } } });
const urls = readFileSync(path.join(root, 'docs', 'old-urls.txt'), 'utf8').split('\n').filter(Boolean);
const restBase = { pages: 'pages', posts: 'posts', products: 'product', projects: 'project', inventory: 'inventory' };

// Migrated entries: old URL → where to read the original text in the WordPress REST API.
const entries = new Map();
const contentDir = path.join(root, 'site', 'src', 'content');
for (const collection of readdirSync(contentDir)) {
	for (const file of readdirSync(path.join(contentDir, collection))) {
		const md = readFileSync(path.join(contentDir, collection, file), 'utf8');
		const oldUrl = JSON.parse(md.match(/^oldUrl: (.*)$/m)[1]);
		const wpId = Number(md.match(/^wpId: (.*)$/m)[1]);
		entries.set(oldUrl, `${args.old}/wp-json/wp/v2/${restBase[collection]}/${wpId}`);
	}
}

const problems = [];
let ok = 0;
for (const u of urls) {
	const res = await fetch(args.new + u, { redirect: 'manual' });
	if (res.status === 301 || res.status === 308) {
		const target = new URL(res.headers.get('location'), args.new);
		const final = await fetch(target);
		const slashOnly = res.status === 308 && target.pathname === new URL(u, args.new).pathname + '/';
		if (final.status !== 200) problems.push([u, `${res.status} → ${target.pathname} answers ${final.status}`]);
		else if (res.status === 308 && !slashOnly) problems.push([u, `308 instead of 301 → ${target.pathname}`]);
		else ok++;
		continue;
	}
	if (res.status !== 200) { problems.push([u, `HTTP ${res.status}`]); continue; }
	const html = await res.text();
	const rest = entries.get(u);
	if (!rest) { ok++; continue; } // archive page: only the status matters
	const [oldHtml, item] = await Promise.all([
		fetch(args.old + u).then((r) => r.text()),
		fetch(rest).then((r) => r.json()),
	]);
	const oldTitle = titleOf(oldHtml);
	const newTitle = titleOf(html);
	const score = recall(textOf(item.content.rendered) + ' ' + textOf(item.title.rendered), textOf(html));
	if (oldTitle !== newTitle) problems.push([u, `title "${newTitle}" ≠ "${oldTitle}"`]);
	else if (score < Number(args.min)) problems.push([u, `text match ${(score * 100).toFixed(0)}%`]);
	else ok++;
}

console.log(`parity: ${ok}/${urls.length} URLs OK`);
for (const [u, why] of problems) console.log(`  FAIL ${u}  ${why}`);
process.exit(problems.length ? 1 : 0);
