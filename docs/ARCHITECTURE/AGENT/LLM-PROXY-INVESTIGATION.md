# LLM Proxy Investigation: Academic Cloud / ZhipuAI GLM

**Datum:** 21. Februar 2026  
**Status:** ✅ RESOLVED  
**Proxy:** `https://kanban.edufeed.org/llm/api/v1/chat/completions`  
**Modell:** `glm-4` / `glm-4.7` (ZhipuAI/GLM via Academic Cloud Proxy)

---

## Zusammenfassung

Die KI-Chat-Funktion lieferte sporadisch `400 Bad Request` mit Pydantic-Validierungsfehlern:

```
Invalid JSON: EOF while parsing a string at line 1 column 13013
```

Nach systematischer Analyse wurde die **Root Cause** identifiziert und behoben:

| Faktor | Einfluss | Beweis |
|--------|----------|--------|
| **`tool_choice: 'required'`** | 🔴 **Hauptursache** | 0/5 OK mit required, 5/5 OK mit auto (16 Tools + History) |
| Umlaute in Tool-Definitionen | 🟠 Beitragend | Deterministisch: gleicher Payload, mit Umlauten ❌, ohne ✅ |
| Umlaute in User-Messages | 🟢 Kein Problem | 200× `ä` in User-Nachricht → 200 OK mit `auto` |
| Payload-Größe | 🟢 Kein Limit | 68 KB+ Payloads funktionieren problemlos |
| UTF-8 BOM im Body | 🔴 **Aktiv schädlich** | 0/3 OK — `SyntaxError: Unexpected token 'ï'` (JSON-Parser bricht ab) |
| `charset=utf-8` Header | 🟢 Kein Einfluss | 3/3 OK — identisch zur Baseline |

---

## Chronologie der Untersuchung

### Phase 1: Initiale Analyse

**Symptom:** `400 Bad Request` mit `EOF while parsing a string at line 1 column 13013`

**Erste Hypothese:** Payload zu groß → **WIDERLEGT**  
Systematische Tests (1 KB bis 32 KB, dann 68 KB mit 15 dummy Tools) zeigten: Der Proxy hat **kein Body-Size-Limit**.

### Phase 2: Umlaut-Hypothese

Kontrollierter Test (`probe2.mjs`, Test B):
- Zwei Requests mit **identischer Byte-Länge** (419 Bytes)
- **Einziger Unterschied:** System-Prompt mit vs. ohne Umlaute (ä/ö/ü)
- **Ergebnis:** Mit Umlauten → ❌ 400 (deterministisch), ohne Umlaute → ✅ 200 (deterministisch)

**Schlussfolgerung:** UTF-8 Multi-Byte-Zeichen (ä=2 Bytes, ö=2 Bytes, ü=2 Bytes, ß=2 Bytes) verursachen eine Byte-Position-Verschiebung im JSON-Parser des Proxys.

### Phase 3: Bereinigung der Tool-Definitionen

87 Umlaut-Vorkommen in `toolDefinitions.ts` und `toolSystemPrompt.ts` wurden durch ASCII-Äquivalente ersetzt:

| Original | Ersetzt durch |
|----------|---------------|
| ä | ae |
| ö | oe |
| ü | ue |
| Ä | Ae |
| Ö | Oe |
| Ü | Ue |
| ß | ss |

**Ergebnis:** Sporadische Fehler reduziert, aber nicht eliminiert.

### Phase 4: Entscheidende Erkenntnis — `tool_choice`

Test mit den **echten 16 Tools + deutscher Chat-History** (probe-umlauts2.mjs, probe-verify.mjs):

```
=== tool_choice: auto (5x) ===
History+User MIT Umlauten: OK OK OK OK OK  → 5/5 ✅

=== tool_choice: required (5x) ===
History+User MIT Umlauten: FAIL FAIL FAIL FAIL FAIL  → 0/5 ❌
History+User OHNE Umlaute: FAIL FAIL FAIL FAIL FAIL  → 0/5 ❌
```

**Befund:** `tool_choice: 'required'` versagt bei 16 Tools + History **unabhängig** von Umlauten in den Messages. `tool_choice: 'auto'` funktioniert **immer** — sogar mit 200 Umlauten im User-Text.

### Phase 5: UTF-8 BOM Test

