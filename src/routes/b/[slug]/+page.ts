// src/routes/b/[slug]/+page.ts
// Server-side parameter extraction for shortlink-based board URLs

import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
    return {
        slug: params.slug
    };
};

// Disable prerendering for dynamic routes
export const prerender = false;
