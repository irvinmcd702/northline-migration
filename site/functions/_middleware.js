// Old WordPress links like /?p=123 or /?page_id=45 carry the post in the query
// string, which _redirects cannot match. The exporter wrote the id → URL map.
import ids from '../src/data/wp-ids.json' with { type: 'json' };

export async function onRequest({ request, next }) {
	const url = new URL(request.url);
	const id = url.searchParams.get('p') ?? url.searchParams.get('page_id');
	const target = id && ids[id];
	if (target) return Response.redirect(new URL(target, url), 301);
	return next();
}
