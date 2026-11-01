import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';
import ids from '../src/data/wp-ids.json' with { type: 'json' };

const next = async () => new Response('page');
const [id, target] = Object.entries(ids).find(([, url]) => url.startsWith('/products/'));

test('?p=<id> redirects 301 to the migrated URL', async () => {
	const res = await onRequest({ request: new Request(`https://northline.test/?p=${id}`), next });
	assert.equal(res.status, 301);
	assert.equal(res.headers.get('Location'), `https://northline.test${target}`);
});

test('?page_id=<id> works too', async () => {
	const res = await onRequest({ request: new Request(`https://northline.test/?page_id=${id}`), next });
	assert.equal(res.status, 301);
});

test('unknown id and normal requests pass through', async () => {
	for (const url of ['https://northline.test/?p=999999', 'https://northline.test/products/']) {
		const res = await onRequest({ request: new Request(url), next });
		assert.equal(await res.text(), 'page');
	}
});
