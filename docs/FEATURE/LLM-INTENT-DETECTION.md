# LLM-basierte Intent Detection

**Version:** 1.0  
**Datum:** 06. November 2025  
**Status:** ✅ IMPLEMENTIERT  
**Feature:** Kontext-bewusste Intent-Erkennung via LLM (Alternative zu regelbasiertem Pattern-Matching)

---

## I. Übersicht

### Was ist das Feature?

Das System kann **via LLM** die Benutzer-Intention erkennen, basierend auf:
1. Den **letzten AI-Antworten** (Kontext)
2. Der **aktuellen User-Nachricht**

Dies ist eine **Alternative** zur regelbasierten Intent-Detection (`detectUserIntent()`), die robuster und flexibler ist.

### Warum wurde es implementiert?

**Problem mit regelbasierter Detection:**
- ❌ Muss ständig erweitert werden (neue Patterns)
- ❌ Fragil bei Variationen: "erstelle das board jetzt" vs "erstelle jetzt das board"
- ❌ Kein Kontext-Verständnis
- ❌ Kann keine Nuancen erkennen

**Lösung mit LLM-basierter Detection:**
- ✅ Versteht **Kontext** aus vorherigen Nachrichten
- ✅ Erkennt **alle Variationen** automatisch
- ✅ Gibt **Konfidenz** und **Begründung** zurück
- ✅ Fallback auf regelbasierte Detection bei Fehler

### Wann wird es verwendet?

- **Optional:** Kann anstelle von `detectUserIntent()` verwendet werden
- **Empfohlen:** Bei komplexen Konversationen mit mehreren Nachrichten
- **Fallback:** Bei API-Fehler wird regelbasierte Detection verwendet

---

## II. Quick Start

### Als Entwickler: Basis-Nutzung

```typescript
import { llmDetectIntention, detectIntentViaLLM } from '$lib/agent';

// Variante 1: Mit Kontext (empfohlen)
const result = await llmDetectIntention(
  [
    'AI: Ich kann ein Board zur Reformation erstellen...',
    'AI: Das Board hätte Spalten Todo, In Progress, Done'
  ],
  'ja bitte'  // User-Nachricht
);

console.log(result);
// → {
//     intent: 'confirmation',
//     confidence: 0.95,
//     reason: 'User confirms previous AI proposal'
//   }

// Variante 2: Ohne Kontext (einfach)
const intent = await detectIntentViaLLM('Erstelle ein Board zu Klimawandel');
// → 'explicit'

// Variante 3: Mit einer vorherigen AI-Antwort
const intent2 = await detectIntentViaLLM(
  'ja',
  'Soll ich ein Board erstellen?'
);
// → 'confirmation'
```

### Als User: Keine Änderung nötig

Die Intent-Detection funktioniert **transparent** im Hintergrund. User müssen nichts ändern.

---

## III. Technische Details

### 3.1 Architektur

```
User Message → llmDetectIntention() → llmRequest()
                     ↓
               LLM API Call
                     ↓
        { intent, confidence, reason }
                     ↓
         Validation & Fallback
                     ↓
              Return Result
```

### 3.2 System Prompt

Das LLM erhält folgende Instruktionen:

```
Du bist ein Experte für Intent-Erkennung in Kanban-Board-Erstellungs-Anfragen.

Intent-Typen:

1. explicit - User fordert EXPLIZIT neue Board-Erstellung an
   - "Erstelle ein Board zu Reformation"
   
2. confirmation - User bestätigt vorherigen Vorschlag ODER fordert Umsetzung an
   - "ja", "ja bitte", "mach das"
   - "erstelle daraus das Board", "erstelle nun das Board"
   - "erstelle Karten für die Spalten"
   
3. vague - User nennt nur Thema OHNE explizite Aufforderung
   - "Reformation 7. Klasse"
```

### 3.3 llmRequest() - Globale LLM-Funktion

**Datei:** `src/lib/agent/llmRequest.ts`

