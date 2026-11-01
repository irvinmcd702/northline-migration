import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { originalOf, collectMedia, rewriteMedia, downloadMedia } from '../src/media.mjs';
import { Report } from '../src/report.mjs';

const up = 'http://localhost:8080/wp-content/uploads/2026/10';

test('originalOf strips the resized suffix and -scaled', () => {
	assert.equal(originalOf(`${up}/pump-1024x768.jpg`), `${up}/pump.jpg`);
	assert.equal(originalOf(`${up}/pump-scaled.jpg`), `${up}/pump.jpg`);
	assert.equal(originalOf(`${up}/datasheet-cp-200.pdf`), `${up}/datasheet-cp-200.pdf`);
});

test('collectMedia finds originals in body and data, without duplicates', () => {
	const body = `<img src="${up}/a-1024x683.jpg" srcset="${up}/a-300x200.jpg 300w, ${up}/a-1024x683.jpg 1024w"> [pdf](${up}/d.pdf)`;
	const found = collectMedia(body, { image: `${up}/a.jpg`, datasheet: `${up}/d.pdf` });
	assert.deepEqual(found.sort(), [`${up}/a.jpg`, `${up}/d.pdf`]);
});

test('rewriteMedia maps resized variants to the local original and drops srcset', () => {
	const map = new Map([[`${up}/a.jpg`, '/media/a.jpg']]);
	const out = rewriteMedia(`<img width="1024" src="${up}/a-1024x683.jpg" srcset="${up}/a-300x200.jpg 300w" sizes="(max-width: 1024px) 100vw">`, map, new Report(), 'page/about');
	assert.equal(out, '<img width="1024" src="/media/a.jpg">');
});

test('rewriteMedia keeps an unknown upload URL and reports it', () => {
	const report = new Report();
	const out = rewriteMedia(`![x](${up}/gone.jpg)`, new Map(), report, 'post/x');
	assert.equal(out, `![x](${up}/gone.jpg)`);
	assert.ok(report.items.some((i) => i.level === 'error' && i.kind === 'missing-media' && i.ref === 'post/x'));
});

test('downloadMedia: images to src/assets/media (relative), files to public/media, skips existing, reports 404s', async () => {
	const site = mkdtempSync(path.join(tmpdir(), 'nl-media-'));
	const dir = path.join(site, 'src', 'assets', 'media');
	const calls = [];
	const stub = async (url) => {
		calls.push(url);
		return url.endsWith('gone.jpg') ? new Response('', { status: 404 }) : new Response('JPEGDATA');
	};
	const report = new Report();
	const map = await downloadMedia([`${up}/a.jpg`, `${up}/gone.jpg`, `${up}/d.pdf`], site, { fetch: stub, report });
	assert.equal(map.get(`${up}/a.jpg`), '../../assets/media/a.jpg');
	assert.equal(map.get(`${up}/d.pdf`), '/media/d.pdf');
	assert.ok(existsSync(path.join(site, 'public', 'media', 'd.pdf')));
	assert.equal(map.has(`${up}/gone.jpg`), false);
	assert.equal(readFileSync(path.join(dir, 'a.jpg'), 'utf8'), 'JPEGDATA');
	assert.ok(!existsSync(path.join(dir, 'gone.jpg')));
	assert.ok(report.items.some((i) => i.kind === 'missing-media'));
	calls.length = 0;
	await downloadMedia([`${up}/a.jpg`], site, { fetch: stub, report: new Report() });
	assert.equal(calls.length, 0);
});

test('images outside Markdown image syntax point to /media and are listed for public/', () => {
	const map = new Map([[`${up}/c.jpg`, '../../assets/media/c.jpg']]);
	const used = new Set();
	const out = rewriteMedia(`[![](${up}/c-300x200.jpg)](${up}/c.jpg) <img src="${up}/c-1024x683.jpg">`, map, new Report(), 'page/x', used);
	assert.equal(out, '[![](../../assets/media/c.jpg)](/media/c.jpg) <img src="/media/c.jpg">');
	assert.deepEqual([...used], ['c.jpg']);
});

test('relocateAssets deepens relative image paths for nested entries', async () => {
	const { relocateAssets } = await import('../src/media.mjs');
	const e = { slug: 'services/pumps', body: '![](../../assets/media/a.jpg)', data: { image: '../../assets/media/b.jpg', datasheet: '/media/d.pdf' } };
	relocateAssets(e);
	assert.equal(e.body, '![](../../../assets/media/a.jpg)');
	assert.equal(e.data.image, '../../../assets/media/b.jpg');
	assert.equal(e.data.datasheet, '/media/d.pdf');
	const flat = { slug: 'about', body: '![](../../assets/media/a.jpg)', data: {} };
	relocateAssets(flat);
	assert.equal(flat.body, '![](../../assets/media/a.jpg)');
});
