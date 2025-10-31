/**
 * Merge Engine für Conflict Detection & Resolution
 * Implementiert Git-ähnliches 3-way Merge für Nostr Events
 * 
 * Usecase:
 * 1. Anna bearbeitet Karte K1 ab Version V42
 * 2. Paul bearbeitet Karte K1 ab Version V42
 * 3. Paul speichert zuerst → Event V43
 * 4. Anna versucht zu speichern → Conflict Detection triggert!
 * 5. Merge Engine versucht automatisches Merge
 * 6. Falls nicht möglich → MergeConflictDialog für manuelle Lösung
 */

import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { CardProps } from '$lib/classes/BoardModel.js';

/**
 * Browser-kompatible Deep Equality Check (ersetzt util.isDeepStrictEqual)
 */
function isDeepStrictEqual(a: any, b: any): boolean {
  // Primitive types & exact same reference
  if (a === b) return true;
  
  // Different types
  if (typeof a !== typeof b) return false;
  
  // Null/undefined
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  
  // Dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isDeepStrictEqual(val, b[idx]));
  }
  
  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    
    if (aKeys.length !== bKeys.length) return false;
    if (!aKeys.every((key, idx) => key === bKeys[idx])) return false;
    
    return aKeys.every(key => isDeepStrictEqual(a[key], b[key]));
  }
  
  return false;
}

/**
 * Card Content für Merge-Engine (CardProps Subset)
 * Nutzt offizielle CardProps von BoardModel.ts
 * CRITICAL: Index-Signatur für dynamische Feld-Zugriffe (3-way merge)
 */
export interface CardContent {
  id: string;
  heading: string;
  content?: string;
  color?: string;
  image?: string;
  labels?: string[];
  publishState?: 'draft' | 'published' | 'archived';
  author?: string;
  updatedAt: string;
  [key: string]: any; // ← CRITICAL: Erlaubt dynamische Zugriffe
}

/**
 * Konflikt-Info für UI
 */
export interface ConflictingField {
  field: string; // Flexibler für dynamische Card-Properties
  baseVersion: any;
  myVersion: any;
  theirVersion: any;
  mergeResult?: {
    resolved: boolean;
    result?: any;
    conflicts?: string[];
  };
}

/**
 * Merge-Resultat
 */
export interface MergeResult {
  status: 'NO_CONFLICT' | 'AUTO_MERGED' | 'MANUAL_MERGE_REQUIRED';
  merged: CardContent | null;
  conflicts: ConflictingField[];
  conflictPercentage: number; // 0-100: Wie viel % der Felder sind in Konflikt?
}

/**
 * Editing Session: Was memorieren wir wenn User eine Karte öffnet?
 */
export interface EditingSession {
  cardId: string;
  baseVersion: CardContent;      // Die Version, mit der User anfing
  baseEventId: string;           // NDK Event ID
  baseTimestamp: number;         // created_at des base Events
  editStartTime: number;         // Wann User anfing zu editieren (local timestamp)
  clientId: string;              // Eindeutige Client-ID für Soft Lock
}

/**
 * Detector: Prüfe ob Konflikt existiert
 */
export async function detectConflict(
  session: EditingSession,
  latestEvent: NDKEvent | null
): Promise<{ conflict: boolean; latestVersion: CardContent | null }> {
  // Kein neuerer Event → Kein Konflikt
  if (!latestEvent) {
    return { conflict: false, latestVersion: null };
  }

  // Gleicher Timestamp → Niemand hat in der Zwischenzeit geändert
  if (latestEvent.created_at === session.baseTimestamp) {
    return { conflict: false, latestVersion: null };
  }

  // Neuerer Event existiert → KONFLIKT!
  if (latestEvent.created_at! > session.baseTimestamp) {
    const latestContent = JSON.parse(latestEvent.content) as CardContent;
    return { conflict: true, latestVersion: latestContent };
  }

  return { conflict: false, latestVersion: null };
}

/**
 * 3-Way Merge: Versuche automatisch zu mergen
 * 
 * Logik:
 * - Wenn nur ich ändere → meine Version
 * - Wenn nur sie ändern → ihre Version
 * - Wenn wir beide ändern → Konflikt (außer auto-mergebar)
 */
