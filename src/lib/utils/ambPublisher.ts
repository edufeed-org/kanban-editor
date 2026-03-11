// src/lib/utils/ambPublisher.ts
/**
 * AMB (Adaptive Material Bundle) Publisher Service
 * Converts Kanban boards to AMB Learning Resources and publishes them to Nostr
 */

import { ambToNostr, type AmbLearningResource } from '@edufeed-org/amb-nostr-converter';
import type { Board } from '$lib/classes/BoardModel';
import { getSyncManager } from '$lib/stores/syncManager.svelte';
import { authStore } from '$lib/stores/authStore.svelte';
import { settingsStore } from '$lib/stores/settingsStore.svelte';
import { llmRequest } from '$lib/agent/llmRequest';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { makeDataUrl, sha256Hex } from '$lib/utils/ambEncoding';
import { cardToNostrEvent, createBoardNaddrUrl } from '$lib/utils/nostrEvents';
import { 
    loadVocabulary, 
    loadAllVocabularies, 
    getConceptLabel,
    type SkosConcept,
    type VocabularyType
} from '$lib/utils/vocabularyLoader';

/**
 * Gets the Edufeed relays for AMB event publishing (Kind 30142)
 * Configured in config.json → nostr.relaysEdufeed
 * IMPORTANT: Only amb-relay.edufeed.org accepts and processes Kind 30142 events!
 */
function getEdufeedRelays(): string[] {
    const configured = settingsStore.settings.relaysEdufeed;
    if (configured && configured.length > 0) {
        return configured;
    }
    // Fallback to hardcoded default if not configured
    return ['wss://amb-relay.edufeed.org'];
}

/**
 * True when URL is a publicly shareable HTTP(S) URL (no localhost/private hostnames).
 */
function isPublicHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
            return false;
        }

        // Private IPv4 ranges should not be published as public board links.
        if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Builds an optional public board URL for r-tags.
 * Uses naddr board path for stable sharing and rejects local/private origins.
 */
function buildPublicBoardUrl(boardId: string, pubkey: string): string | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const relayHints = settingsStore.settings.relaysPublic || [];
        const naddrPath = createBoardNaddrUrl(boardId, pubkey, relayHints);
        const fullUrl = new URL(naddrPath, window.location.origin).toString();
        return isPublicHttpUrl(fullUrl) ? fullUrl : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Directly publishes a signed event to a relay via WebSocket
 * Bypasses NDK's relay status checks (useful for AUTH_REQUIRED relays that accept writes)
 */
async function directPublishToRelay(
    signedEvent: NDKEvent,
    relayUrl: string
): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve({ success: false, message: 'Timeout waiting for relay response' });
        }, 10000);

        try {
            const ws = new WebSocket(relayUrl);
            
            ws.onopen = () => {
                console.log(`[DirectPublish] 🔌 Connected to ${relayUrl}`);
                const eventJson = JSON.stringify(['EVENT', signedEvent.rawEvent()]);
                ws.send(eventJson);
                console.log(`[DirectPublish] 📤 Sent event ${signedEvent.id?.substring(0, 8)}... to ${relayUrl}`);
            };
            
            ws.onmessage = (msg) => {
                try {
                    const data = JSON.parse(msg.data);
                    console.log(`[DirectPublish] 📥 Response from ${relayUrl}:`, data);
                    
                    if (data[0] === 'OK') {
                        clearTimeout(timeout);
                        const accepted = data[2] === true;
                        ws.close();
                        resolve({ 
                            success: accepted, 
                            message: accepted ? 'Event accepted' : (data[3] || 'Event rejected')
                        });
                    } else if (data[0] === 'NOTICE') {
                        console.log(`[DirectPublish] ℹ️ NOTICE: ${data[1]}`);
                    } else if (data[0] === 'AUTH') {
                        // Relay wants AUTH - but for Kind 30142 only relay, we try without
                        console.log(`[DirectPublish] 🔐 AUTH challenge received, attempting publish anyway...`);
                    }
                } catch (e) {
                    console.warn(`[DirectPublish] Could not parse response:`, msg.data);
                }
            };
            
            ws.onerror = (err) => {
                clearTimeout(timeout);
                console.error(`[DirectPublish] ❌ WebSocket error for ${relayUrl}:`, err);
                resolve({ success: false, message: 'WebSocket error' });
            };
            
            ws.onclose = () => {
                console.log(`[DirectPublish] 🔌 Disconnected from ${relayUrl}`);
            };
        } catch (err) {
            clearTimeout(timeout);
            console.error(`[DirectPublish] ❌ Failed to connect to ${relayUrl}:`, err);
            resolve({ success: false, message: err instanceof Error ? err.message : 'Connection failed' });
        }
    });
}

/**
 * AMB Concept type for controlled vocabularies
 */
export interface AmbConcept {
    id: string;
    prefLabel?: { de?: string; en?: string } | string;
    type?: 'Concept';
}

/**
 * Audience Role vocabulary from LRMI
 * @see http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/
 */