Zusätzlich getestet: Ob ein UTF-8 BOM-Prefix (`\xEF\xBB\xBF`) im JSON-Body oder ein expliziter `charset=utf-8` im Content-Type-Header dem Proxy helfen könnte, Multi-Byte-Zeichen korrekt zu verarbeiten.

**Ergebnis (je 3× getestet):**

| Variante | Ergebnis | Detail |
|----------|----------|--------|
| Normal (Baseline, mit Umlauten) | 3/3 ✅ | Umlaute in Messages kein Problem mit `auto` |
| `charset=utf-8` Header | 3/3 ✅ | Kein Unterschied zur Baseline |
| **UTF-8 BOM Prefix im Body** | **0/3 ❌** | `SyntaxError: Unexpected token 'ï'` — BOM bricht JSON-Parser |
| BOM + charset kombiniert | 0/3 ❌ | Gleicher Fehler — BOM ist aktiv schädlich |
| Ohne Umlaute (Kontrollgruppe) | 3/3 ✅ | Wie erwartet |

**Schlussfolgerung:** UTF-8 BOM darf bei JSON **niemals** verwendet werden (bestätigt RFC 8259). Der Proxy-JSON-Parser strippt BOM-Bytes nicht, sondern interpretiert `\xEF` als erstes Zeichen und scheitert. Der `charset=utf-8` Header ist irrelevant — JSON ist per Spezifikation immer UTF-8.

### Phase 6: Lösungsvergleich

| Ansatz | 400-Fehler | Tool-Nutzung | Aufwand |
|--------|------------|--------------|---------|
| `required` (alt) | 80-100% Fehlerrate | Garantiert | — |
| `auto` + System-Prompt-Instruktion | ~0% Fehlerrate | 5/5 tool_calls im Test | Minimal |
| `auto` + synthetischer Fallback | ~0% Fehlerrate | 100% (Fallback bei Text) | Gering |

**Gewählt:** `auto` + synthetischer Fallback

---

## Implementierte Fixes

### 1. `tool_choice: 'required'` → `'auto'` (chatStore.svelte.ts)

```typescript
// VORHER
const buildRequestBody = (msgs) => ({
    ...
    tool_choice: 'required'  // ← 80-100% Fehlerrate bei 16 Tools
});

// NACHHER
const buildRequestBody = (msgs) => ({
    ...
    tool_choice: 'auto'  // ← 0% Fehlerrate, LLM nutzt Tools trotzdem
});
```

Der System-Prompt instruiert das LLM weiterhin, **immer** ein Tool zu verwenden. In Tests ruft das Modell bei 5/5 Requests ein Tool auf.

### 2. Synthetischer `respond`-Fallback (chatStore.svelte.ts)

Falls das LLM bei `auto` ausnahmsweise reinen Text statt eines Tool-Calls zurückgibt, wird die Antwort automatisch in einen synthetischen `respond`-Tool-Call gewrappt:

```typescript
if (content && !toolCalls) {
    return {
        content,
        tool_calls: [{
            id: 'synthetic-respond',
            type: 'function',
            function: {
                name: 'respond',
                arguments: JSON.stringify({ message: content })
            }
        }]
    };
}
```

Der Aufrufer muss keine Sonderbehandlung implementieren.

### 3. Umlaut-Bereinigung in statischen Texten (toolDefinitions.ts, toolSystemPrompt.ts)

Alle statischen Strings in Tool-Definitionen und System-Prompt-Templates wurden von Umlauten befreit. Dies ist eine **Defense-in-Depth**-Maßnahme — der Hauptfix ist `tool_choice: 'auto'`.

**Hinweis:** Umlaute in dynamischen Inhalten (User-Messages, Chat-History, Board-Kartendaten) benötigen **keine** Bereinigung. Sie funktionieren mit `tool_choice: 'auto'` einwandfrei.

### 4. Retry-Logik bei sporadischen Fehlern (chatStore.svelte.ts)

Unabhängig von der Root Cause gibt es gelegentliche Server-Instabilitäten (~10–20%). Die Retry-Logik fängt das ab:

```typescript
if (!response.ok && response.status === 400) {
    // Retry mit reduziertem Kontext (kein History, gekürzter System-Prompt)
    const fallbackMessages = [
        { role: 'system', content: stripCardsSection(activeSystemPrompt) },
        { role: 'user', content: userMessage }
    ];
    response = await fetch(apiUrl, { ... });
}
```

