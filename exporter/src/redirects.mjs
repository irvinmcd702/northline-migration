// Redirect rules and the list of old URLs the new site must answer.

// WordPress archive URLs that have no page of their own on the static site.
const ARCHIVE_RULES = [
	'/product-category/:cat/feed/ /product-category/:cat/ 301',
	'/products/page/* /products/ 301',
	'/inventory/page/* /inventory/ 301',
	'/projects/page/* /projects/ 301',
	'/blog/page/* /blog/ 301',
	'/blog/category/* /blog/ 301',
	'/blog/tag/* /blog/ 301',
	'/blog/author/* /blog/ 301',
	'/feed/ / 301',
	'/comments/feed/ / 301',
];

// Cloudflare applies the first matching rule, so specific rules come first.
// `files`: [{from: '/wp-content/uploads/…/x.pdf', to: '/media/x.pdf'}] — old links to documents.
export function buildRedirects(entries, retired, files = []) {
	const lines = [];
	for (const r of retired) {
		lines.push(`${r.from} ${r.to} 301`);
		if (r.from.length > 1 && r.from.endsWith('/')) lines.push(`${r.from.slice(0, -1)} ${r.to} 301`);
	}
	for (const f of files) lines.push(`${f.from} ${f.to} 301`);
	lines.push(...ARCHIVE_RULES);

	// `?p=<id>` links need the query string, which _redirects cannot match; a Pages middleware uses this map.
	const idMap = {};
	for (const e of entries) idMap[e.data.wpId] = e.data.oldUrl;
	for (const r of retired) if (r.wpId) idMap[r.wpId] = r.to;
	return { redirects: lines.join('\n') + '\n', idMap };
}

export function buildOldUrls(entries, retired, { productCategories = [], blogCategories = [], files = [] } = {}) {
	const urls = new Set(entries.map((e) => e.data.oldUrl));
	for (const u of ['/products/', '/inventory/', '/projects/', '/blog/']) urls.add(u);
	for (const c of productCategories) urls.add(`/product-category/${c}/`);
	for (const c of blogCategories) urls.add(`/blog/category/${c}/`);
	for (const r of retired) urls.add(r.from);
	for (const f of files) urls.add(f.from);
	const product = entries.find((e) => e.collection === 'products');
	if (product) urls.add(`/?p=${product.data.wpId}`);
	if (productCategories[0]) urls.add(`/product-category/${productCategories[0]}/feed/`);
	for (const u of ['/products/page/2/', '/blog/page/2/', '/feed/']) urls.add(u);
	return [...urls].sort();
}
