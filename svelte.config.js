import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';


const isDev = process.argv.includes('dev');
const isPreview = process.argv.includes('preview');

// Determine base path:
// - Dev/Preview: empty (local development)
// - CI with BASE_PATH: use BASE_PATH (GitHub Pages deployment)
// - CI without BASE_PATH: empty
// - Production build with BASE_PATH: use BASE_PATH
const getBasePath = () => {
	if (isDev || isPreview) return '';
	return process.env.BASE_PATH || '';
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess(), mdsvex()],
	// The fallback: '404.html' and the path: { base: ... process.env.BASE_PATH } are needed to host
	// the site on GitHub Pages. Change them if it is going to be hosted somewhere else.
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			base: getBasePath()
		},
		typescript: {
			config: (config) => {
				config.compilerOptions = config.compilerOptions || {};
				config.compilerOptions.strict = true;
				config.compilerOptions.forceConsistentCasingInFileNames = true;
				return config;
			}
		}
	},
	extensions: ['.svelte', '.svx'],
	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'alt-x',
			showToggleButton: 'always',
			toggleButtonPos: 'bottom-right'
		}
	}
};

export default config;