export const AUDIENCE_ROLES: AmbConcept[] = [
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/student', prefLabel: { de: 'Lernende', en: 'Student' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/teacher', prefLabel: { de: 'Lehrende', en: 'Teacher' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/administrator', prefLabel: { de: 'Verwaltung', en: 'Administrator' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/generalPublic', prefLabel: { de: 'Allgemeinheit', en: 'General Public' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/mentor', prefLabel: { de: 'Mentor', en: 'Mentor' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/parent', prefLabel: { de: 'Eltern', en: 'Parent' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/peerTutor', prefLabel: { de: 'Tutor', en: 'Peer Tutor' }, type: 'Concept' },
    { id: 'http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/professional', prefLabel: { de: 'Fachleute', en: 'Professional' }, type: 'Concept' },
];

/**
 * Educational Level vocabulary (Bildungsstufen)
 * @see https://w3id.org/kim/educationalLevel/
 */
export const EDUCATIONAL_LEVELS: AmbConcept[] = [
    { id: 'https://w3id.org/kim/educationalLevel/level_0', prefLabel: { de: 'Elementarbereich' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_1', prefLabel: { de: 'Primarbereich' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_2', prefLabel: { de: 'Sekundarbereich I' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_3', prefLabel: { de: 'Sekundarbereich II' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_4', prefLabel: { de: 'Postsekundarer nicht-tertiärer Bereich' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_5', prefLabel: { de: 'Kurzes tertiäres Bildungsprogramm' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_A', prefLabel: { de: 'Hochschule' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_B', prefLabel: { de: 'Vorbereitungsdienst' }, type: 'Concept' },
    { id: 'https://w3id.org/kim/educationalLevel/level_C', prefLabel: { de: 'Fortbildung' }, type: 'Concept' },
];

/**
 * Learning Resource Type vocabulary (HCRT)
 * @see https://w3id.org/kim/hcrt/
 */
export const LEARNING_RESOURCE_TYPES: AmbConcept[] = [
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
];

/**
 * Schulfächer vocabulary (KIM Schulfächer)
 * @see http://w3id.org/kim/schulfaecher/
 * @see https://skohub.io/dini-ag-kim/schulfaecher/heads/main/w3id.org/kim/schulfaecher/index.json
 */
export const SCHULFAECHER: AmbConcept[] = [
    // Sprachen
    { id: 'http://w3id.org/kim/schulfaecher/s1005', prefLabel: { de: 'Deutsch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1006', prefLabel: { de: 'Deutsch als Zweitsprache' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1007', prefLabel: { de: 'Englisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1009', prefLabel: { de: 'Französisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1030', prefLabel: { de: 'Spanisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1014', prefLabel: { de: 'Italienisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1016', prefLabel: { de: 'Latein' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1000', prefLabel: { de: 'Alt-Griechisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1027', prefLabel: { de: 'Russisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1032', prefLabel: { de: 'Türkisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1003', prefLabel: { de: 'Chinesisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1035', prefLabel: { de: 'Japanisch' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1050', prefLabel: { de: 'Fremdsprachen' }, type: 'Concept' },
    // MINT
    { id: 'http://w3id.org/kim/schulfaecher/s1017', prefLabel: { de: 'Mathematik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1001', prefLabel: { de: 'Biologie' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1002', prefLabel: { de: 'Chemie' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1022', prefLabel: { de: 'Physik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1013', prefLabel: { de: 'Informatik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1019', prefLabel: { de: 'MINT' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1052', prefLabel: { de: 'Naturwissenschaften' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1040', prefLabel: { de: 'Astronomie' }, type: 'Concept' },
    // Gesellschaftswissenschaften
    { id: 'http://w3id.org/kim/schulfaecher/s1011', prefLabel: { de: 'Geschichte' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1010', prefLabel: { de: 'Geografie' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1023', prefLabel: { de: 'Politik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1058', prefLabel: { de: 'Sozialkunde' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1033', prefLabel: { de: 'Wirtschaftskunde' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1054', prefLabel: { de: 'Recht' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1042', prefLabel: { de: 'Gesellschaftswissenschaften' }, type: 'Concept' },
    // Religion & Ethik (alle 6 Religionen aus KIM-Standard)
    { id: 'http://w3id.org/kim/schulfaecher/s1008', prefLabel: { de: 'Ethik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1021', prefLabel: { de: 'Philosophie' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1055', prefLabel: { de: 'Religion (konfessionslos)' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1056', prefLabel: { de: 'Religionslehre (alevitisch)' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1024', prefLabel: { de: 'Religionslehre (evangelisch)' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1025', prefLabel: { de: 'Religionslehre (islamisch)' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1057', prefLabel: { de: 'Religionslehre (jüdisch)' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1026', prefLabel: { de: 'Religionslehre (katholisch)' }, type: 'Concept' },
    // Kunst & Musik
    { id: 'http://w3id.org/kim/schulfaecher/s1015', prefLabel: { de: 'Kunst' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1020', prefLabel: { de: 'Musik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1004', prefLabel: { de: 'Darstellendes Spiel' }, type: 'Concept' },
    // Praktische Fächer
    { id: 'http://w3id.org/kim/schulfaecher/s1031', prefLabel: { de: 'Sport' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1059', prefLabel: { de: 'Technik' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1047', prefLabel: { de: 'Hauswirtschaft' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1048', prefLabel: { de: 'Arbeitslehre' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1060', prefLabel: { de: 'Textiles Gestalten' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1061', prefLabel: { de: 'Werken und Gestalten' }, type: 'Concept' },
    // Sonstige
    { id: 'http://w3id.org/kim/schulfaecher/s1028', prefLabel: { de: 'Sachunterricht' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1046', prefLabel: { de: 'Medienbildung' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1049', prefLabel: { de: 'Berufs- und Studienorientierung' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1012', prefLabel: { de: 'Gesundheit' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1044', prefLabel: { de: 'Ernährung' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1043', prefLabel: { de: 'Psychologie' }, type: 'Concept' },
    { id: 'http://w3id.org/kim/schulfaecher/s1045', prefLabel: { de: 'Erziehungswissenschaften' }, type: 'Concept' },
];

/**
 * Ergebnis der LLM-basierten Metadaten-Analyse
 */
export interface AmbMetadataSuggestion {
    /** Vorgeschlagene Zielgruppen (audience role IDs) */
    audience: string[];
    /** Vorgeschlagene Bildungsstufen (educational level IDs) */
    educationalLevel: string[];
    /** Vorgeschlagene Ressourcentypen (HCRT IDs) */
    learningResourceType: string[];
    /** Vorgeschlagene Fächer/Themen (about IDs - z.B. Schulfächer) */
    about: string[];
    /** Vorgeschlagene Kompetenzen (Freitext) */
    teaches: string[];
    /** Vorgeschlagene Tags */
    tags: string[];
    /** Vorgeschlagene Beschreibung (falls aktuelle unpassend oder leer) */
    suggestedDescription?: string;
    /** Kurze Begründung des LLM */
    reasoning?: string;
}

/**
 * Analysiert ein Board mit einem LLM und schlägt passende AMB-Metadaten vor.
 * Nutzt die in den Settings konfigurierte LLM-Instanz.
 * Lädt die Vokabulare dynamisch von den konfigurierten URLs (mit Caching).
 * 
 * @param board - Das zu analysierende Board
 * @returns Vorschläge für AMB-Metadaten
 */
export async function suggestAmbMetadata(board: Board): Promise<AmbMetadataSuggestion> {
    const boardData = board.getContextData(true);
    
    // Lade alle Vokabulare dynamisch (mit Caching)
    console.log('📚 Lade AMB-Vokabulare...');
    const vocabularies = await loadAllVocabularies();
    console.log('✅ Vokabulare geladen:', {
        audience: vocabularies.audience.length,
        educationalLevel: vocabularies.educationalLevel.length,
        learningResourceType: vocabularies.learningResourceType.length,
        about: vocabularies.about.length
    });
    
    // Erstelle eine kompakte Zusammenfassung des Boards
    const boardSummary = {
        name: boardData.name,
        description: boardData.description,
        columns: boardData.columns.map((col: { name: string; cards: Array<{ heading: string; content?: string }> }) => ({
            name: col.name,
            cards: col.cards.map((card: { heading: string; content?: string }) => ({
                title: card.heading,
                content: card.content?.substring(0, 200) // Begrenzen für Token-Effizienz
            }))
        })),
        existingTags: boardData.tags || []
    };
    
    // Hilfsfunktion um SkosConcept zu kompakter Option zu konvertieren
    const formatVocabOptions = (concepts: SkosConcept[]): string => {
        return concepts.map(c => {
            const label = getConceptLabel(c, 'de');
            const key = c.id.split('/').pop();
            return `${key}: ${label}`;
        }).join(', ');
    };
    
    // Verfügbare Vokabular-Optionen als kompakte Listen
    const audienceOptions = formatVocabOptions(vocabularies.audience);
    const levelOptions = formatVocabOptions(vocabularies.educationalLevel);
    const resourceTypeOptions = formatVocabOptions(vocabularies.learningResourceType);
    const aboutOptions = formatVocabOptions(vocabularies.about);
    
    const systemPrompt = `Du bist ein Metadaten-Assistent für Bildungsmaterialien. Analysiere das Kanban-Board und gib NUR ein JSON-Objekt zurück.

⚠️ WICHTIG: Deine GESAMTE Antwort muss ein valides JSON-Objekt sein. KEIN Text davor oder danach!

Format:
{"audience":["key1"],"educationalLevel":["level_X"],"learningResourceType":["type1"],"about":["fach1"],"teaches":["Kompetenz"],"tags":["tag1"],"suggestedDescription":"Kurze prägnante Beschreibung","reasoning":"Begründung"}

Wähle aus:
- audience (Zielgruppe): ${audienceOptions}
- educationalLevel (Bildungsstufe): ${levelOptions}  
- learningResourceType (Ressourcentyp): ${resourceTypeOptions}
- about (Schulfach/Themengebiet): ${aboutOptions}
- teaches: 2-4 Kompetenzen auf Deutsch
- tags: 3-6 Schlagworte auf Deutsch
- suggestedDescription: Prüfe ob die aktuelle Beschreibung zum Board-Inhalt passt. Falls nicht oder leer, schlage eine bessere vor (1-2 Sätze, max 200 Zeichen)`;
    
    const userMessage = `Board: ${boardSummary.name}
Beschreibung: ${boardSummary.description || 'Keine'}
Spalten: ${boardSummary.columns.map((c: { name: string; cards: Array<{ title: string }> }) => 
    `${c.name} (${c.cards.map((card: { title: string }) => card.title).join(', ')})`
).join(' | ')}

Antworte NUR mit JSON:`;
    
    // Interface für das erwartete LLM-Ergebnis
    interface LlmMetadataResult {
        audience?: string[];
        educationalLevel?: string[];
        learningResourceType?: string[];
        about?: string[];
        teaches?: string[];
        tags?: string[];
        reasoning?: string;
        suggestedDescription?: string;
    }
    
    // Hilfsfunktion zum Extrahieren von JSON aus Text
    const extractJson = (text: string): LlmMetadataResult | null => {
        console.log('🔍 Versuche JSON zu extrahieren aus:', text.substring(0, 500));
        
        // Versuche verschiedene Patterns
        const patterns = [
            // Markdown Code-Block
            /```(?:json)?\s*([\s\S]*?)```/,
            // Einfaches JSON-Objekt
            /(\{[\s\S]*?\})/
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    const cleaned = match[1].trim();
                    console.log('📦 Gefundenes JSON-Match:', cleaned.substring(0, 200));
                    return JSON.parse(cleaned);
                } catch (e) {
                    console.log('❌ JSON Parse fehlgeschlagen:', e);
                    continue;
                }
            }
        }
        
        // Fallback: Versuche strukturierte Daten aus Reasoning-Text zu extrahieren
        // Suche nach Mustern wie: audience: ["key1", "key2"]
        try {
            const result: Partial<LlmMetadataResult> = {};
            
            // audience Array
            const audienceMatch = text.match(/audience[:\s]*\[([^\]]+)\]/i);
            if (audienceMatch) {
                result.audience = audienceMatch[1].split(',').map(s => 
                    s.trim().replace(/['"]/g, '')
                ).filter(s => s);
            }
            
            // educationalLevel Array
            const levelMatch = text.match(/educationalLevel[:\s]*\[([^\]]+)\]/i);
            if (levelMatch) {
                result.educationalLevel = levelMatch[1].split(',').map(s => 
                    s.trim().replace(/['"]/g, '')
                ).filter(s => s);
            }
            
            // learningResourceType Array
            const typeMatch = text.match(/learningResourceType[:\s]*\[([^\]]+)\]/i);
            if (typeMatch) {
                result.learningResourceType = typeMatch[1].split(',').map(s => 
                    s.trim().replace(/['"]/g, '')
                ).filter(s => s);
            }
            
            // about Array (Schulfächer)
            const aboutMatch = text.match(/about[:\s]*\[([^\]]+)\]/i);
            if (aboutMatch) {
                result.about = aboutMatch[1].split(',').map(s => 
                    s.trim().replace(/['"]/g, '')
                ).filter(s => s);
            }
            
            // teaches Array (auch als kommagetrennte Liste)
            const teachesMatch = text.match(/teaches[:\s]*\[([^\]]+)\]/i);
            if (teachesMatch) {
                result.teaches = teachesMatch[1].split(',').map(s => 
                    s.trim().replace(/['"]/g, '')
                ).filter(s => s);
            }
            
            // tags Array
            const tagsMatch = text.match(/tags[:\s]*\[([^\]]+)\]/i);
            if (tagsMatch) {
                result.tags = tagsMatch[1].split(',').map(s => 
                    s.trim().replace(/['"]/g, '')
                ).filter(s => s);
            }
            
            // reasoning (Text nach reasoning:)
            const reasoningMatch = text.match(/reasoning[:\s]*["']([^"']+)["']/i);
            if (reasoningMatch) {
                result.reasoning = reasoningMatch[1];
            }
            
            // Prüfe ob wir genug Daten haben
            if (result.audience?.length || result.educationalLevel?.length || result.learningResourceType?.length || result.about?.length) {
                console.log('✅ Extrahierte Struktur aus Text:', result);
                return result as LlmMetadataResult;
            }
        } catch (e) {
            console.log('⚠️ Strukturierte Extraktion fehlgeschlagen:', e);
        }
        
        // Letzter Versuch: Abgeschnittenes JSON reparieren
        try {
            let truncated = text.trim();
            // Entferne abgeschnittene Strings und schließe JSON
            truncated = truncated.replace(/,?\s*"[^"]*$/, '');  // Abgeschnittener String
            truncated = truncated.replace(/,?\s*\[\s*$/, '');    // Abgeschnittenes Array
            // Zähle offene Klammern und schließe sie
            const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length;
            const openBraces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length;
            truncated += ']'.repeat(Math.max(0, openBrackets));
            truncated += '}'.repeat(Math.max(0, openBraces));
            
            console.log('🔧 Repariertes JSON:', truncated.substring(0, 300));
            const repaired = JSON.parse(truncated);
            if (repaired.audience || repaired.educationalLevel || repaired.learningResourceType || repaired.about) {
                console.log('✅ Abgeschnittenes JSON erfolgreich repariert');
                return repaired;
            }
        } catch (e) {
            console.log('⚠️ JSON-Reparatur fehlgeschlagen:', e);
        }
        
        return null;
    };
    
    try {
        const rawResult = await llmRequest<LlmMetadataResult>({
            systemPrompt,
            userMessage,
            returnType: 'json',
            temperature: 0.3,
            maxTokens: 8000  // Reasoning-Modelle brauchen mehr Tokens
        });
        
        console.log('🤖 LLM raw response:', typeof rawResult, rawResult);
        
        // Stelle sicher, dass wir ein Objekt haben
        let result: LlmMetadataResult;
        
        if (typeof rawResult === 'object' && rawResult !== null) {
            result = rawResult as LlmMetadataResult;
        } else if (typeof rawResult === 'string') {
            // Versuche JSON zu parsen
            try {
                result = JSON.parse(rawResult);
            } catch {
                // Versuche JSON aus dem Text zu extrahieren
                const extracted = extractJson(rawResult);
                if (extracted) {
                    result = extracted;
                } else {
                    throw new Error('Konnte kein gültiges JSON aus der LLM-Antwort extrahieren');
                }
            }
        } else {
            throw new Error('Unerwarteter Antworttyp vom LLM');
        }
        
        // Map die Keys zu vollständigen IDs (funktioniert mit SkosConcept)
        const mapToFullIds = (keys: string[] | undefined, vocabulary: SkosConcept[]): string[] => {
            if (!keys) return [];
            return keys
                .map(key => {
                    // Prüfe ob bereits volle ID
                    if (key.startsWith('http')) return key;
                    // Suche nach Key am Ende der ID
                    const found = vocabulary.find(v => v.id.endsWith('/' + key) || v.id.endsWith('#' + key));
                    return found?.id;
                })
                .filter((id): id is string => !!id);
        };
        
        return {
            audience: mapToFullIds(result.audience, vocabularies.audience),
            educationalLevel: mapToFullIds(result.educationalLevel, vocabularies.educationalLevel),
            learningResourceType: mapToFullIds(result.learningResourceType, vocabularies.learningResourceType),
            about: mapToFullIds(result.about, vocabularies.about),
            teaches: result.teaches || [],
            tags: result.tags || [],
            reasoning: result.reasoning,
            suggestedDescription: result.suggestedDescription
        };
    } catch (error) {
        console.error('LLM metadata suggestion failed:', error);
        // Wirf den Fehler weiter, damit die UI ihn anzeigen kann
        throw error;
    }
}

export interface AmbPublishOptions {
    /**
     * Nostr public key (hex format) of the publisher
     */
    pubkey: string;
    
    /**
     * Optional: Override the board title
     */
    title?: string;
    
    /**
     * Optional: Override the board description
     */
    description?: string;
    
    /**
     * Optional: Override tags
     */
    tags?: string[];
    
    /**
     * Optional: Override license
     */
    license?: string;
    
    /**
     * Optional: Learning Resource Type(s) - array of HCRT concept IDs
     * @see https://w3id.org/kim/hcrt/
     */
    learningResourceType?: string[];
    
    /**
     * Optional: Target audience(s) - array of LRMI audience role IDs
     * @see http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/
     */
    audience?: string[];
    
    /**
     * Optional: Educational level(s) - array of Bildungsstufen IDs
     * @see https://w3id.org/kim/educationalLevel/
     */
    educationalLevel?: string[];
    
    /**
     * Optional: Subject/Topic area(s) - array of Schulfächer or other "about" concept IDs
     * @see http://w3id.org/kim/schulfaecher/
     */
    about?: string[];
    
    /**
     * Optional: Competencies/skills that this resource teaches (free text)
     */
    teaches?: string[];
    
    /**
     * Optional: Dry-run mode - logs the event to console without publishing
     * Useful for testing without spamming the relay
     */
    dryRun?: boolean;
}

export interface AmbPublishResult {
    success: boolean;
    eventId?: string;
    error?: string;
    ambResource?: AmbLearningResource;
    /** nevent1 encoded ID with relay hints for direct lookup */
    neventUrl?: string;
    /** naddr1 encoded address for the AMB resource */
    naddrUrl?: string;
}

/**
 * Converts a Kanban Board to an AMB Learning Resource
 */
export function boardToAmbResource(
    board: Board,
    options: Partial<AmbPublishOptions> = {}
): AmbLearningResource {
    // Extract board metadata
    const boardData = board.getContextData(true);
    
    // Build the creator information
    const creator: any[] = [];
    if (board.author) {
        creator.push({
            type: 'Person',
            id: `nostr:${board.author}`, // Nostr pubkey as identifier
            name: board.authorName || board.author.substring(0, 8) + '...'
        });
    }
    
    // Map CC license to full URL
    const licenseUrl = mapCCLicenseToUrl(options.license || boardData.ccLicense || 'cc-by-4.0');
    
    // Build keywords from board tags only (column names excluded - too generic for search)
    const keywords: string[] = [
        ...(options.tags || boardData.tags || [])
    ];
    
    // Generate a unique ID for the resource
    const resourceId = `nostr:kanban:${board.id}`;
    
    // Build the AMB Learning Resource
    const ambResource: AmbLearningResource = {
        '@context': ['https://w3id.org/kim/amb/context.jsonld'],
        id: resourceId,
        type: ['LearningResource', 'kanbanBoard'], 
        name: options.title || boardData.name || 'Untitled Board',
        creator: creator.length > 0 ? creator : undefined,
        description: options.description || boardData.description || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        license: {
            id: licenseUrl
        },
        // Additional metadata
        dateCreated: board.createdAt 
            ? (typeof board.createdAt === 'number' 
                ? new Date(board.createdAt * 1000).toISOString() 
                : new Date(board.createdAt).toISOString())
            : undefined,
        dateModified: boardData.updatedAt,
    };
    
    // Add learningResourceType if provided
    if (options.learningResourceType && options.learningResourceType.length > 0) {
        (ambResource as any).learningResourceType = options.learningResourceType.map(id => {
            const concept = LEARNING_RESOURCE_TYPES.find(t => t.id === id);
            return concept ? { ...concept } : { id };
        });
    }
    
    // Add audience if provided
    if (options.audience && options.audience.length > 0) {
        (ambResource as any).audience = options.audience.map(id => {
            const concept = AUDIENCE_ROLES.find(a => a.id === id);
            return concept ? { ...concept } : { id };
        });
    }
    
    // Add educationalLevel if provided
    if (options.educationalLevel && options.educationalLevel.length > 0) {
        (ambResource as any).educationalLevel = options.educationalLevel.map(id => {
            const concept = EDUCATIONAL_LEVELS.find(l => l.id === id);
            return concept ? { ...concept } : { id };
        });
    }
    
    // Add teaches (competencies) if provided
    if (options.teaches && options.teaches.length > 0) {
        // teaches can be free text or competency references
        (ambResource as any).teaches = options.teaches.map(text => ({
            type: 'DefinedTerm',
            name: text
        }));
    }
    
    // Add about (subject/topic - e.g. Schulfächer) if provided
    if (options.about && options.about.length > 0) {
        (ambResource as any).about = options.about.map(id => {
            const concept = SCHULFAECHER.find(s => s.id === id);
            return concept ? { ...concept } : { id };
        });
    }
    
    return ambResource;
}

/**
 * Publishes a board as an AMB Learning Resource to Nostr
 */
export async function publishBoardToEdufeed(
    board: Board,
    options: AmbPublishOptions
): Promise<AmbPublishResult> {
    try {
        // Enforce publish-state: only published boards may be shared to Edufeed
        const boardDataCheck = board.getContextData(true);
        if (boardDataCheck.publishState !== 'published') {
            return {
                success: false,
                error: "Das Board muss 'Veröffentlicht' sein, um auf Edufeed zu teilen. Setze den Veröffentlichungsstatus in den Boardeinstellungen auf \"veröffentlicht\" und versuche es erneut."
            };
        }
        // Convert board to AMB resource
        const ambResource = boardToAmbResource(board, options);
        
        // Convert AMB to Nostr event
        const result = ambToNostr(ambResource, {
            pubkey: options.pubkey
        });
        
        if (!result.success || !result.data) {
            return {
                success: false,
                error: 'Failed to convert AMB resource to Nostr event'
            };
        }
        
        // Get the Nostr event
        const nostrEvent = result.data;
        
        // Create NDKEvent for publishing
        const syncManager = getSyncManager();
        
        // Get NDK instance - syncManager should expose it or we get it from settings
        let ndk: NDK | null = null;
        try {
            // Try to access NDK through syncManager's public interface
            ndk = syncManager.ndk;
        } catch {
            return {
                success: false,
                error: 'NDK not accessible'
            };
        }
        
        if (!ndk) {
            return {
                success: false,
                error: 'NDK not initialized'
            };
        }

        // Optional web URL for additional r-tags (only if publicly shareable).
        const boardWebUrl = buildPublicBoardUrl(board.id, options.pubkey);
        
        // Publish snapshot (30303) with full board JSON, attach snapshot id + checksum to AMB tags
        try {
            const boardContext = board.getContextData(true);
            const snapshotEvent = new NDKEvent(ndk);
            snapshotEvent.kind = 30303;
            snapshotEvent.content = JSON.stringify(boardContext);
            // Include both 'd' tag (for replaceable events) and 'a' tag (for VersionHistory query)
            const boardAddressRef = `30301:${options.pubkey}:${board.id}`;
            snapshotEvent.tags = [
                ['d', board.id],
                ['a', boardAddressRef],  // Required for loadSnapshots() to find this snapshot
                ['v', 'Edufeed Publish'],  // Label for VersionHistory
                ['r', 'publish']  // Reason: published to Edufeed
            ];

            // Add optional board web URL as additional r-tag.
            // Keep r=publish first because existing snapshot parsing reads first r-tag as reason.
            if (boardWebUrl) {
                snapshotEvent.tags.push(['r', boardWebUrl]);
            }
            await snapshotEvent.sign();
            
            // Dry-run mode: log snapshot event but don't publish
            if (options.dryRun) {
                console.log('🧪 [DRY-RUN] Snapshot Event (Kind 30303) würde gesendet werden:');
                console.log(JSON.stringify(snapshotEvent.rawEvent(), null, 2));
            } else {
                // Publish snapshot to NORMAL relays (NOT Edufeed - they only accept Kind 30142!)
                // Pass undefined to use default relays from NDK pool
                await syncManager.publishOrQueue(snapshotEvent, 'board', 'high', 'published', undefined);
            }

            const snapshotId = snapshotEvent.id;
            const snapshotSha = await sha256Hex(boardContext);

            // Ensure tags array exists and attach snapshot info
            nostrEvent.tags = nostrEvent.tags || [];
            if (snapshotId) {
                nostrEvent.tags.push(['snapshot-eventid', snapshotId]);
                nostrEvent.tags.push(['sha256', snapshotSha]);
            }
        } catch (err) {
            console.warn('Could not publish snapshot event:', err);
        }

        // ⚡ WICHTIG: Alle Cards auf Edufeed-Relays publizieren!
        // Ohne Cards erscheint das Board leer, da nur AMB + Board-Event nicht ausreichen.
        try {
            console.log('[AMBPublisher] 📤 Publishing all cards to Edufeed relays...');
            const boardRef = `30301:${options.pubkey}:${board.id}`;
            let publishedCardsCount = 0;
            
            for (const column of board.columns) {
                for (const card of column.cards) {
                    try {
                        const rank = column.cards.indexOf(card);
                        const cardEvent = cardToNostrEvent(
                            card,
                            column.id,
                            column.name,
                            rank,
                            boardRef,
                            ndk
                        );
                        
                        // Dry-run mode: log card event but don't publish
                        if (options.dryRun) {
                            console.log(`🧪 [DRY-RUN] Card Event (Kind 30302) für "${card.heading}" würde gesendet werden:`);
                            console.log(JSON.stringify(cardEvent.rawEvent(), null, 2));
                        } else {
                            // Publish cards to NORMAL relays (NOT Edufeed - they only accept Kind 30142!)
                            // Pass undefined to use default relays from NDK pool
                            await syncManager.publishOrQueue(
                                cardEvent,
                                'card',
                                'normal',
                                'published',
                                undefined
                            );
                        }
                        publishedCardsCount++;
                    } catch (cardErr) {
                        console.warn(`[AMBPublisher] ⚠️ Could not publish card ${card.id}:`, cardErr);
                    }
                }
            }
            console.log(`[AMBPublisher] ✅ Published ${publishedCardsCount} cards to Edufeed relays`);
        } catch (err) {
            console.warn('[AMBPublisher] ⚠️ Could not publish cards:', err);
        }

        // Attach board address tag ('a') in canonical format: kind:pubkey:d-tag
        // Optional third value: relay hint where the referenced board event can be fetched.
        const boardAddress = `30301:${options.pubkey}:${board.id}`;
        const boardRelayHint = settingsStore.settings.relaysPublic[0];
        nostrEvent.tags = nostrEvent.tags || [];
        if (boardRelayHint) {
            nostrEvent.tags.push(['a', boardAddress, boardRelayHint]);
        } else {
            nostrEvent.tags.push(['a', boardAddress]);
        }

        // Optional board web URL reference for clients that resolve external links.
        if (boardWebUrl) {
            nostrEvent.tags.push(['r', boardWebUrl]);
        }

        // Mark resource as published for downstream consumers
        nostrEvent.tags = nostrEvent.tags || [];
        nostrEvent.tags.push(['pub', 'published']);

        // ===========================================
        // 🏷️ PROVENANCE TAGS (Edufeed NIP)
        // https://github.com/edufeed-org/nips/blob/edufeed-amb/edufeed.md#provenance
        // ===========================================
        
        // Relay hint for p-tags: Use a public relay where profile (Kind 0) can be found
        // The author's profile is published to the user's configured public relays, not Edufeed relays
        const profileRelay = settingsStore.settings.relaysPublic[0] || getEdufeedRelays()[0] || '';
        
        // 1. Creator p-tag: ["p", <pubkey-hex>, <relay>, "creator"]
        nostrEvent.tags.push(['p', options.pubkey, profileRelay, 'creator']);
        
        // 2. Contributor p-tags for maintainers: ["p", <pubkey-hex>, <relay>, "contributor"]
        if (board.maintainers && board.maintainers.length > 0) {
            const uniqueMaintainers = Array.from(
                new Set(board.maintainers.filter(pubkey => 
                    typeof pubkey === 'string' && pubkey && pubkey !== options.pubkey
                ))
            );
            for (const maintainerPubkey of uniqueMaintainers) {
                nostrEvent.tags.push(['p', maintainerPubkey, profileRelay, 'contributor']);
            }
        }
        
        // 3. Creator name tag: ["creator:name", <displayName>]
        // Extract display name from authStore (logged-in user's profile name)
        const creatorDisplayName = authStore.getDisplayName();
        if (creatorDisplayName && creatorDisplayName !== 'Nostr Nutzer') {
            nostrEvent.tags.push(['creator:name', creatorDisplayName]);
        }

        // Create NDKEvent for AMB and publish
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = nostrEvent.kind;
        ndkEvent.content = nostrEvent.content;
        ndkEvent.tags = nostrEvent.tags;
        ndkEvent.created_at = nostrEvent.created_at;

        // Sign the event
        await ndkEvent.sign();

        // Dry-run mode: log AMB event but don't publish
        if (options.dryRun) {
            console.log('\n' + '='.repeat(80));
            console.log('🧪 [DRY-RUN] AMB Learning Resource Event (Kind 30142) würde gesendet werden:');
            console.log('='.repeat(80));
            console.log(JSON.stringify(ndkEvent.rawEvent(), null, 2));
            console.log('='.repeat(80));
            console.log('🧪 [DRY-RUN] Ziel-Relays:', getEdufeedRelays());
            console.log('🧪 [DRY-RUN] Event wurde NICHT gesendet (dry-run mode)');
            console.log('='.repeat(80) + '\n');
        } else {
            // Publish AMB event (Kind 30142) DIRECTLY to Edufeed relays
            // We use direct WebSocket publish because:
            // 1. amb-relay.edufeed.org ONLY accepts Kind 30142 (not even AUTH events!)
            // 2. NDK marks it as AUTH_REQUIRED and refuses to publish
            // 3. Direct publish bypasses NDK's relay status checks
            console.log('[AMBPublisher] 📤 Publishing AMB event directly to Edufeed relays...');
            
            const edufeedRelays = getEdufeedRelays();
            let publishedToAny = false;
            
            for (const relayUrl of edufeedRelays) {
                console.log(`[AMBPublisher] 🎯 Publishing to ${relayUrl}...`);
                const result = await directPublishToRelay(ndkEvent, relayUrl);
                
                if (result.success) {
                    console.log(`[AMBPublisher] ✅ Successfully published to ${relayUrl}`);
                    publishedToAny = true;
                } else {
                    console.warn(`[AMBPublisher] ⚠️ Failed to publish to ${relayUrl}: ${result.message}`);
                }
            }
            
            if (!publishedToAny) {
                console.error('[AMBPublisher] ❌ Failed to publish to any Edufeed relay');
                return {
                    success: false,
                    error: 'Failed to publish to any Edufeed relay'
                };
            }
        }

        console.log(options.dryRun ? '🧪 [DRY-RUN] AMB Learning Resource erstellt (nicht gesendet):' : '✅ Published AMB Learning Resource to Nostr:', {
            eventId: ndkEvent.id,
            kind: ndkEvent.kind,
            boardId: board.id,
            resourceId: ambResource.id
        });

        // Generate URLs with relay hints for easy sharing
        let neventUrl: string | undefined;
        let naddrUrl: string | undefined;
        
        if (ndkEvent.id) {
            try {
                const nevent = nip19.neventEncode({
                    id: ndkEvent.id,
                    relays: getEdufeedRelays(),
                    author: options.pubkey
                });
                neventUrl = `https://njump.edufeed.org/${nevent}`;
            } catch (e) {
                console.warn('Could not encode nevent:', e);
            }
        }
        
        try {
            // d-tag for AMB is the resource ID (same as ambResource.id)
            const dTag = nostrEvent.tags?.find(t => t[0] === 'd')?.[1] || ambResource.id;
            const naddr = nip19.naddrEncode({
                kind: 30142,
                pubkey: options.pubkey,
                identifier: dTag,
                relays: getEdufeedRelays()
            });
            naddrUrl = `https://njump.edufeed.org/${naddr}`;
        } catch (e) {
            console.warn('Could not encode naddr:', e);
        }

        console.log('🔗 Share URLs:', { neventUrl, naddrUrl });

        return {
            success: true,
            eventId: ndkEvent.id,
            ambResource,
            neventUrl,
            naddrUrl
        };
        
    } catch (error) {
        console.error('❌ Error publishing to Edufeed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Maps Creative Commons license codes to full URLs
 */
function mapCCLicenseToUrl(license: string): string {
    const licenseMap: Record<string, string> = {
        'cc-by-4.0': 'https://creativecommons.org/licenses/by/4.0/',
        'cc-by-sa-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'cc-by-nc-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
        'cc-by-nc-sa-4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        'cc-by-nd-4.0': 'https://creativecommons.org/licenses/by-nd/4.0/',
        'cc-by-nc-nd-4.0': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        'cc0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    };
    
    return licenseMap[license] || licenseMap['cc-by-4.0'];
}
