import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAll } from '../src/wp-client.mjs';

test('fetchAll follows X-WP-TotalPages and keeps order', async () => {
	const urls = [];
	const stub = async (url) => {
		urls.push(url);
		const page = Number(new URL(url).searchParams.get('page'));
		return new Response(JSON.stringify([{ id: page * 10 }, { id: page * 10 + 1 }]), {
			headers: { 'X-WP-TotalPages': '3' },
		});
	};
	const items = await fetchAll('http://wp.test', 'product', { fetch: stub });
	assert.deepEqual(items.map((i) => i.id), [10, 11, 20, 21, 30, 31]);
	assert.equal(urls.length, 3);
	assert.ok(urls.every((u) => u.includes('per_page=100') && u.includes('_embed')));
	assert.ok(urls[0].startsWith('http://wp.test/wp-json/wp/v2/product?'));
});

test('fetchAll maps post types to REST bases', async () => {
	const urls = [];
	const stub = async (url) => { urls.push(url); return new Response('[]', { headers: { 'X-WP-TotalPages': '1' } }); };
	await fetchAll('http://wp.test', 'page', { fetch: stub });
	await fetchAll('http://wp.test', 'post', { fetch: stub });
	assert.match(urls[0], /\/wp\/v2\/pages\?/);
	assert.match(urls[1], /\/wp\/v2\/posts\?/);
});

test('fetchAll throws on a non-200 answer', async () => {
	const stub = async () => new Response('nope', { status: 500 });
	await assert.rejects(fetchAll('http://wp.test', 'product', { fetch: stub }), /500/);
});