export function threeWayMerge(
  base: CardContent,
  my: CardContent,
  their: CardContent
): MergeResult {
  const conflicts: ConflictingField[] = [];
  const merged: CardContent = { ...base };
  let changedFields = 0;
  let conflictFields = 0;

  // Pro Feld: Analysiere Änderungen
  const fields: string[] = ['heading', 'content', 'labels', 'updatedAt', 'color', 'image', 'author'];

  for (const field of fields) {
    const baseVal = (base as any)[field];
    const myVal = (my as any)[field];
    const theirVal = (their as any)[field];

    // Niemand ändert das Feld (deep equality)
    if (deepEqual(myVal, baseVal) && deepEqual(theirVal, baseVal)) {
      continue;
    }

    changedFields++;

    // Nur ich ändere (deep equality checks)
    if (!deepEqual(myVal, baseVal) && deepEqual(theirVal, baseVal)) {
      (merged as any)[field] = myVal;
      continue;
    }

    // Nur sie ändern (deep equality checks)
    if (deepEqual(myVal, baseVal) && !deepEqual(theirVal, baseVal)) {
      (merged as any)[field] = theirVal;
      continue;
    }
    
    // Special Case: updatedAt - IMMER neuesten Timestamp nehmen
    if (field === 'updatedAt') {
      const myDate = new Date(myVal).getTime();
      const theirDate = new Date(theirVal).getTime();

      (merged as any)[field] = myDate > theirDate ? myVal : theirVal;
      continue;
    }

    // BEIDE ändern das Feld (deep equality checks)
    if (!deepEqual(myVal, baseVal) && !deepEqual(theirVal, baseVal)) {
      conflictFields++;

      // Spezial: String-Felder → Versuche Diff-Merge
      if (
        field === 'content' &&
        typeof myVal === 'string' &&
        typeof theirVal === 'string'
      ) {
        const mergedText = mergeTextContent(baseVal as string, myVal, theirVal);

        if (mergedText.hasConflicts) {
          // Text hat unauflösbare Konflikte
          conflicts.push({
            field, // ← field ist jetzt string
            baseVersion: baseVal,
            myVersion: myVal,
            theirVersion: theirVal,
            mergeResult: {
              resolved: false,
              conflicts: mergedText.conflictMarkers
            }
          });
        } else {
          // Text erfolgreich gemergt
          (merged as any)[field] = mergedText.result;
          conflictFields--; // Nicht mehr als Konflikt zählen
        }
      } else {
        // Einfache Felder: Können nicht auto-merged werden
        conflicts.push({
          field, // ← field ist jetzt string
          baseVersion: baseVal,
          myVersion: myVal,
          theirVersion: theirVal
        });
      }
    }
  }

  const conflictPercentage =
    changedFields > 0 ? Math.round((conflictFields / changedFields) * 100) : 0;

  return {
    status:
      conflicts.length === 0
        ? 'AUTO_MERGED'
        : conflictPercentage < 30
          ? 'AUTO_MERGED' // Unter 30% Konflikte: akzeptabel
          : 'MANUAL_MERGE_REQUIRED',
    merged: conflicts.length === 0 ? merged : null,
    conflicts,
    conflictPercentage
  };
}

/**
 * Text-spezifisches 3-way Merge
 * Vereinfachte Version (echte Implementierung würde diff-match-patch o.ä. nutzen)
 */
