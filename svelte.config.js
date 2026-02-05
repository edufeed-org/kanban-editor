import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess(), mdsvex()],
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
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
