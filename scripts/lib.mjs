// Shared helpers for the verification scripts.
import { decode } from 'he';

export const textOf = (html) => decode(
	html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
).replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export const titleOf = (html) => decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();

const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}³°µ.,-]+/gu)?.map((w) => w.replace(/[.,]+$/, '')).filter(Boolean) ?? [];

// Share of the old page's words that also appear on the new page.
export function recall(oldText, newText) {
	const old = words(oldText);
	if (!old.length) return 1;
	const found = new Set(words(newText));
	return old.filter((w) => found.has(w)).length / old.length;
}

export function internalLinks(html, site) {
	const out = new Set();
	for (const [, url] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
		if (url.startsWith('#') || /^(mailto|tel|javascript):/.test(url)) continue;
		if (url.startsWith('/') && !url.startsWith('//')) out.add(url.split('#')[0]);
		else if (url.startsWith(site)) out.add(new URL(url).pathname);
	}
	return [...out];
}

export const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
