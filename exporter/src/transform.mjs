// Turns one WordPress REST item into an Astro content entry.
import TurndownService from 'turndown';
import { decode as decodeEntities } from 'he';

const collections = { page: 'pages', post: 'posts', product: 'products', project: 'projects', inventory: 'inventory' };

// Block classes Markdown expresses well; any other wp-block-* element is kept as HTML.
const convertible = /^wp-block-(heading|paragraph|list|list-item|image|quote|separator|group|post-content|preformatted|code)$/;
// Elements Markdown cannot express are kept as HTML and listed in the report.
const keepTags = new Set(['IFRAME', 'VIDEO', 'AUDIO', 'TABLE', 'OBJECT', 'EMBED']);
const SHORTCODE_RE = /\[([a-z][a-z0-9_-]*)(\s[^\]]*)?\]/gi;

const classes = (node) => (node.getAttribute?.('class') ?? '').split(/\s+/);
const blockClass = (node) => classes(node).find((c) => /^wp-block-[a-z0-9-]+$/.test(c));
const isKept = (node) => keepTags.has(node.nodeName) || (blockClass(node) && !convertible.test(blockClass(node)) && !classes(node).includes('wp-block-gallery'));
const insideKept = (node) => {
	for (let p = node.parentNode; p && p.nodeName !== '#document'; p = p.parentNode) if (p.getAttribute && isKept(p)) return true;
	return false;
};
const childCaption = (node) => Array.from(node?.childNodes ?? []).find((c) => c.nodeName === 'FIGCAPTION');

function converter(report, ref) {
	const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });

	// Text such as "&lt;br&gt;" must stay text: Markdown would turn a bare "<br>" into HTML.
	const escape = td.escape.bind(td);
	td.escape = (s) => escape(s).replace(/</g, '&lt;');

	// Galleries become Markdown images so the static site can optimise them; captions stay as text.
	td.addRule('gallery', {
		filter: (node) => classes(node).includes('wp-block-gallery'),
		replacement: (_content, node) => {
			const lines = [];
			for (const img of Array.from(node.getElementsByTagName('img'))) {
				lines.push(`![${img.getAttribute('alt') ?? ''}](${img.getAttribute('src')})`);
				const caption = img.parentNode?.nodeName === 'FIGURE' ? childCaption(img.parentNode) : null;
				if (caption?.textContent.trim()) lines.push(`*${td.escape(caption.textContent.trim())}*`);
			}
			const own = childCaption(node);
			report.add('info', 'gallery-converted', ref, `${node.getElementsByTagName('img').length} images`);
			const caption = own?.textContent.trim() ? `\n\n${td.escape(own.textContent.trim())}` : '';
			return `\n\n<div class="wp-gallery">\n\n${lines.join('\n')}\n\n</div>${caption}\n\n`;
		},
	});
	td.addRule('cf7', {
		filter: (node) => node.nodeName === 'DIV' && classes(node).includes('wpcf7'),
		replacement: () => {
			report.add('info', 'form-replaced', ref, 'Contact Form 7 form replaced by the site quote form');
			return '\n\n<!-- form:quote -->\n\n';
		},
	});
	td.addRule('keep', {
		filter: isKept,
		replacement: (_content, node) => {
			if (insideKept(node)) return ''; // the enclosing kept block carries it in its outerHTML
			report.add('warn', 'unconverted-block', ref, `${blockClass(node) ?? node.nodeName.toLowerCase()} kept as HTML`);
			return `\n\n${node.outerHTML}\n\n`;
		},
	});
	return td;
}

const decode = (s) => decodeEntities(s ?? '').trim();
const pathOf = (link) => new URL(link).pathname;

function specs(text) {
	return (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
		const at = l.indexOf(':');
		return at < 0 ? { key: l, value: '' } : { key: l.slice(0, at).trim(), value: l.slice(at + 1).trim() };
	});
}

function term(item, taxonomy) {
	return (item._embedded?.['wp:term'] ?? []).flat().find((t) => t.taxonomy === taxonomy)?.slug ?? null;
}

export function toEntry(item, kind, report, ctx = { media: new Map() }) {
	const ref = `${kind}/${item.slug}`;
	const yoast = item.yoast_head_json ?? {};
	const acf = item.acf ?? {};
	const data = {
		title: decode(item.title?.rendered),
		seoTitle: decode(yoast.title) || null,
		description: decode(yoast.description) || decode(item.excerpt?.rendered?.replace(/<[^>]+>/g, '')) || null,
		wpId: item.id,
		oldUrl: pathOf(item.link),
		date: item.date,
		image: item._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null,
	};

	if (kind === 'product') {
		const datasheet = acf.datasheet ? ctx.media.get(acf.datasheet) : null;
		if (acf.datasheet && !datasheet) report.add('error', 'missing-media', ref, `datasheet attachment ${acf.datasheet} not found`);
		Object.assign(data, {
			sku: acf.sku ?? null,
			specs: specs(acf.specs),
			datasheet: datasheet ?? null,
			category: term(item, 'product_category'),
			excerpt: decode(item.excerpt?.rendered?.replace(/<[^>]+>/g, '')),
		});
	} else if (kind === 'inventory') {
		Object.assign(data, { price: acf.price === '' || acf.price == null ? null : Number(acf.price), status: acf.status ?? null, condition: acf.condition ?? null });
	} else if (kind === 'project') {
		Object.assign(data, { clientType: acf.client_type ?? null, location: acf.location ?? null, year: acf.year ? Number(acf.year) : null });
	} else if (kind === 'post') {
		data.category = term(item, 'category');
	}

	const html = item.content?.rendered ?? '';
	for (const [, name] of html.replace(/<[^>]+>/g, ' ').matchAll(SHORTCODE_RE)) {
		report.add('warn', 'unrendered-shortcode', ref, `[${name}] left as text — its plugin output is missing`);
	}
	const body = converter(report, ref).turndown(html).trim();
	// Pages keep their full path (child pages live in subfolders); other types sit under a fixed base.
	const slug = kind === 'page' ? data.oldUrl.replace(/^\/|\/$/g, '') || item.slug : item.slug;
	return { collection: collections[kind], slug, data, body };
}