```typescript
export async function llmRequest<T>(
  options: LLMRequestOptions
): Promise<T | string> {
  const {
    systemPrompt,
    userMessage,
    returnType = 'text',  // 'json' | 'text'
    temperature = 0.1,
    maxTokens = 500
  } = options;
  
  // Holt API-Config aus SettingsStore
  const config = getApiConfig();
  
  // Macht API-Call
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature,
      max_tokens: maxTokens,
      ...(returnType === 'json' && {
        response_format: { type: 'json_object' }
      })
    })
  });
  
  // Parsed JSON oder gibt Text zurück
  return returnType === 'json' 
    ? JSON.parse(content) 
    : content;
}
```

**Wichtige Features:**
- ✅ **NICHT** Teil der Chat-History (separate Anfrage)
- ✅ JSON oder Text Return-Type
- ✅ Niedrige Temperature für konsistente Ergebnisse
- ✅ Holt API-Config automatisch aus Settings

### 3.4 Fallback-Mechanismus

Bei Fehler (API down, ungültige Response, etc.) wird automatisch auf regelbasierte Detection zurückgefallen:

```typescript
try {
  const result = await llmDetectIntention(...);
  return result;
} catch (err) {
  // Fallback: Rule-based
  const fallbackIntent = detectUserIntent(userMessage);
  return {
    intent: fallbackIntent,
    confidence: 0.6,
    reason: `LLM failed, using rule-based fallback`
  };
}
```

### 3.5 Validation

Das LLM-Result wird validiert:

```typescript
// 1. Type Guard (string vs JSON)
if (typeof result === 'string') {
  throw new Error('LLM returned text instead of JSON');
}

// 2. Intent-Validierung
if (!['explicit', 'confirmation', 'vague'].includes(result.intent)) {
  return { intent: 'vague', confidence: 0.5, reason: 'Invalid' };
}

// 3. Confidence-Range
if (result.confidence < 0 || result.confidence > 1) {
  result.confidence = 0.8; // Default
}
```

---

## IV. Integration in AIPanel

### 4.1 Aktueller Flow (regelbasiert)

```svelte
<!-- src/routes/cardsboard/AIPanel.svelte -->

async function handleUserMessage(message: string) {
  const intent = detectUserIntent(message);  // Regelbasiert
  console.log('🎯 Detected Intent:', intent);
  
  // ... Rest
}
```

### 4.2 Mit LLM-basierter Detection

```svelte
<script lang="ts">
  import { detectIntentViaLLM, detectUserIntent } from '$lib/agent';
  
  // Toggle zwischen LLM und Rule-based
  let useLLMIntent = $state(false);  // Default: regelbasiert
  
  async function handleUserMessage(message: string) {
    let intent: UserIntent;
    
    if (useLLMIntent) {
      // LLM-basiert (mit letzter AI-Antwort als Kontext)
      const lastAIMessage = chatStore.messages
        .filter(m => m.sender === 'assistant')
        .slice(-1)[0]?.text;
      
      try {
        intent = await detectIntentViaLLM(message, lastAIMessage);
        console.log('🤖 LLM Intent:', intent);
      } catch (err) {
        console.warn('⚠️ LLM Intent failed, fallback to rules');
        intent = detectUserIntent(message);
      }
    } else {
      // Regelbasiert
      intent = detectUserIntent(message);
      console.log('📋 Rule Intent:', intent);
    }
    
    // ... Rest bleibt gleich
  }
</script>

<!-- UI Toggle -->
<div class="settings">
  <label>
    <input type="checkbox" bind:checked={useLLMIntent} />
    LLM-basierte Intent-Erkennung (Beta)
  </label>
</div>
```

---

## V. Tests

### 5.1 Unit Tests

**Datei:** `src/lib/agent/llmIntentDetection.test.ts`

```typescript
describe('llmDetectIntention', () => {
  it('should detect explicit board creation', async () => {
    const result = await llmDetectIntention(
      [],
      'Erstelle ein Board zur Reformation'
    );
    
    expect(result.intent).toBe('explicit');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  
  it('should detect confirmation with context', async () => {
    const result = await llmDetectIntention(
      ['Ich kann ein Board zur Reformation erstellen'],
      'ja bitte'
    );
    
    expect(result.intent).toBe('confirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
```