### 5. Budget-aware Request Building (chatStore.svelte.ts)

Schrittweise Reduktion bei großen Payloads:

1. **3 History-Nachrichten** (Standard)
2. **1 History-Nachricht** (wenn > PROXY_LIMIT)
3. **Karten-Details entfernt** (stripCardsSection)
4. **0 History** (letzter Fallback)

`PROXY_LIMIT = 50000` Zeichen (empirisch: kein echtes Limit, aber sinnvolle Obergrenze).

---

## Empirische Test-Ergebnisse

### Proxy-Eigenschaften (ermittelt Februar 2026)

| Eigenschaft | Wert | Ermittlungsmethode |
|-------------|------|-------------------|
| Body-Size-Limit | **Keines** (68 KB+ funktioniert) | Systematische Größentests |
| API-Key erforderlich | Nein | Produktionsbetrieb |
| `tool_choice: 'required'` | ❌ **Instabil** bei >10 Tools | 0/5 OK in kontrollierten Tests |
| `tool_choice: 'auto'` | ✅ **Stabil** | 5/5 OK, konsistent |
| UTF-8 Multi-Byte in Tools | 🟠 Sporadische Fehler | Deterministisch nachgewiesen |
| UTF-8 Multi-Byte in Messages | ✅ Kein Problem mit `auto` | 200× ä → 200 OK |
| UTF-8 BOM im Body | 🔴 **Bricht JSON** | `SyntaxError: Unexpected token 'ï'` — 0/3 OK |
| `charset=utf-8` Header | 🟢 Kein Einfluss | 3/3 OK, identisch zur Baseline |
| Allgemeine Stabilität | ~80–90% | Sporadische Server-Fehler unabhängig vom Payload |
| Max Tools gleichzeitig | 16+ getestet | Kein oberes Limit gefunden |

### Reproduzierbarkeit

Die Ergebnisse wurden mit dedizierten Test-Scripts verifiziert (anschließend gelöscht):
- `probe2.mjs`: Determinismus-Test + Umlaut-Beweis (identische Payloads)
- `probe-umlauts.mjs`: Umlaute in User-Messages isoliert
- `probe-umlauts2.mjs`: 16 Tools + realistische History
- `probe-verify.mjs`: Finaler Vergleich auto vs required (5×5)
- `probe-bom.mjs`: UTF-8 BOM und charset-Header Test

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/stores/chatStore.svelte.ts` | `tool_choice: 'auto'`, synthetischer Fallback, Retry-Logik, Budget-Loop |
| `src/lib/agent/tools/toolDefinitions.ts` | 87 Umlaute → ASCII |
| `src/lib/agent/tools/toolSystemPrompt.ts` | Umlaute → ASCII, System-Prompt gekürzt |

---

## Lessons Learned

1. **`tool_choice: 'required'` ist bei ZhipuAI/GLM Proxies nicht zuverlässig.** Bei vielen Tools (>10) scheitert es systematisch, nicht sporadisch.

2. **`tool_choice: 'auto'` + klare System-Prompt-Instruktionen** erreichen das gleiche Ergebnis (LLM nutzt Tools), ohne die Instabilität.

3. **UTF-8 Multi-Byte-Zeichen** können bei bestimmten Proxy-Implementierungen Probleme verursachen. Statische Texte (Tool-Beschreibungen) sollten vorsorglich ASCII-safe gehalten werden.

4. **UTF-8 BOM ist aktiv schädlich.** Der Proxy-JSON-Parser interpretiert BOM-Bytes (`\xEF\xBB\xBF`) als ungültige JSON-Zeichen und bricht ab. `charset=utf-8` im Header ist irrelevant (JSON ist per RFC 8259 immer UTF-8).

5. **Defense-in-Depth** ist sinnvoll: Umlaut-Bereinigung + `auto` + Retry-Logik + Budget-Fallback schafft Resilienz gegen verschiedene Fehlerquellen.

6. **Empirische Tests > Hypothesen:** Ohne die kontrollierten Test-Scripts wäre die Root Cause (`tool_choice`, nicht Umlaute) nie gefunden worden.
