/**
 * OER Finder API Client
 * 
 * Wrapper für die OER Finder REST API (http://localhost:3001)
 * Unterstützt Suche, Details-Abruf und Quellen-Auflistung.
 * 
 * @see docs/FEATURE/MCP-EDUFEED.md
 * @see F:\code\docker\mcp-oer-finder\konzept.md
 */

import { settingsStore } from '$lib/stores/settingsStore.svelte.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Ermittelt die API-Basis-URL aus Settings oder Fallback
 */
export function getApiBaseUrl(): string {
    // 1. Aus settingsStore (User-Konfiguration via config.json → mergeConfigIntoSettings)
    const settings = settingsStore?.settings;
    const settingsUrl = settings?.apiUrl;
    if (settingsUrl) return settingsUrl;
    
    // 2. Aus Environment Variable
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OER_API_URL) {
        return import.meta.env.VITE_OER_API_URL;
    }
    
    // 3. Fallback für lokale Entwicklung
    return 'http://localhost:3001';
}

// ============================================================================
// Types
// ============================================================================

export interface OerSearchParams {
    /** Suchbegriff(e) */
    searchTerm: string;
    /** Datenquelle (z.B. "rpi-virtuell", "wirlernenonline") */
    source?: string;
    /** Bildungsstufe (z.B. "Grundschule", "Sekundarstufe", "Oberstufe") */
    educationalLevel?: string;
    /** Ergebnisse pro Seite (default: 10, max: 50) */
    pageSize?: number;
    /** Seitennummer (default: 1) */
    page?: number;
}

export interface OerSearchResult {
    /** Eindeutige ID (URL oder naddr) */
    id: string;
    /** Titel der Ressource */
    title: string;
    /** Beschreibung */
    description: string;
    /** Ressourcentyp (z.B. "LearningResource", "VideoObject") */
    type: string;
    /** Vorschaubild-URL */
    image?: string;
    /** Link zur Ressource */
    url: string;
    /** Lizenz-ID (z.B. "https://creativecommons.org/licenses/by/4.0/") */
    license?: string;
    /** Lizenz-Kurzform (z.B. "CC BY 4.0") */
    licenseShort?: string;
    /** Autor/Ersteller */
    creator?: string;
    /** Herausgeber */
    publisher?: string;
    /** Datenquelle */
    source: string;
    /** Bildungsstufe(n) */
    educationalLevel?: string;
    /** Schlagwörter */
    keywords?: string[];
    /** Nostr Address (falls Nostr-Ressource) */
    naddr?: string;
}

export interface OerSource {
    /** Quellen-ID */
    id: string;
    /** Anzeigename */
    name: string;
    /** Website-URL */
    url: string;
    /** Beschreibung */
    description?: string;
}

