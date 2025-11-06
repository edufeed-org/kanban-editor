# LLM JSON Parse Error - Diagnose & Lösung

**Problem:** 
```
❌ LLM Intent Detection failed: SyntaxError: JSON.parse: unexpected character at line 1 column 1
```

**Status:** 🔴 **AKTIVES PROBLEM** (06.11.2025)

---

## 🔍 Problem-Analyse

### Symptome

```typescript
AIPanel.svelte:559:13 - 🤖 Using LLM-based intent detection...
AIPanel.svelte:568:17 - ❌ LLM Intent Detection failed: JSON.parse: unexpected character
llmIntentDetection.ts:110:11 - JSON.parse error
AIPanel.svelte:576:17 - 🎯 LLM Intent: confirmation | Confidence: 0.6 | Reason: LLM failed, using rule-based fallback
```

### Root Cause

Der LLM gibt **Text statt JSON** zurück, obwohl `response_format: { type: 'json_object' }` gesetzt ist.

**Warum passiert das?**

1. **Lokale LLMs (Ollama):** Unterstützen `response_format` oft NICHT
2. **Alte OpenAI Models:** Nur neuere Models (`gpt-4-turbo`, `gpt-4o`) unterstützen JSON mode
3. **Andere Providers:** OpenRouter, Anthropic, etc. haben verschiedene JSON-Unterstützung

---

## 📍 Wo tritt der Fehler auf?

### Call Stack

```
1. AIPanel.svelte (Line 559-576)
   → simulateAIResponse()
   → llmDetectIntention(aiMessages, userMessage)

2. llmIntentDetection.ts (Line 90-110)
   → llmRequest<IntentDetectionResult>({ returnType: 'json', ... })
   → JSON.parse(content)

3. llmRequest.ts (Line 107-110)
   → if (returnType === 'json') {
   →   return JSON.parse(content) as T;  ← FEHLER HIER!
   → }
```

### Code-Stellen

**llmRequest.ts:107-110**
```typescript
if (returnType === 'json') {
  try {
    return JSON.parse(content) as T;  // ← Wirft Fehler wenn content kein JSON!
  } catch (err) {
    console.error('❌ JSON Parse Error:', content);
    throw new Error(`LLM returned invalid JSON: ${content.substring(0, 100)}`);
  }
}
```

**llmIntentDetection.ts:85-94**
```typescript
const result = await llmRequest<IntentDetectionResult>({
  systemPrompt,
  userMessage: userPrompt,
  returnType: 'json',  // ← Fordert JSON an
  temperature: 0.1,
  maxTokens: 150
});

// Type Guard
if (typeof result === 'string') {  // ← Wird bei Parse-Error nie erreicht!
  console.warn('⚠️ LLM returned string instead of JSON:', result);
  throw new Error('LLM returned text instead of JSON');
}
```

---

## 💡 Lösungsansätze

### Option A: Fallback auf Text-Parsing (EMPFOHLEN für lokale LLMs)

**Idee:** Wenn JSON.parse fehlschlägt, versuche JSON aus Text zu extrahieren.

**Implementation in `llmRequest.ts`:**

