// Generates demo images (JPEG) and product datasheets (PDF) into content/media/.
// Images are deliberately heavy, like typical uploads on a WordPress site.
import { readFile, mkdir, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const out = path.join(root, 'media');
const json = async (f) => JSON.parse(await readFile(path.join(root, f), 'utf8'));
const exists = (f) => access(f).then(() => true, () => false);

const palette = {
	'centrifugal-pumps': ['#1f4e6b', '#3c8dbc'],
	'positive-displacement-pumps': ['#3b3f6b', '#7a6fbc'],
	'air-compressors': ['#22543d', '#48a37a'],
	'industrial-valves': ['#6b3a1f', '#e8731a'],
	project: ['#14212b', '#5c7080'],
	inventory: ['#4a4a4a', '#9a9a9a'],
	post: ['#2b2b40', '#e8731a'],
	about: ['#1f4e6b', '#e8731a'],
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function image(file, label, [c1, c2], w = 1800, h = 1350) {
	const target = path.join(out, file);
	if (await exists(target)) return;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
		<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
		<rect width="100%" height="100%" fill="url(#g)"/>
		<circle cx="${w * 0.68}" cy="${h * 0.45}" r="${h * 0.28}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="40"/>
		<rect x="${w * 0.12}" y="${h * 0.38}" width="${w * 0.42}" height="${h * 0.16}" rx="24" fill="#fff" fill-opacity="0.25"/>
		<text x="${w * 0.08}" y="${h * 0.85}" font-family="Arial, sans-serif" font-size="${h * 0.06}" fill="#fff">${esc(label)}</text>
		<text x="${w * 0.08}" y="${h * 0.92}" font-family="Arial, sans-serif" font-size="${h * 0.03}" fill="#fff" fill-opacity="0.7">Northline Industrial Supply — demo image</text>
	</svg>`;
	const noise = await sharp({ create: { width: w, height: h, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } })
		.png().toBuffer();
	await sharp(Buffer.from(svg))
		.composite([{ input: noise, blend: 'soft-light' }])
		.jpeg({ quality: 90 })
		.toFile(target);
}

async function datasheet(p) {
	const target = path.join(out, `datasheet-${p.slug}.pdf`);
	if (await exists(target)) return;
	const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
	doc.pipe(createWriteStream(target));
	doc.fontSize(20).text(p.title.replace('″', '"'));
	doc.moveDown(0.3).fontSize(11).fillColor('#555').text(`SKU ${p.sku} · Northline Industrial Supply`);
	doc.moveDown().fillColor('#000').fontSize(12).text(p.excerpt);
	doc.moveDown().fontSize(14).text('Specifications');
	for (const line of p.specs.split('\n')) {
		const [k, v] = line.split(/:\s*/);
		doc.moveDown(0.3).fontSize(11).text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v.replace('³', '3').replace('µ', 'u')).font('Helvetica');
	}
	doc.moveDown(2).fontSize(9).fillColor('#888').text('Demo project — fictional company. Not a real product.');
	doc.end();
}

await mkdir(out, { recursive: true });
const { products } = await json('products.json');
for (const p of products) {
	await image(`product-${p.slug}.jpg`, p.title, palette[p.category]);
	await datasheet(p);
}
for (const i of await json('inventory.json')) await image(`inventory-${i.slug}.jpg`, i.title, palette.inventory);
for (const p of await json('projects.json')) {
	await image(`project-${p.slug}.jpg`, p.title, palette.project, 1800, 1200);
	for (let n = 1; n <= p.gallery; n++) await image(`project-${p.slug}-${n}.jpg`, `${p.title} · ${n}`, palette.project, 1800, 1200);
}
for (const p of (await json('posts.json')).posts) await image(`post-${p.slug}.jpg`, p.title, palette.post, 1800, 1000);
for (const n of [1, 2, 3]) await image(`about-workshop-${n}.jpg`, `Our workshop · ${n}`, palette.about, 1800, 1200);
console.log('media ready in', out);
