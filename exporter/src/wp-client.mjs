// Reads every item of a type from the WordPress REST API.
const bases = { page: 'pages', post: 'posts' };

export async function fetchAll(baseUrl, type, { fetch = globalThis.fetch } = {}) {
	const items = [];
	for (let page = 1, total = 1; page <= total; page++) {
		const url = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/${bases[type] ?? type}?per_page=100&page=${page}&_embed=1`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
		total = Number(res.headers.get('X-WP-TotalPages') ?? 1);
		items.push(...(await res.json()));
	}
	return items;
}