```typescript
if (returnType === 'json') {
  try {
    // Versuch 1: Direktes JSON-Parsing
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn('⚠️ Direct JSON parse failed, trying extraction...', content.substring(0, 100));
    
    // Versuch 2: JSON aus Text extrahieren (falls in Markdown-Block eingebettet)
    const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)\n?```/) // Markdown Code Block
                   || content.match(/\{[\s\S]*\}/);                    // Beliebiges JSON Object
    
    if (jsonMatch) {
      const extractedJson = jsonMatch[1] || jsonMatch[0];
      try {
        return JSON.parse(extractedJson) as T;
      } catch (extractError) {
        console.error('❌ Extracted JSON also invalid:', extractedJson.substring(0, 100));
      }
    }
    
    // Versuch 3: Vollständiger Fehler mit Kontext
    throw new Error(
      `LLM returned invalid JSON.\n` +
      `Original response: ${content.substring(0, 200)}...\n` +
      `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }
}
```

### Option B: System Prompt Optimierung

**Idee:** Expliziter fordern, dass KEIN Markdown-Block genutzt wird.

**Implementation in `llmIntentDetection.ts`:**

```typescript
const systemPrompt = `Du bist ein Intent-Erkennungs-Agent.
Analysiere User-Nachrichten und klassifiziere die Intention.

**Intent-Typen:**
[... existing content ...]

**Wichtig:**
- Wenn AI bereits einen Vorschlag gemacht hat und User bestätigt → "confirmation"
- Wenn User direkt "erstelle das Board/Karten/Spalten" sagt → "confirmation"
- Wenn User "erstelle EIN Board zu X" sagt → "explicit"

**ANTWORTE NUR MIT REINEM JSON - KEIN MARKDOWN, KEINE CODE-BLOCKS!**

Beispiel-Antwort (ohne \`\`\`json):
{"intent": "confirmation", "confidence": 0.9, "reason": "User sagt ja"}

Deine Antwort (nur JSON):`;
```

### Option C: Provider-spezifische Konfiguration

**Idee:** Prüfe welcher LLM-Provider genutzt wird und passe Verhalten an.

**Implementation in `llmRequest.ts`:**

```typescript
const config = getApiConfig();

// Prüfe ob lokales Ollama
const isOllama = config.endpoint.includes('localhost:11434') 
              || config.endpoint.includes('127.0.0.1:11434');

const payload = {
  model: config.model,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ],
  temperature,
  max_tokens: maxTokens,
  // Nur für APIs die JSON Mode unterstützen!
  ...(!isOllama && returnType === 'json' && {
    response_format: { type: 'json_object' }
  })
};
```

### Option D: Graceful Degradation (BESTE LÖSUNG)

**Kombination aus A + B + C:**

1. Provider-Detection (Option C)
2. Optimierter Prompt (Option B)
3. Robustes JSON-Parsing mit Fallbacks (Option A)

---

## 🎯 Empfohlene Lösung

**Schritt-für-Schritt:**

### 1. Update `llmRequest.ts` (Line 107-112)

```typescript
if (returnType === 'json') {
  try {
    return JSON.parse(content) as T;
  } catch (parseError) {
    console.warn('⚠️ JSON parse failed, trying extraction...', {
      content: content.substring(0, 200),
      error: parseError instanceof Error ? parseError.message : 'Unknown'
    });
    
    // Fallback 1: Extrahiere JSON aus Markdown Code Block
    const markdownMatch = content.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (markdownMatch) {
      try {
        const extracted = markdownMatch[1].trim();
        console.log('✓ Extracted JSON from markdown:', extracted.substring(0, 100));
        return JSON.parse(extracted) as T;
      } catch (err) {
        console.error('❌ Markdown extraction failed');
      }
    }
    
    // Fallback 2: Finde erstes JSON-Objekt im Text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = jsonMatch[0];
        console.log('✓ Extracted JSON from text:', extracted.substring(0, 100));
        return JSON.parse(extracted) as T;
      } catch (err) {
        console.error('❌ Text extraction failed');
      }
    }
    
    // Alle Fallbacks gescheitert
    throw new Error(
      `LLM returned invalid JSON. Content: ${content.substring(0, 200)}...`
    );
  }
}
```

### 2. Update `llmIntentDetection.ts` Prompt (Line 17)

```typescript
const systemPrompt = `Du bist ein Intent-Erkennungs-Agent für ein Kanban-Board-System.
Analysiere User-Nachrichten und klassifiziere die Intention.

**Intent-Typen:**

1. **explicit** - User fordert EXPLIZIT eine neue Board-Erstellung an
   - Beispiele: "Erstelle ein Board zu Reformation", "Mache ein Board über Medienkompetenz"
   - Merkmale: Enthält "erstelle EIN board" oder ähnlich

2. **confirmation** - User bestätigt einen vorherigen Vorschlag ODER fordert Umsetzung an
   - Beispiele: 
     * "ja", "ja bitte", "mach das", "los"
     * "erstelle daraus das Board", "erstelle nun das Board"
     * "erstelle Karten für die Spalten", "fülle die Spalten"
   - Merkmale: Bezieht sich auf vorherigen Vorschlag ODER fordert direkte Umsetzung

3. **vague** - User nennt nur ein Thema OHNE explizite Aufforderung
   - Beispiele: "Reformation 7. Klasse", "Medienkompetenz"
   - Merkmale: Kein Verb, keine klare Aufforderung

**Wichtig:**
- Wenn AI bereits einen Vorschlag gemacht hat und User bestätigt → "confirmation"
- Wenn User direkt "erstelle das Board/Karten/Spalten" sagt → "confirmation"
- Wenn User "erstelle EIN Board zu X" sagt → "explicit"

**AUSGABE-FORMAT:**
Antworte NUR mit einem JSON-Objekt. KEIN Markdown, KEINE Code-Blocks (\`\`\`), KEINE Erklärungen!

Direkt so (ohne Formatierung):
{"intent": "explicit", "confidence": 0.95, "reason": "User sagt erstelle ein Board"}

NICHT so:
\`\`\`json
{"intent": "explicit", ...}
\`\`\`

Deine Antwort (nur JSON):`;
```

### 3. Provider-Detection in Settings (Optional)

Füge Info hinzu welche LLMs JSON Mode unterstützen:

**SettingsPanel.svelte - LLM Tab:**

```svelte
<div class="space-y-2">
  <Label for="llmModel">Model Name</Label>
  <Input 
    id="llmModel"
    type="text"
    placeholder="gpt-4-mini, ollama/mistral, ..."
    bind:value={localLlmModel}
    onblur={handleLlmModelChange}
  />
  <p class="text-sm text-muted-foreground">
    API-Name des LLM Models
  </p>
  <p class="text-xs text-orange-600">
    ⚠️ Hinweis: LLM Intent Detection benötigt JSON Mode. 
    Funktioniert mit: gpt-4o, gpt-4-turbo, claude-3-opus. 
    Lokale Ollama-Models → Regelbasiert empfohlen!
  </p>
