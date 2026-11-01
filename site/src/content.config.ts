// Content collections filled by the WordPress exporter (exporter/bin/export.mjs).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const base = ({ image }: { image: () => z.ZodType }) => ({
	title: z.string(),
	seoTitle: z.string().nullable(),
	description: z.string().nullable(),
	wpId: z.number(),
	oldUrl: z.string(),
	date: z.coerce.date(),
	image: image().nullable(),
});

const collection = (dir: string, extra: (ctx: any) => Record<string, z.ZodType> = () => ({})) =>
	defineCollection({
		loader: glob({ pattern: '**/*.md', base: `./src/content/${dir}` }),
		schema: (ctx) => z.object({ ...base(ctx), ...extra(ctx) }),
	});

export const collections = {
	pages: collection('pages'),
	posts: collection('posts', () => ({ category: z.string().nullable() })),
	products: collection('products', () => ({
		sku: z.string(),
		specs: z.array(z.object({ key: z.string(), value: z.string() })),
		datasheet: z.string().nullable(),
		category: z.string(),
		excerpt: z.string(),
	})),
	inventory: collection('inventory', () => ({
		price: z.number().nullable(),
		status: z.enum(['available', 'reserved', 'sold']),
		condition: z.string().nullable(),
	})),
	projects: collection('projects', () => ({
		clientType: z.string().nullable(),
		location: z.string().nullable(),
		year: z.number().nullable(),
	})),
};
