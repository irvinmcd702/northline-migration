// Small helpers shared by the page templates.
import productCategories from '../data/product-categories.json';
import blogCategories from '../data/blog-categories.json';

export const pageTitle = (entry: { data: { seoTitle: string | null; title: string } }) =>
	entry.data.seoTitle ?? `${entry.data.title} | Northline Industrial Supply`;

export const productCategory = (slug: string) => productCategories.find((c) => c.slug === slug);
export const blogCategory = (slug: string | null) => blogCategories.find((c) => c.slug === slug);
export { productCategories };

export const usd = (n: number | null) =>
	n == null ? 'Price on request' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const statusLabel = { available: 'Available', reserved: 'Reserved', sold: 'Sold' } as const;

export const byDateDesc = <T extends { data: { date: Date } }>(a: T, b: T) => b.data.date.valueOf() - a.data.date.valueOf();