</div>
```

---

## 🧪 Testing

### Test-Cases

**Test 1: Direktes JSON (funktioniert)**
```json
{"intent": "confirmation", "confidence": 0.9, "reason": "User sagt ja"}
```

**Test 2: Markdown Code Block (muss extrahiert werden)**
```
```json
{"intent": "confirmation", "confidence": 0.9, "reason": "User sagt ja"}
```
```

**Test 3: JSON in Fließtext (muss gefunden werden)**
```
Die Intention ist: {"intent": "confirmation", "confidence": 0.9, "reason": "User sagt ja"}
```

**Test 4: Ungültiges JSON (Fehler erwartet)**
```
intent: confirmation, confidence: 0.9
```

### Test-Ausführung

```typescript
// In Browser Console:

// Test 1: Mit direktem JSON
const result1 = await llmDetectIntention([], 'ja');
console.log('Test 1:', result1);

// Test 2: Mit Markdown (simuliert)
// → Füge temporär Markdown-Wrapper in LLM-Response

// Test 3: Mit regelbasiertem Fallback
settingsStore.setLlmUseLlmIntent(false);
const result3 = detectUserIntent('ja');
console.log('Test 3 (rule-based):', result3);
```

---

## 📊 Status

- ✅ **Problem identifiziert:** LLM gibt Text statt JSON zurück
- ✅ **Root Cause gefunden:** `response_format` nicht unterstützt bei lokalem Ollama
- ✅ **Fallback funktioniert:** Regelbasierte Detection übernimmt bei Fehler
- ⏳ **Fix pending:** JSON-Extraction aus Text (Option A)
- ⏳ **Prompt-Optimierung:** Explizite "Kein Markdown" Anweisung (Option B)

---

## 🔗 Verwandte Dokumente

- [`docs/FEATURE/LLM-INTENT-DETECTION.md`](../FEATURE/LLM-INTENT-DETECTION.md) - Feature-Dokumentation
- [`src/lib/agent/llmIntentDetection.ts`](../../src/lib/agent/llmIntentDetection.ts) - Implementation
- [`src/lib/agent/llmRequest.ts`](../../src/lib/agent/llmRequest.ts) - LLM API Wrapper
- [`src/routes/cardsboard/AIPanel.svelte`](../../src/routes/cardsboard/AIPanel.svelte) - UI Integration

---

**Erstellt:** 06. November 2025  
**Status:** 🔴 Aktives Problem  
**Assignee:** AI Agent  
**Priority:** MEDIUM (Fallback funktioniert, aber Verbesserung wünschenswert)
