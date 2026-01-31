/**
 * vocabularyLoader.ts
 * Dynamisches Laden und Caching von SKOS-Vokabularen (KIM-Standards)
 * 
 * Features:
 * - Lädt Vokabulare von konfigurierbaren URLs
 * - In-Memory + localStorage Caching
 * - Fallback auf statische Defaults wenn Netzwerk fehlschlägt
 * - Unterstützt verschiedene Bildungskontexte (Schule, Hochschule, etc.)
 */

import { settingsStore } from '$lib/stores/settingsStore.svelte';

/**
 * Standard SKOS Concept Interface
 * Note: prefLabel is optional to maintain compatibility with AmbConcept from ambPublisher.ts
 */
export interface SkosConcept {
    id: string;
    prefLabel?: { de?: string; en?: string } | string;
    type?: 'Concept';
    notation?: string;
    broader?: string[];
    narrower?: string[];
}

/**
 * Vocabulary Cache Entry
 */
interface VocabularyCacheEntry {
    concepts: SkosConcept[];
    fetchedAt: number;
    url: string;
}

/**
 * Vocabulary Types supported by the loader
 */
export type VocabularyType = 
    | 'audience'           // Zielgruppen (LRMI educationalAudienceRole)
    | 'educationalLevel'   // Bildungsstufen (KIM educationalLevel)
    | 'learningResourceType' // Ressourcentypen (KIM HCRT)
    | 'about';             // Fächer/Themen (KIM Schulfächer oder andere)

/**
 * Default vocabulary URLs (KIM Standards)
 */
export const DEFAULT_VOCABULARY_URLS: Record<VocabularyType, string> = {
    audience: 'https://skohub.io/dini-ag-kim/lrmi-audience-role/heads/master/w3id.org/kim/lrmi-audience-role/index.json',
    educationalLevel: 'https://skohub.io/dini-ag-kim/educationalLevel/heads/main/w3id.org/kim/educationalLevel/index.json',
    learningResourceType: 'https://skohub.io/dini-ag-kim/hcrt/heads/master/w3id.org/kim/hcrt/index.json',
    about: 'https://skohub.io/dini-ag-kim/schulfaecher/heads/main/w3id.org/kim/schulfaecher/index.json'
};

/**
 * Cache TTL: 24 Stunden (in Millisekunden)
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * localStorage key prefix
 */
const CACHE_KEY_PREFIX = 'vocab-cache-';

/**
 * In-Memory Cache für schnellen Zugriff
 */
const memoryCache = new Map<VocabularyType, VocabularyCacheEntry>();

/**
 * Statische Fallback-Vokabulare (werden verwendet wenn Netzwerk fehlschlägt)
 */
