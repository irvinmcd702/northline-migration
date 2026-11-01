// Finds WordPress uploads, downloads the originals and points content at local copies.
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_RE = /https?:\/\/[^\s"'()<>]+?\/wp-content\/uploads\/[^\s"'()<>,]+/g;
const isUpload = (u) => typeof u === 'string' && u.includes('/wp-content/uploads/');

// pump-1024x768.jpg and pump-scaled.jpg are generated copies of pump.jpg.
export const originalOf = (url) => url.replace(/-(\d+x\d+|scaled)(\.[a-z0-9]+)$/i, '$2');

export function collectMedia(body, data) {
	const found = new Set();
	for (const [url] of (body ?? '').matchAll(UPLOAD_RE)) found.add(originalOf(url));
	for (const key of ['image', 'datasheet']) if (isUpload(data?.[key])) found.add(originalOf(data[key]));
	return [...found];
}

// Markdown images (![alt](url)) get the optimised relative path. Anywhere else — links,
// raw HTML — the browser needs a site path, so images are also published under /media
// (their names are collected in `publicImages`).
export function rewriteMedia(text, map, report, ref, publicImages = new Set()) {
	const local = (url) => {
		const found = map.get(originalOf(url));
		if (!found) report.add('error', 'missing-media', ref, `${url} has no local copy`);
		return found;
	};
	const IMAGE_MD = new RegExp(`(!\\[[^\\]]*\\]\\()(${UPLOAD_RE.source})(\\))`, 'g');
	return text
		.replace(/\s(srcset|sizes)="[^"]*"/g, '')
		.replace(IMAGE_MD, (_m, open, url, close) => `${open}${local(url) ?? url}${close}`)
		.replace(UPLOAD_RE, (url) => {
			const found = local(url);
			if (!found) return url;
			if (!found.startsWith('../../assets/media/')) return found;
			const name = path.posix.basename(found);
			publicImages.add(name);
			return `/media/${name}`;
		});
}

// Images go to src/assets/media so Astro optimises them (content files sit two
// levels below src/, hence the relative path); other files are served from public/media.
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

export async function downloadMedia(urls, siteDir, { fetch = globalThis.fetch, report, concurrency = 4 } = {}) {
	const dirs = { image: path.join(siteDir, 'src', 'assets', 'media'), file: path.join(siteDir, 'public', 'media') };
	await mkdir(dirs.image, { recursive: true });
	await mkdir(dirs.file, { recursive: true });
	const map = new Map();
	const queue = [...new Set(urls)];
	const worker = async () => {
		for (let url; (url = queue.shift()); ) {
			const name = path.posix.basename(new URL(url).pathname);
			const isImage = IMAGE_RE.test(name);
			const file = path.join(isImage ? dirs.image : dirs.file, name);
			const exists = await access(file).then(() => true, () => false);
			if (!exists) {
				const res = await fetch(url);
				if (!res.ok) {
					report.add('error', 'missing-media', name, `${url}: HTTP ${res.status}`);
					continue;
				}
				await writeFile(file, Buffer.from(await res.arrayBuffer()));
			}
			map.set(url, isImage ? `../../assets/media/${name}` : `/media/${name}`);
		}
	};
	await Promise.all(Array.from({ length: concurrency }, worker));
	return map;
}

// Content files sit at src/content/<collection>/<slug>.md; a nested slug is deeper by one folder per segment.
export function relocateAssets(entry) {
	const extra = entry.slug.split('/').length - 1;
	if (!extra) return entry;
	const deeper = '../'.repeat(2 + extra) + 'assets/media/';
	entry.body = entry.body.replaceAll('../../assets/media/', deeper);
	for (const key of Object.keys(entry.data)) {
		if (typeof entry.data[key] === 'string' && entry.data[key].startsWith('../../assets/media/')) entry.data[key] = entry.data[key].replace('../../assets/media/', deeper);
	}
	return entry;
}
