// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// URLs match the old WordPress site exactly: /products/<slug>/ with a trailing slash.
export default defineConfig({
	site: 'https://northline-demo-7x9.pages.dev',
	trailingSlash: 'always',
	build: { format: 'directory' },
	// Responsive srcset for every image, including images inside migrated Markdown.
	image: { layout: 'constrained', responsiveStyles: true },
	vite: { plugins: [tailwindcss()] },
	integrations: [sitemap()],
});