function mergeTextContent(
  base: string,
  my: string,
  their: string
): { result: string; hasConflicts: boolean; conflictMarkers: string[] } {
  const lines = {
    base: base.split('\n'),
    my: my.split('\n'),
    their: their.split('\n')
  };

  const merged: string[] = [];
  const conflictMarkers: string[] = [];
  const maxLen = Math.max(lines.base.length, lines.my.length, lines.their.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = lines.base[i] ?? '';
    const myLine = lines.my[i] ?? '';
    const theirLine = lines.their[i] ?? '';

    // Alle gleich
    if (baseLine === myLine && myLine === theirLine) {
      merged.push(baseLine);
      continue;
    }

    // Nur ich ändere
    if (myLine !== baseLine && theirLine === baseLine) {
      merged.push(myLine);
      continue;
    }

    // Nur sie ändern
    if (myLine === baseLine && theirLine !== baseLine) {
      merged.push(theirLine);
      continue;
    }

    // BEIDE ändern
    if (myLine !== baseLine && theirLine !== baseLine) {
      // Falls beide zum gleichen ändern → kein Konflikt
      if (myLine === theirLine) {
        merged.push(myLine);
        continue;
      }

      // Echter Konflikt!
      conflictMarkers.push(`Line ${i + 1}: "${baseLine}" → "${myLine}" vs "${theirLine}"`);
      merged.push(`<<<<<<< MY\n${myLine}\n=======\n${theirLine}\n>>>>>>>`);
    }
  }

  return {
    result: merged.join('\n'),
    hasConflicts: conflictMarkers.length > 0,
    conflictMarkers
  };
}

/**
 * Resolution: User wählt manuell welche Version für jeden Konflikt
 * CRITICAL: customValues ist separates Feld, nicht im Index-Type
 */
export interface MergeResolution {
  [fieldName: string]: 'mine' | 'theirs' | 'merged' | 'custom';
}

/**
 * Mit Custom-Values für 'custom' Choice
 */
export interface MergeResolutionWithCustom {
  resolution: MergeResolution;
  customValues?: Record<string, any>;
}

/**
 * Apply Resolution: Erstelle finale gemergde Version
 */
export function applyMergeResolution(
  base: CardContent,
  my: CardContent,
  their: CardContent,
  conflicts: ConflictingField[],
  resolution: MergeResolutionWithCustom
): CardContent {
  const final = { ...my }; // Starte mit meiner Version
  const customValues = resolution.customValues || {};
  const resolutionMap = resolution.resolution;

  for (const conflict of conflicts) {
    const fieldName = conflict.field as string;
    const choice = resolutionMap[fieldName];

    if (choice === 'mine') {
      (final as any)[fieldName] = (my as any)[fieldName];
    } else if (choice === 'theirs') {
      (final as any)[fieldName] = (their as any)[fieldName];
    } else if (choice === 'merged' && conflict.mergeResult?.result) {
      (final as any)[fieldName] = conflict.mergeResult.result;
    } else if (choice === 'custom' && fieldName in customValues) {
      (final as any)[fieldName] = customValues[fieldName];
    }
  }

  // Update timestamp
  final.updatedAt = new Date().toISOString();

  return final;
}

/**
 * Soft Lock: Ephemeral "Now Editing" Event
 * Wird in SyncManager veröffentlicht und expiret nach X Sekunden
 */
export interface SoftLockEvent {
  kind: 20001; // Ephemeral Event
  tags: [
    ['a', string], // Reference to 30302 card
    ['d', string], // "editing-{cardId}"
    ['expires', string] // Unix timestamp
  ];
  content: {
    user: string; // Display name
    clientId: string;
    startedAt: string; // ISO timestamp
  };
}

/**
 * Create Soft Lock Event für UI-Warnings
 */
export function createSoftLockEvent(
  cardId: string,
  userName: string,
  clientId: string,
  ttlSeconds: number = 300 // 5 Min default
): SoftLockEvent {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  return {
    kind: 20001,
    tags: [
      ['a', `30302:unknown:${cardId}`], // Placeholder für author
      ['d', `editing-${cardId}`],
      ['expires', expiresAt.toString()]
    ],
    content: {
      user: userName,
      clientId,
      startedAt: new Date().toISOString()
    }
  };
}

/**
 * Parse Soft Lock Event (für Warnings anzeigen)
 */
export function parseSoftLockEvent(event: NDKEvent): {
  user: string;
  startedAt: Date;
  isExpired: boolean;
} | null {
  if (event.kind !== 20001) return null;

  const content = JSON.parse(event.content);
  const expiresTag = event.tags.find(t => t[0] === 'expires');
  const expiresAt = expiresTag ? parseInt(expiresTag[1]) : 0;
  const now = Math.floor(Date.now() / 1000);

  return {
    user: content.user,
    startedAt: new Date(content.startedAt),
    isExpired: now > expiresAt
  };
}
