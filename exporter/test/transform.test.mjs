import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toEntry } from '../src/transform.mjs';
import { Report } from '../src/report.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))[0];
const uploads = 'http://localhost:8080/wp-content/uploads/2026/10';
const ctx = { media: new Map([[8, `${uploads}/datasheet-centrifugal-pump-cp-200.pdf`]]) };

test('product: ACF fields, specs, category, datasheet and old URL', () => {
	const { collection, slug, data } = toEntry(fixture('product'), 'product', new Report(), ctx);
	assert.equal(collection, 'products');
	assert.equal(slug, 'centrifugal-pump-cp-200');
	assert.equal(data.sku, 'NL-CP-200');
	assert.deepEqual(data.specs[0], { key: 'Flow rate', value: '200 m³/h' });
	assert.equal(data.specs.length, 5);
	assert.equal(data.category, 'centrifugal-pumps');
	assert.equal(data.datasheet, `${uploads}/datasheet-centrifugal-pump-cp-200.pdf`);
	assert.equal(data.image, `${uploads}/product-centrifugal-pump-cp-200.jpg`);
	assert.equal(data.oldUrl, '/products/centrifugal-pump-cp-200/');
	assert.equal(data.wpId, 6);
	assert.equal(data.seoTitle, 'Centrifugal Pump CP-200 | Northline Industrial Supply');
	assert.match(data.description, /^End-suction pump/);
});

test('titles are decoded once: entities become characters, no double escaping', () => {
	const { data } = toEntry(fixture('product-entities'), 'product', new Report(), ctx);
	assert.equal(data.title, 'Ball Valve 2″ & Electric Actuator');
});

test('missing datasheet media is reported, not fatal', () => {
	const report = new Report();
	const { data } = toEntry(fixture('product'), 'product', report, { media: new Map() });
	assert.equal(data.datasheet, null);
	assert.ok(report.items.some((i) => i.level === 'error' && i.kind === 'missing-media'));
});

test('gallery block becomes Markdown images inside a gallery wrapper', () => {
	const report = new Report();
	const { body } = toEntry(fixture('page-gallery'), 'page', report, ctx);
	assert.match(body, /## Our workshop/);
	assert.ok(body.includes('<div class="wp-gallery">\n\n!['), body);
	assert.ok(body.includes(`](${uploads}/about-workshop-1-1024x683.jpg)`));
	assert.equal(body.split('![').length - 1, 3);
	assert.ok(body.includes('\n\n</div>'));
	assert.doesNotMatch(body, /wp-block-gallery/);
	assert.ok(report.items.some((i) => i.kind === 'gallery-converted' && i.level === 'info'));
});

test('Contact Form 7 markup becomes a form marker', () => {
	const report = new Report();
	const { body } = toEntry(fixture('page-shortcode'), 'page', report, ctx);
	assert.match(body, /<!-- form:quote -->/);
	assert.doesNotMatch(body, /<form/);
	assert.ok(report.items.some((i) => i.kind === 'form-replaced'));
});

test('embed is kept and reported', () => {
	const report = new Report();
	const { collection, data, body } = toEntry(fixture('post-embed'), 'post', report, ctx);
	assert.equal(collection, 'posts');
	assert.equal(data.category, 'maintenance-tips');
	assert.match(data.date, /^2025-11-20/);
	assert.match(body, /wp-block-embed/);
	assert.ok(report.items.some((i) => i.kind === 'unconverted-block'));
});

test('inventory: numeric price and status', () => {
	const { collection, data } = toEntry(fixture('inventory'), 'inventory', new Report(), ctx);
	assert.equal(collection, 'inventory');
	assert.equal(data.price, 5200);
	assert.equal(data.status, 'reserved');
	assert.equal(data.condition, 'Refurbished');
});

test('project: client type, location, year', () => {
	const { collection, data } = toEntry(fixture('project'), 'project', new Report(), ctx);
	assert.equal(collection, 'projects');
	assert.deepEqual([data.clientType, data.location, data.year], ['Craft brewery', 'Portland, OR', 2025]);
});

// Final review fixes ----------------------------------------------------------
const item = (html, link = 'http://localhost:8080/about/', slug = 'about') => ({ id: 1, slug, link, date: '2026-01-01T00:00:00', title: { rendered: 'T' }, content: { rendered: html } });

test('iframes, video, audio and tables are kept as HTML and reported', () => {
	const report = new Report();
	const { body } = toEntry(item('<p>Map:</p><iframe src="https://maps.example/x"></iframe><table><tr><td>a</td></tr></table><video src="v.mp4"></video>'), 'page', report, ctx);
	assert.ok(body.includes('<iframe src="https://maps.example/x"></iframe>'));
	assert.ok(body.includes('<table><tbody><tr><td>a</td></tr></tbody></table>') || body.includes('<table><tr><td>a</td></tr></table>'));
	assert.ok(body.includes('<video'));
	assert.equal(report.items.filter((i) => i.kind === 'unconverted-block').length, 3);
});

test('unknown wp-block-* elements are kept and reported; common ones convert', () => {
	const report = new Report();
	const { body } = toEntry(item('<h2 class="wp-block-heading">H</h2><div class="wp-block-buttons"><div class="wp-block-button"><a class="wp-block-button__link" href="/x/">Go</a></div></div>'), 'page', report, ctx);
	assert.ok(body.startsWith('## H'));
	assert.ok(body.includes('<div class="wp-block-buttons">'));
	assert.equal(report.items.filter((i) => i.kind === 'unconverted-block').length, 1);
});

test('unrendered shortcodes are reported', () => {
	const report = new Report();
	toEntry(item('<p>[my_shortcode id="3"]</p>'), 'page', report, ctx);
	assert.ok(report.items.some((i) => i.kind === 'unrendered-shortcode' && i.message.includes('my_shortcode')));
});

test('gallery captions survive', () => {
	const report = new Report();
	const html = '<figure class="wp-block-gallery"><figure class="wp-block-image"><img src="http://x/a.jpg" alt="A"><figcaption class="wp-element-caption">Bench test</figcaption></figure><figcaption class="blocks-gallery-caption">Our workshop in 2025</figcaption></figure>';
	const { body } = toEntry(item(html), 'page', report, ctx);
	assert.ok(body.includes('![A](http://x/a.jpg)'));
	assert.ok(body.includes('Bench test'));
	assert.ok(body.includes('Our workshop in 2025'));
});

test('escaped tags in text stay text, not live HTML', () => {
	const { body } = toEntry(item('<p>Use &lt;script&gt;alert(1)&lt;/script&gt; and &lt;br&gt;</p>'), 'page', new Report(), ctx);
	assert.ok(!body.includes('<script>'), body);
	assert.ok(body.includes('&lt;script>') && body.includes('&lt;br>'), body);
});

test('child pages keep their full path as slug', () => {
	const { slug } = toEntry(item('<p>x</p>', 'http://localhost:8080/services/pumps/', 'pumps'), 'page', new Report(), ctx);
	assert.equal(slug, 'services/pumps');
	const home = toEntry(item('<p>x</p>', 'http://localhost:8080/', 'home'), 'page', new Report(), ctx);
	assert.equal(home.slug, 'home');
});
