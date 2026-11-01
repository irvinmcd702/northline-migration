#!/usr/bin/env node
// WordPress → Astro migration.
// Usage: node bin/export.mjs --wp http://localhost:8080 --out ../site [--docs ../docs] [--retire retired.json]
import { parseArgs } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fetchAll } from '../src/wp-client.mjs';
import { toEntry } from '../src/transform.mjs';
import { collectMedia, rewriteMedia, downloadMedia, originalOf, relocateAssets } from '../src/media.mjs';
import { buildRedirects, buildOldUrls } from '../src/redirects.mjs';
import { writeEntries } from '../src/write.mjs';
import { Report } from '../src/report.mjs';

const { values: args } = parseArgs({ options: { wp: { type: 'string' }, out: { type: 'string' }, docs: { type: 'string', default: 'docs' }, retire: { type: 'string' } } });
if (!args.wp || !args.out) {
	console.error('Usage: export.mjs --wp <url> --out <site dir> [--docs <dir>] [--retire <json>]');
	process.exit(2);
}

const write = (file, text) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); };
const report = new Report();
const retireList = args.retire ? JSON.parse(readFileSync(args.retire, 'utf8')) : [];
const retireBySlug = new Map(retireList.map((r) => [r.slug, r.redirect_to]));

const media = new Map((await fetchAll(args.wp, 'media')).map((m) => [m.id, m.source_url]));
const entries = [];
const retired = [];
for (const kind of ['page', 'post', 'product', 'project', 'inventory']) {
	for (const item of await fetchAll(args.wp, kind)) {
		if (kind === 'page' && retireBySlug.has(item.slug)) {
			retired.push({ from: new URL(item.link).pathname, to: retireBySlug.get(item.slug), wpId: item.id });
			report.add('info', 'retired', `page/${item.slug}`, `301 → ${retireBySlug.get(item.slug)}`);
			continue;
		}
		entries.push(toEntry(item, kind, report, { media }));
	}
}
entries.sort((a, b) => `${a.collection}/${a.slug}`.localeCompare(`${b.collection}/${b.slug}`));

const files = await downloadMedia(entries.flatMap((e) => collectMedia(e.body, e.data)), args.out, { report });
const publicImages = new Set();
for (const e of entries) {
	const ref = `${e.collection}/${e.slug}`;
	e.body = rewriteMedia(e.body, files, report, ref, publicImages);
	for (const key of ['image', 'datasheet']) if (e.data[key]) e.data[key] = files.get(originalOf(e.data[key])) ?? e.data[key];
	relocateAssets(e);
}
// Images linked from links or raw HTML need a plain URL as well as the optimised copy.
for (const name of publicImages) {
	mkdirSync(path.join(args.out, 'public', 'media'), { recursive: true });
	copyFileSync(path.join(args.out, 'src', 'assets', 'media', name), path.join(args.out, 'public', 'media', name));
}
writeEntries(args.out, entries, report, ['pages', 'posts', 'products', 'projects', 'inventory']);
// Old links to documents (emailed or printed catalogs) keep working.
const fileRedirects = [...files].filter(([, to]) => to.startsWith('/media/')).map(([from, to]) => ({ from: new URL(from).pathname, to }))
	.sort((a, b) => a.from.localeCompare(b.from));

const terms = async (type) => (await fetchAll(args.wp, type)).map((t) => ({ slug: t.slug, name: t.name, description: t.description ?? '' }))
	.sort((a, b) => a.slug.localeCompare(b.slug));
const productCategories = await terms('product_category');
const blogCategories = await terms('categories');
const { redirects, idMap } = buildRedirects(entries, retired, fileRedirects);
write(path.join(args.out, 'public', '_redirects'), redirects);
write(path.join(args.out, 'src', 'data', 'wp-ids.json'), JSON.stringify(idMap, null, 2) + '\n');
write(path.join(args.out, 'src', 'data', 'product-categories.json'), JSON.stringify(productCategories, null, 2) + '\n');
write(path.join(args.out, 'src', 'data', 'blog-categories.json'), JSON.stringify(blogCategories, null, 2) + '\n');
const oldUrls = buildOldUrls(entries, retired, { productCategories: productCategories.map((c) => c.slug), blogCategories: blogCategories.map((c) => c.slug), files: fileRedirects });
write(path.join(args.docs, 'old-urls.txt'), oldUrls.join('\n') + '\n');

const perCollection = Object.fromEntries([...Map.groupBy(entries, (e) => e.collection)].map(([c, l]) => [c, l.length]));
write(path.join(args.docs, 'migration-report.md'), report.toMarkdown({
	...perCollection,
	'media files': files.size,
	'retired pages (301)': retired.length,
	'old URLs to verify': oldUrls.length,
}));
const c = report.counts();
console.log(`Exported ${entries.length} entries, ${files.size} media files; ${c.error} errors, ${c.warn} warnings.`);
