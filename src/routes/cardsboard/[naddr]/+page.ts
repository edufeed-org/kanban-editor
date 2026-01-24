// src/routes/cardsboard/[naddr]/+page.ts
// Server-side parameter extraction for naddr-based board URLs

import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
    return {
        naddr: params.naddr
    };
};

// Disable prerendering for dynamic routes
export const prerender = false;