export interface OerApiResponse {
    results: OerSearchResult[];
    totalCount: number;
    page: number;
    pageSize: number;
    error?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Extrahiert Lizenz-Kurzform aus URL
 */
function extractLicenseShort(licenseUrl?: string): string | undefined {
    if (!licenseUrl) return undefined;
    
    const ccMatch = licenseUrl.match(/creativecommons\.org\/licenses\/([\w-]+)/i);
    if (ccMatch) {
        return `CC ${ccMatch[1].toUpperCase()}`;
    }
    
    if (licenseUrl.includes('publicdomain/zero')) return 'CC0';
    if (licenseUrl.includes('publicdomain')) return 'Public Domain';
    
    return undefined;
}

/**
 * Mappt AMB-Format Response zu OerSearchResult
 */
function mapAmbToSearchResult(item: any, source: string): OerSearchResult {
    const amb = item.amb || item;
    
    return {
        id: amb.id || crypto.randomUUID(),
        title: amb.name || 'Unbenannt',
        description: amb.description || '',
        type: amb.learningResourceType?.[0]?.name 
            || amb['@type'] 
            || 'LearningResource',
        image: amb.image,
        url: amb.id,  // Im AMB-Format ist id die URL
        license: amb.license?.id,
        licenseShort: extractLicenseShort(amb.license?.id),
        creator: amb.creator?.[0]?.name,
        publisher: amb.publisher?.name,
        source: item.source || source,
        educationalLevel: amb.educationalLevel?.map((l: any) => l.name).join(', '),
        keywords: amb.keywords || [],
        naddr: item.naddr
    };
}

/**
 * Sucht OER-Materialien über die OER Finder API
 * 
 * @param params - Suchparameter
 * @returns Suchergebnisse mit Metadaten
 * 
 * @example
 * const results = await searchOer({ searchTerm: 'Klimawandel' });
 */
export async function searchOer(params: OerSearchParams): Promise<OerApiResponse> {
    const baseUrl = getApiBaseUrl();
    console.log(`🔍 [oerClient] Suche: "${params.searchTerm}" auf ${baseUrl}`);
    
    try {
        // URL mit Query-Parametern bauen
        const url = new URL(`${baseUrl}/api/v1/oer`);
        url.searchParams.set('searchTerm', params.searchTerm);
        
        if (params.source) {
            url.searchParams.set('source', params.source);
        }
        if (params.educationalLevel) {
            url.searchParams.set('educationalLevel', params.educationalLevel);
        }
        if (params.pageSize) {
            url.searchParams.set('pageSize', String(Math.min(params.pageSize, 50)));
        }
        if (params.page) {
            url.searchParams.set('page', String(params.page));
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Keine Details');
            throw new Error(`API Fehler: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // AMB-Format Response mappen
        const results = (data.data || []).map((item: any) => 
            mapAmbToSearchResult(item, params.source || 'all')
        );
        
        console.log(`✅ [oerClient] ${results.length} Ergebnisse gefunden`);
        
        return {
            results,
            totalCount: data.meta?.total || results.length,
            page: data.meta?.page || params.page || 1,
            pageSize: data.meta?.pageSize || params.pageSize || 10
        };
        
    } catch (error) {
        console.error('❌ [oerClient] Suche fehlgeschlagen:', error);
        
        const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unbekannter Fehler bei der OER-Suche';
        
        return { 
            results: [], 
            totalCount: 0,
            page: 1,
            pageSize: 10,
            error: errorMessage
        };
    }
}

/**
 * Lädt Details zu einer OER-Ressource
 * 
 * @param id - Ressourcen-ID (URL oder naddr)
 * @returns Ressourcen-Details oder null
 */
export async function getOerDetails(id: string): Promise<OerSearchResult | null> {
    const baseUrl = getApiBaseUrl();
    console.log(`📖 [oerClient] Lade Details für: ${id}`);
    
    try {
        // URL-encode die ID (kann URLs enthalten)
        const encodedId = encodeURIComponent(id);
        const url = `${baseUrl}/api/v1/oer/${encodedId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`⚠️ [oerClient] Ressource nicht gefunden: ${id}`);
                return null;
            }
            throw new Error(`API Fehler: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || !data.amb) {
            return null;
        }
        
        return mapAmbToSearchResult(data, 'details');
        
    } catch (error) {
        console.error('❌ [oerClient] Details-Abruf fehlgeschlagen:', error);
        return null;
    }
}

/**
 * Listet alle verfügbaren OER-Quellen auf
 * 
 * @returns Array von OER-Quellen
 */
export async function listOerSources(): Promise<OerSource[]> {
    const baseUrl = getApiBaseUrl();
    console.log(`📋 [oerClient] Lade Quellen-Liste von ${baseUrl}`);
    
    try {
        const url = `${baseUrl}/api/v1/sources`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Fehler: ${response.status}`);
        }

        const data = await response.json();
        
        // Response-Format: Array von Source-Objekten
        const sources: OerSource[] = (data || []).map((source: any) => ({
            id: source.id || source.name,
            name: source.name || source.id,
            url: source.url || '',
            description: source.description
        }));
        
        console.log(`✅ [oerClient] ${sources.length} Quellen geladen`);
        
        return sources;
        
    } catch (error) {
        console.error('❌ [oerClient] Quellen-Abruf fehlgeschlagen:', error);
        return [];
    }
}

/**
 * Prüft ob die OER Finder API erreichbar ist
 * 
 * @returns true wenn API erreichbar
 */
export async function checkApiHealth(): Promise<boolean> {
    const baseUrl = getApiBaseUrl();
    
    try {
        const response = await fetch(`${baseUrl}/api/v1/sources`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)  // 5s Timeout
        });
        
        return response.ok;
    } catch {
        return false;
    }
}
