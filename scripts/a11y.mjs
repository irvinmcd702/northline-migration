#!/usr/bin/env node
// axe-core (WCAG 2.1 AA rules) on key pages; fails on serious or critical violations.
// Usage: node scripts/a11y.mjs http://127.0.0.1:8788
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const base = process.argv[2] ?? 'http://127.0.0.1:8788';
const pages = ['/', '/products/centrifugal-pump-cp-200/', '/projects/brewery-cooling-water-upgrade/', '/inventory/used-lobe-pump-stainless/', '/blog/why-we-test-every-relief-valve/', '/request-a-quote/'];
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let bad = 0;
try {
	for (const p of pages) {
		const page = await browser.newPage();
		await page.goto(base + p, { waitUntil: 'networkidle0' });
		await page.addScriptTag({ content: axeSource });
		const result = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
		const serious = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
		bad += serious.length;
		console.log(`${serious.length ? 'FAIL' : 'ok  '} ${p}  violations: ${result.violations.length} (serious/critical: ${serious.length})`);
		for (const v of result.violations) console.log(`       ${v.impact} ${v.id}: ${v.help} (${v.nodes.length})`);
		await page.close();
	}
} finally {
	await browser.close();
}
process.exit(bad ? 1 : 0);
