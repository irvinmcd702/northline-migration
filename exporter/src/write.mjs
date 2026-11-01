// Writes entries as Markdown files into the Astro content folders.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

// JSON values are valid YAML, which keeps quoting rules simple and safe.
export function toMarkdown({ data, body }) {
	const front = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v ?? null)}`).join('\n');
	return `---\n${front}\n---\n\n${body ?? ''}\n`;
}

const markdownFiles = (dir, base = dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
	d.isDirectory() ? markdownFiles(path.join(dir, d.name), base) : d.name.endsWith('.md') ? [path.relative(base, path.join(dir, d.name)).replaceAll('\\', '/')] : []);

// `collections`: every collection this run owns, so one that became empty is still cleaned up.
export function writeEntries(outDir, entries, report, collections = []) {
	const byCollection = Map.groupBy(entries, (e) => e.collection);
	for (const c of collections) if (!byCollection.has(c)) byCollection.set(c, []);
	for (const [collection, list] of byCollection) {
		const dir = path.join(outDir, 'src', 'content', collection);
		mkdirSync(dir, { recursive: true });
		const keep = new Set();
		for (const e of list) {
			const name = `${e.slug}.md`;
			if (keep.has(name)) {
				report.add('error', 'duplicate-path', `${collection}/${e.slug}`, `wpId ${e.data.wpId} has the same URL as an entry already written; skipped`);
				continue;
			}
			keep.add(name);
			const file = path.join(dir, ...e.slug.split('/')) + '.md';
			mkdirSync(path.dirname(file), { recursive: true });
			const md = toMarkdown(e);
			if (!existsSync(file) || readFileSync(file, 'utf8') !== md) writeFileSync(file, md);
		}
		for (const name of markdownFiles(dir)) {
			if (keep.has(name)) continue;
			rmSync(path.join(dir, ...name.split('/')));
			report.add('info', 'removed-stale', `${collection}/${name.slice(0, -3)}`, 'no longer in WordPress (deleted or renamed)');
		}
	}
}