const FALLBACK_VOCABULARIES: Record<VocabularyType, SkosConcept[]> = {
    audience: [
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/student', prefLabel: { de: 'Lernende', en: 'Student' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/teacher', prefLabel: { de: 'Lehrende', en: 'Teacher' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/administrator', prefLabel: { de: 'Verwaltung', en: 'Administrator' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/generalPublic', prefLabel: { de: 'Allgemeinheit', en: 'General Public' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/mentor', prefLabel: { de: 'Mentor', en: 'Mentor' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/parent', prefLabel: { de: 'Eltern', en: 'Parent' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/peerTutor', prefLabel: { de: 'Tutor', en: 'Peer Tutor' }, type: 'Concept' },
        { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/professional', prefLabel: { de: 'Fachleute', en: 'Professional' }, type: 'Concept' },
    ],
    educationalLevel: [
        { id: 'https://w3id.org/kim/educationalLevel/level_0', prefLabel: { de: 'Elementarbereich' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_1', prefLabel: { de: 'Primarbereich' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_2', prefLabel: { de: 'Sekundarbereich I' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_3', prefLabel: { de: 'Sekundarbereich II' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_4', prefLabel: { de: 'Postsekundarer nicht-tertiärer Bereich' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_5', prefLabel: { de: 'Kurzes tertiäres Bildungsprogramm' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_A', prefLabel: { de: 'Hochschule' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_B', prefLabel: { de: 'Vorbereitungsdienst' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/educationalLevel/level_C', prefLabel: { de: 'Fortbildung' }, type: 'Concept' },
    ],
    learningResourceType: [
        { id: 'https://w3id.org/kim/hcrt/application', prefLabel: { de: 'Softwareanwendung', en: 'Application' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/assessment', prefLabel: { de: 'Lernkontrolle', en: 'Assessment' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/audio', prefLabel: { de: 'Audio', en: 'Audio' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/case_study', prefLabel: { de: 'Fallstudie', en: 'Case Study' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/course', prefLabel: { de: 'Kurs', en: 'Course' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/data', prefLabel: { de: 'Daten', en: 'Data' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/diagram', prefLabel: { de: 'Diagramm', en: 'Diagram' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/drill_and_practice', prefLabel: { de: 'Übung', en: 'Drill and Practice' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/educational_game', prefLabel: { de: 'Lernspiel', en: 'Educational Game' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/experiment', prefLabel: { de: 'Experiment', en: 'Experiment' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/image', prefLabel: { de: 'Abbildung', en: 'Image' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/index', prefLabel: { de: 'Nachschlagewerk', en: 'Index' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/lesson_plan', prefLabel: { de: 'Unterrichtsplanung', en: 'Lesson Plan' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/map', prefLabel: { de: 'Karte', en: 'Map' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/portal', prefLabel: { de: 'Portal', en: 'Portal' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/questionnaire', prefLabel: { de: 'Fragebogen', en: 'Questionnaire' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/script', prefLabel: { de: 'Skript', en: 'Script' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/simulation', prefLabel: { de: 'Simulation', en: 'Simulation' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/slide', prefLabel: { de: 'Präsentation', en: 'Slide' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/text', prefLabel: { de: 'Text', en: 'Text' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/textbook', prefLabel: { de: 'Lehrbuch', en: 'Textbook' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/video', prefLabel: { de: 'Video', en: 'Video' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/web_page', prefLabel: { de: 'Webseite', en: 'Web Page' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/worksheet', prefLabel: { de: 'Arbeitsmaterial', en: 'Worksheet' }, type: 'Concept' },
        { id: 'https://w3id.org/kim/hcrt/other', prefLabel: { de: 'Sonstiges', en: 'Other' }, type: 'Concept' },
    ],
    about: [
        { id: 'http://w3id.org/kim/schulfaecher/s1005', prefLabel: { de: 'Deutsch' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1017', prefLabel: { de: 'Mathematik' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1007', prefLabel: { de: 'Englisch' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1001', prefLabel: { de: 'Biologie' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1002', prefLabel: { de: 'Chemie' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1022', prefLabel: { de: 'Physik' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1011', prefLabel: { de: 'Geschichte' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1010', prefLabel: { de: 'Geografie' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1023', prefLabel: { de: 'Politik' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1013', prefLabel: { de: 'Informatik' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1015', prefLabel: { de: 'Kunst' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1020', prefLabel: { de: 'Musik' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1031', prefLabel: { de: 'Sport' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1008', prefLabel: { de: 'Ethik' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1021', prefLabel: { de: 'Philosophie' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1024', prefLabel: { de: 'Religion (evangelische)' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1026', prefLabel: { de: 'Religion (katholische)' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1025', prefLabel: { de: 'Religion (islamische)' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1057', prefLabel: { de: 'Religion (jüdische)' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1058', prefLabel: { de: 'Sozialkunde' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1042', prefLabel: { de: 'Gesellschaftswissenschaften' }, type: 'Concept' },
        { id: 'http://w3id.org/kim/schulfaecher/s1048', prefLabel: { de: 'Arbeitslehre' }, type: 'Concept' }

    ],
};

/**
 * Parsed ein SKOS JSON-LD Dokument zu SkosConcept[]
 * Unterstützt verschiedene Formate: flaches Array, hasTopConcept, member
 */
function parseSkosJsonLd(data: unknown, baseUrl: string): SkosConcept[] {
    const concepts: SkosConcept[] = [];
    
    if (!data || typeof data !== 'object') {
        console.warn('[VocabLoader] Invalid data format');
        return concepts;
    }
    
    const doc = data as Record<string, unknown>;
    
    // Versuche verschiedene SKOS-Strukturen zu parsen
    
    // 1. hasTopConcept (ConceptScheme mit Top-Level Concepts)
    if (Array.isArray(doc.hasTopConcept)) {
        for (const concept of doc.hasTopConcept) {
            const parsed = parseConceptNode(concept, baseUrl);
            if (parsed) {
                concepts.push(parsed);
                // Rekursiv narrower Concepts hinzufügen
                if (Array.isArray(concept.narrower)) {
                    for (const narrow of concept.narrower) {
                        const narrowParsed = parseConceptNode(narrow, baseUrl);
                        if (narrowParsed) concepts.push(narrowParsed);
                    }
                }
            }
        }
    }
    
    // 2. @graph Array (JSON-LD mit mehreren Nodes)
    if (Array.isArray((doc as Record<string, unknown>)['@graph'])) {
        for (const node of (doc as Record<string, unknown>)['@graph'] as unknown[]) {
            const nodeObj = node as Record<string, unknown>;
            if (nodeObj.type === 'Concept' || nodeObj['@type'] === 'Concept' || 
                nodeObj.type === 'skos:Concept' || nodeObj['@type'] === 'skos:Concept') {
                const parsed = parseConceptNode(nodeObj, baseUrl);
                if (parsed) concepts.push(parsed);
            }
        }
    }
    
    // 3. Flaches Objekt mit id und prefLabel (einzelnes Concept)
    if (doc.id && doc.prefLabel) {
        const parsed = parseConceptNode(doc, baseUrl);
        if (parsed) concepts.push(parsed);
    }
    
    // 4. member Array (alternative SKOS-Struktur)
    if (Array.isArray(doc.member)) {
        for (const member of doc.member) {
            const parsed = parseConceptNode(member, baseUrl);
            if (parsed) concepts.push(parsed);
        }
    }
    
    console.log(`[VocabLoader] Parsed ${concepts.length} concepts from ${baseUrl}`);
    return concepts;
}

/**
 * Parsed einen einzelnen Concept-Node
 */
function parseConceptNode(node: unknown, baseUrl: string): SkosConcept | null {
    if (!node || typeof node !== 'object') return null;
    
    const obj = node as Record<string, unknown>;
    
    // ID extrahieren
    const id = (obj.id || obj['@id']) as string | undefined;
    if (!id) return null;
    
    // prefLabel extrahieren (kann verschiedene Formate haben)
    let prefLabel: SkosConcept['prefLabel'] | null = null;
    
    if (obj.prefLabel) {
        if (typeof obj.prefLabel === 'string') {
            prefLabel = obj.prefLabel;
        } else if (typeof obj.prefLabel === 'object') {
            const pl = obj.prefLabel as Record<string, unknown>;
            prefLabel = {
                de: (pl.de || pl['@value'] || pl.en) as string | undefined,
                en: pl.en as string | undefined
            };
        }
    }
    
    if (!prefLabel) return null;
    
    return {
        id,
        prefLabel,
        type: 'Concept',
        notation: obj.notation as string | undefined,
    };
}

/**
 * Holt die konfigurierte URL für ein Vokabular
 */
function getVocabularyUrl(type: VocabularyType): string {
    const settings = settingsStore.settings;
    const vocabUrls = settings.vocabularyUrls || {};
    
    // Konfigurierte URL oder Default
    return vocabUrls[type] || DEFAULT_VOCABULARY_URLS[type];
}

/**
 * Lädt ein Vokabular aus dem localStorage Cache
 */
function loadFromLocalStorage(type: VocabularyType): VocabularyCacheEntry | null {
    if (typeof localStorage === 'undefined') return null;
    
    try {
        const key = CACHE_KEY_PREFIX + type;
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const entry = JSON.parse(cached) as VocabularyCacheEntry;
        
        // Prüfe ob Cache noch gültig ist
        if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
            console.log(`[VocabLoader] Cache expired for ${type}`);
            localStorage.removeItem(key);
            return null;
        }
        
        return entry;
    } catch (e) {
        console.warn(`[VocabLoader] Error loading from localStorage:`, e);
        return null;
    }
}

/**
 * Speichert ein Vokabular im localStorage Cache
 */
function saveToLocalStorage(type: VocabularyType, entry: VocabularyCacheEntry): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
        const key = CACHE_KEY_PREFIX + type;
        localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
        console.warn(`[VocabLoader] Error saving to localStorage:`, e);
    }
}

/**
 * Lädt ein Vokabular von der konfigurierten URL
 * Verwendet Caching (Memory → localStorage → Network → Fallback)
 * 
 * @param type - Der Typ des Vokabulars
 * @param forceRefresh - Ignoriert Cache und lädt neu
 * @returns Array von SkosConcept Objekten
 */
export async function loadVocabulary(
    type: VocabularyType, 
    forceRefresh = false
): Promise<SkosConcept[]> {
    const url = getVocabularyUrl(type);
    
    // 1. Memory Cache prüfen (schnellste Option)
    if (!forceRefresh && memoryCache.has(type)) {
        const cached = memoryCache.get(type)!;
        if (Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.url === url) {
            console.log(`[VocabLoader] Using memory cache for ${type}`);
            return cached.concepts;
        }
    }
    
    // 2. localStorage Cache prüfen
    if (!forceRefresh) {
        const localCached = loadFromLocalStorage(type);
        if (localCached && localCached.url === url) {
            console.log(`[VocabLoader] Using localStorage cache for ${type}`);
            // In Memory-Cache übernehmen
            memoryCache.set(type, localCached);
            return localCached.concepts;
        }
    }
    
    // 3. Von URL laden
    console.log(`[VocabLoader] Fetching ${type} from ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json, application/ld+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const concepts = parseSkosJsonLd(data, url);
        
        if (concepts.length === 0) {
            console.warn(`[VocabLoader] No concepts found in ${url}, using fallback`);
            return FALLBACK_VOCABULARIES[type];
        }
        
        // Cache Entry erstellen
        const entry: VocabularyCacheEntry = {
            concepts,
            fetchedAt: Date.now(),
            url
        };
        
        // In beide Caches speichern
        memoryCache.set(type, entry);
        saveToLocalStorage(type, entry);
        
        console.log(`[VocabLoader] Loaded ${concepts.length} concepts for ${type}`);
        return concepts;
        
    } catch (error) {
        console.error(`[VocabLoader] Failed to load ${type}:`, error);
        console.log(`[VocabLoader] Using fallback vocabulary for ${type}`);
        return FALLBACK_VOCABULARIES[type];
    }
}

/**
 * Lädt alle Vokabulare parallel
 * @param forceRefresh - Ignoriert Cache und lädt alle neu
 */
export async function loadAllVocabularies(forceRefresh = false): Promise<{
    audience: SkosConcept[];
    educationalLevel: SkosConcept[];
    learningResourceType: SkosConcept[];
    about: SkosConcept[];
}> {
    const [audience, educationalLevel, learningResourceType, about] = await Promise.all([
        loadVocabulary('audience', forceRefresh),
        loadVocabulary('educationalLevel', forceRefresh),
        loadVocabulary('learningResourceType', forceRefresh),
        loadVocabulary('about', forceRefresh),
    ]);
    
    return { audience, educationalLevel, learningResourceType, about };
}

/**
 * Leert den Vokabular-Cache (Memory + localStorage)
 */
export function clearVocabularyCache(): void {
    memoryCache.clear();
    
    if (typeof localStorage !== 'undefined') {
        const types: VocabularyType[] = ['audience', 'educationalLevel', 'learningResourceType', 'about'];
        for (const type of types) {
            localStorage.removeItem(CACHE_KEY_PREFIX + type);
        }
    }
    
    console.log('[VocabLoader] Cache cleared');
}

/**
 * Gibt den Label eines Concepts zurück (bevorzugt Deutsch)
 */
export function getConceptLabel(concept: SkosConcept, lang: 'de' | 'en' = 'de'): string {
    if (!concept.prefLabel) {
        return concept.id;
    }
    if (typeof concept.prefLabel === 'string') {
        return concept.prefLabel;
    }
    return concept.prefLabel[lang] || concept.prefLabel.de || concept.prefLabel.en || concept.id;
}

/**
 * Findet ein Concept anhand seiner ID oder eines Partial-Matches
 */
export function findConcept(concepts: SkosConcept[], idOrKey: string): SkosConcept | undefined {
    // Exakter Match
    let found = concepts.find(c => c.id === idOrKey);
    if (found) return found;
    
    // Partial Match (z.B. "student" matched "...educationalAudienceRole/student")
    found = concepts.find(c => c.id.endsWith('/' + idOrKey) || c.id.endsWith('#' + idOrKey));
    if (found) return found;
    
    // Notation Match
    found = concepts.find(c => c.notation === idOrKey);
    return found;
}

/**
 * Konvertiert einen Key zu einer vollständigen ID
 */
export function resolveConceptId(key: string, type: VocabularyType): string {
    // Wenn bereits eine vollständige URL, direkt zurückgeben
    if (key.startsWith('http://') || key.startsWith('https://')) {
        return key;
    }
    
    // Base-URLs für die verschiedenen Vokabulare
    const baseUrls: Record<VocabularyType, string> = {
        audience: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/',
        educationalLevel: 'https://w3id.org/kim/educationalLevel/',
        learningResourceType: 'https://w3id.org/kim/hcrt/',
        about: 'http://w3id.org/kim/schulfaecher/'
    };
    
    return baseUrls[type] + key;
}
