#!/usr/bin/env node
// Lighthouse mobile, N runs per URL, median of each category; appends rows to docs/measurements.md.
// Usage: node scripts/lighthouse.mjs --label before --base http://localhost:8080 --runs 3 / /products/x/
import { parseArgs } from 'node:util';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { median } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: args, positionals: paths } = parseArgs({
	allowPositionals: true,
	options: { label: { type: 'string' }, base: { type: 'string' }, runs: { type: 'string', default: '3' } },
});
const out = path.join(root, 'docs', 'measurements.md');
if (!existsSync(out)) {
	writeFileSync(out, '# Measurements\n\nLighthouse mobile (default throttling), median of 3 runs per URL. "before" is the WordPress site in Docker, "after" the Astro build served by `wrangler pages dev`, "live" the deployed site.\n\n| Site | URL | Performance | Accessibility | Best practices | SEO | LCP | Page weight |\n|---|---|---|---|---|---|---|---|\n');
}

const chrome = await launch({ chromePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', chromeFlags: ['--headless=new'] });
try {
	for (const p of paths) {
		const runs = [];
		for (let i = 0; i < Number(args.runs); i++) {
			const { lhr } = await lighthouse(args.base + p, { port: chrome.port, output: 'json', logLevel: 'error' });
			runs.push(lhr);
		}
		const cat = (id) => Math.round(median(runs.map((r) => r.categories[id].score)) * 100);
		const lcp = median(runs.map((r) => r.audits['largest-contentful-paint'].numericValue)) / 1000;
		const kb = Math.round(median(runs.map((r) => r.audits['total-byte-weight'].numericValue)) / 1024);
		const row = `| ${args.label} | \`${p}\` | ${cat('performance')} | ${cat('accessibility')} | ${cat('best-practices')} | ${cat('seo')} | ${lcp.toFixed(1)} s | ${kb} KB |`;
		appendFileSync(out, row + '\n');
		console.log(row);
	}
} finally {
	await chrome.kill();
}
