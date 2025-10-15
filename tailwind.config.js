import { tailwindcss } from '@tailwindcss/vite';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  plugins: [
    // Iconify plugin configuration
    ['@iconify/tailwind4', {
      prefixes: ['ic', 'mdi', 'lucide', 'heroicons'],
      scale: 1,
    }],
  ],
}