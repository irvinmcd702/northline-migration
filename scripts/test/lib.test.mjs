import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textOf, titleOf, recall, internalLinks, median } from '../lib.mjs';

test('textOf strips tags, scripts, styles and entities', () => {
	assert.equal(textOf('<p>Flow&nbsp;rate <b>200</b> m³/h</p><script>x=1</script><style>p{}</style>'), 'flow rate 200 m³/h');
});

test('titleOf decodes entities', () => {
	assert.equal(titleOf('<title>Ball Valve 2″ &#038; Electric Actuator | Northline</title>'), 'Ball Valve 2″ & Electric Actuator | Northline');
});

test('recall is the share of old words found in the new text', () => {
	assert.equal(recall('the pump runs dry', 'the pump runs dry today'), 1);
	assert.equal(recall('a b c d', 'a b'), 0.5);
	assert.equal(recall('', 'anything'), 1);
});

test('internalLinks finds same-site href and src, ignores external, anchors and mailto', () => {
	const html = '<a href="/products/">x</a><img src="/_astro/a.webp"><a href="https://ex.com/">e</a><a href="#main">s</a><a href="mailto:a@b.c">m</a><link rel="canonical" href="https://northline-demo.pages.dev/about/">';
	assert.deepEqual(internalLinks(html, 'https://northline-demo.pages.dev').sort(), ['/_astro/a.webp', '/about/', '/products/']);
});

test('median of three runs', () => {
	assert.equal(median([0.91, 0.97, 0.94]), 0.94);
});