**⚠️ WICHTIG:** Tests sind **optional** und erfordern funktionierende LLM-API!

```bash
# Tests nur lokal ausführen (nicht in CI/CD)
pnpm run test:unit -- llmIntentDetection

# Tests werden automatisch übersprungen wenn keine API konfiguriert
```

### 5.2 Manual Testing

**Browser Console:**

```javascript
import { llmDetectIntention } from '$lib/agent';

// Test 1: Explicit
await llmDetectIntention([], 'Erstelle ein Board zu Klimawandel');
// → { intent: 'explicit', confidence: 0.95, ... }

// Test 2: Confirmation
await llmDetectIntention(
  ['Das Board hätte Spalten: Todo, Done'],
  'erstelle das board jetzt'
);
// → { intent: 'confirmation', confidence: 0.9, ... }

// Test 3: Vague
await llmDetectIntention([], 'Reformation 7. Klasse');
// → { intent: 'vague', confidence: 0.85, ... }
```

---

## VI. Vorteile & Limitierungen

### ✅ Vorteile

| Feature | Regelbasiert | LLM-basiert |
|---------|--------------|-------------|
| **Flexibilität** | ❌ Fest codiert | ✅ Versteht Variationen |
| **Kontext** | ❌ Keine Context-Awareness | ✅ Nutzt vorherige Nachrichten |
| **Wartung** | ❌ Muss ständig erweitert werden | ✅ Automatisch robust |
| **Begründung** | ❌ Keine Erklärung | ✅ Gibt Reason zurück |
| **Konfidenz** | ❌ Keine Confidence | ✅ 0.0 - 1.0 Score |

### ⚠️ Limitierungen

| Aspekt | Impact | Mitigation |
|--------|--------|------------|
| **Latenz** | +200-500ms pro Request | Nutze niedrige `maxTokens` (150) |
| **Kosten** | ~$0.0001 pro Request | Minimale Kosten bei low token count |
| **API Dependency** | Benötigt funktionierende API | Fallback auf regelbasierte Detection |
| **Determinismus** | LLM kann varieren | Low temperature (0.1) für Konsistenz |

### 🎯 Empfehlung

**Wann LLM-basiert nutzen:**
- ✅ Komplexe Konversationen mit viel Kontext
- ✅ User nutzt ungewöhnliche Formulierungen
- ✅ Production mit stabiler API

**Wann regelbasiert nutzen:**
- ✅ Offline-Betrieb erforderlich
- ✅ Latenz-kritische Anwendungen
- ✅ Kosten-Optimierung wichtig

---

## VII. Beispiel-Szenarien

### Szenario 1: "erstelle das board jetzt" (neue Variante)

**Regelbasiert:** ❌ Nicht erkannt (Pattern fehlt)  
**LLM-basiert:** ✅ Erkannt als `confirmation`

```typescript
// LLM versteht Kontext:
await llmDetectIntention(
  ['Hier ist ein Vorschlag: Board mit 3 Spalten'],
  'erstelle das board jetzt'
);
// → { intent: 'confirmation', confidence: 0.92, reason: 'User requests immediate execution of previous proposal' }
```

### Szenario 2: Mehrdeutige Formulierung

**User:** "mach das mal"

**Regelbasiert:** `confirmation` (Pattern match)  
**LLM-basiert:** 
- MIT Kontext: `confirmation` (weil AI vorher Vorschlag gemacht hat)
- OHNE Kontext: `vague` (zu unspezifisch)

```typescript
// MIT Kontext
await llmDetectIntention(
  ['Soll ich ein Board zu Reformation erstellen?'],
  'mach das mal'
);
// → { intent: 'confirmation', confidence: 0.88 }

// OHNE Kontext
await llmDetectIntention([], 'mach das mal');
// → { intent: 'vague', confidence: 0.75 }
```

---

## VIII. Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.0 | 06.11.2025 | Initial: LLM-basierte Intent Detection implementiert, `llmRequest()` global function, Fallback-Mechanismus |

---

**Status:** ✅ PRODUKTIV (OPTIONAL)  
**Maintainer:** Agent-Modul Team  
**Letzte Aktualisierung:** 06. November 2025
