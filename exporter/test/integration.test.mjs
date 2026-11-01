// Runs the real CLI against a live WordPress: WP_URL=http://localhost:8080 node --test test/integration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wp = process.env.WP_URL;
const cli = fileURLToPath(new URL('../bin/export.mjs', import.meta.url));
const retire = path.resolve(path.dirname(cli), '..', '..', 'wp-source', 'content', 'retired.json');

function tree(dir, base = dir, acc = {}) {
	for (const name of readdirSync(dir)) {
		const p = path.join(dir, name);
		if (statSync(p).isDirectory()) tree(p, base, acc);
		else acc[path.relative(base, p)] = createHash('sha1').update(readFileSync(p)).digest('hex');
	}
	return acc;
}

test('export run produces the full tree and a second run is identical', { skip: !wp && 'set WP_URL' }, () => {
	const out = mkdtempSync(path.join(tmpdir(), 'nl-site-'));
	const docs = mkdtempSync(path.join(tmpdir(), 'nl-docs-'));
	const run = () => execFileSync(process.execPath, [cli, '--wp', wp, '--out', out, '--docs', docs, '--retire', retire], { encoding: 'utf8' });
	run();
	const first = tree(out);
	assert.equal(readdirSync(path.join(out, 'src', 'content', 'products')).length, 20);
	assert.equal(readdirSync(path.join(out, 'src', 'content', 'inventory')).length, 7);
	assert.ok(first[path.join('public', '_redirects')]);
	const report = readFileSync(path.join(docs, 'migration-report.md'), 'utf8');
	assert.match(report, /0 errors/);
	assert.match(report, /unconverted-block/);
	run();
	assert.deepEqual(tree(out), first);
});
