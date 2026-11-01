import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { toMarkdown, writeEntries } from '../src/write.mjs';
import { Report } from '../src/report.mjs';

const entry = { collection: 'products', slug: 'cp-200', data: { title: 'Ball Valve 2″ & "Quoted"', wpId: 6, specs: [{ key: 'Head', value: '45 m' }], price: null }, body: '## Hi\n\nText' };

test('toMarkdown writes JSON-safe YAML front matter and the body', () => {
	const md = toMarkdown(entry);
	assert.ok(md.startsWith('---\n'));
	assert.match(md, /^title: "Ball Valve 2″ & \\"Quoted\\""$/m);
	assert.match(md, /^specs: \[\{"key":"Head","value":"45 m"\}\]$/m);
	assert.match(md, /^price: null$/m);
	assert.ok(md.endsWith('---\n\n## Hi\n\nText\n'));
});

test('writeEntries is deterministic and removes stale files whose wpId is gone', () => {
	const out = mkdtempSync(path.join(tmpdir(), 'nl-write-'));
	const dir = path.join(out, 'src', 'content', 'products');
	mkdirSync(dir, { recursive: true });
	writeFileSync(path.join(dir, 'old-one.md'), '---\nwpId: 555\n---\n');
	const report = new Report();
	writeEntries(out, [entry], report);
	const first = readFileSync(path.join(dir, 'cp-200.md'), 'utf8');
	writeEntries(out, [entry], new Report());
	assert.equal(readFileSync(path.join(dir, 'cp-200.md'), 'utf8'), first);
	assert.equal(existsSync(path.join(dir, 'old-one.md')), false);
	assert.ok(report.items.some((i) => i.kind === 'removed-stale' && i.ref === 'products/old-one'));
});

test('nested slugs are written to subfolders; duplicate paths are reported, not overwritten', () => {
	const out = mkdtempSync(path.join(tmpdir(), 'nl-nest-'));
	const report = new Report();
	const a = { collection: 'pages', slug: 'services/pumps', data: { wpId: 1 }, body: 'A' };
	const b = { collection: 'pages', slug: 'services/pumps', data: { wpId: 2 }, body: 'B' };
	writeEntries(out, [a, b], report);
	const file = path.join(out, 'src', 'content', 'pages', 'services', 'pumps.md');
	assert.ok(readFileSync(file, 'utf8').endsWith('A\n'));
	assert.ok(report.items.some((i) => i.level === 'error' && i.kind === 'duplicate-path'));
	writeEntries(out, [], new Report(), ['pages']);
	assert.equal(existsSync(file), false);
});
