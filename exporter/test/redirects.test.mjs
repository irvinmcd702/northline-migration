import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRedirects, buildOldUrls } from '../src/redirects.mjs';

const entries = [
	{ collection: 'products', slug: 'centrifugal-pump-cp-200', data: { wpId: 42, oldUrl: '/products/centrifugal-pump-cp-200/', category: 'centrifugal-pumps' } },
	{ collection: 'pages', slug: 'home', data: { wpId: 2, oldUrl: '/' } },
	{ collection: 'posts', slug: 'p1', data: { wpId: 7, oldUrl: '/blog/p1/', category: 'maintenance-tips' } },
];
const retired = [{ from: '/old-catalog-2019/', to: '/products/', wpId: 99 }];

test('_redirects: retired pages, blog pagination, categories and feeds', () => {
	const { redirects } = buildRedirects(entries, retired);
	const lines = redirects.trim().split('\n');
	assert.ok(lines.includes('/old-catalog-2019/ /products/ 301'));
	assert.ok(lines.includes('/old-catalog-2019 /products/ 301'));
	assert.ok(lines.includes('/blog/page/* /blog/ 301'));
	assert.ok(lines.includes('/blog/category/* /blog/ 301'));
	assert.ok(lines.includes('/feed/ / 301'));
	assert.ok(lines.indexOf('/old-catalog-2019/ /products/ 301') < lines.indexOf('/blog/category/* /blog/ 301'));
});

test('idMap resolves ?p=<id> to canonical URLs, retired IDs to their target', () => {
	const { idMap } = buildRedirects(entries, retired);
	assert.equal(idMap['42'], '/products/centrifugal-pump-cp-200/');
	assert.equal(idMap['99'], '/products/');
	assert.equal(idMap['2'], '/');
});

test('old URL list covers entries, archives, retired pages and edge cases', () => {
	const urls = buildOldUrls(entries, retired, { productCategories: ['centrifugal-pumps'], blogCategories: ['maintenance-tips'] });
	for (const u of ['/', '/products/centrifugal-pump-cp-200/', '/blog/p1/', '/products/', '/inventory/', '/projects/', '/blog/',
		'/product-category/centrifugal-pumps/', '/blog/category/maintenance-tips/', '/old-catalog-2019/', '/?p=42', '/blog/page/2/', '/feed/']) {
		assert.ok(urls.includes(u), `missing ${u}`);
	}
	assert.equal(new Set(urls).size, urls.length);
});

test('product category feeds, product pagination, tags, authors and old PDF links are covered', () => {
	const files = [{ from: '/wp-content/uploads/2026/10/datasheet-cp-200.pdf', to: '/media/datasheet-cp-200.pdf' }];
	const { redirects } = buildRedirects(entries, retired, files);
	const lines = redirects.trim().split('\n');
	for (const l of ['/product-category/:cat/feed/ /product-category/:cat/ 301', '/products/page/* /products/ 301', '/blog/tag/* /blog/ 301',
		'/blog/author/* /blog/ 301', '/wp-content/uploads/2026/10/datasheet-cp-200.pdf /media/datasheet-cp-200.pdf 301']) {
		assert.ok(lines.includes(l), `missing ${l}`);
	}
	const urls = buildOldUrls(entries, retired, { productCategories: ['centrifugal-pumps'], files });
	for (const u of ['/product-category/centrifugal-pumps/feed/', '/products/page/2/', '/wp-content/uploads/2026/10/datasheet-cp-200.pdf']) assert.ok(urls.includes(u), `missing ${u}`);
});
