# 🔗 Kurzlink-Feature (URL Shortener via Nostr)

**Version:** 1.0  
**Status:** ✅ COMPLETE (17 Unit-Tests)  
**Datum:** 21. Februar 2026  
**Branch:** `feature/urlshortener`

---

## 📋 Übersicht & Motivation

### Das Problem

Die vollständigen Board-URLs enthalten einen langen `naddr`-String (Nostr Addressable Identifier), z.B.:

```
https://kanban.edufeed.org/cardsboard/naddr1qqpkucttqy28wumn8ghj7un9d3shjtn...
```

Solche URLs sind:
- ❌ Schwer mündlich zu kommunizieren
- ❌ Nicht merkbar
- ❌ QR-Codes werden unnötig groß und schwer scanbar
- ❌ Ungeeignet für Social-Media-Posts

### Die Lösung

Dezentrale Kurzlinks über **Nostr Addressable Events (Kind 30491)** nach NIP-33.
Ein kurzer Slug wird auf den vollen `naddr`-String gemappt und auf Nostr-Relays publiziert.

```
Vorher: https://kanban.edufeed.org/cardsboard/naddr1qqpkucttqy28wumn8ghj7...
Nachher: https://kanban.edufeed.org/b/mein-projekt
```

**Vorteile:**
- 🚀 Kurze, merkbare URLs
- 🌐 Dezentral — kein URL-Shortener-Service nötig
- 🔁 Deterministisch — Slug wird aus Board-Name generiert
- ✏️ Editierbar — Nutzer kann Slug vor Publizierung anpassen
- 📱 Kompakte QR-Codes

---

## 🚀 Quick Start (Benutzer-Anleitung)

### Kurzlink erstellen

1. Board öffnen → **Share-Button** (Toolbar oben rechts) klicken
2. Im Dialog ist der **Kurzlink-Tab** bereits aktiv
3. Ein Slug wird automatisch aus dem Board-Namen generiert (z.B. `mein-projekt`)
4. Optional: Slug im Eingabefeld bearbeiten
5. Auf **Kopieren**, **Öffnen** oder **QR-Code** klicken
   - Der Kurzlink wird beim ersten Klick automatisch auf Nostr publiziert
   - Danach wird die gewählte Aktion ausgeführt
6. Grüne ✓-Markierung zeigt: Slug ist publiziert

### Kurzlink verwenden

Jeder mit dem Link (z.B. `https://kanban.edufeed.org/b/mein-projekt`) wird automatisch zum Board weitergeleitet.

---

## 🔧 Technische Architektur

### Nostr Event-Struktur (Kind 30491)

| Feld | Wert | Beschreibung |
|------|------|--------------|
| `kind` | `30491` | Addressable Event (NIP-33) |
| `d`-Tag | Slug | z.B. `"mein-projekt"` — macht Event per Slug adressierbar |
| `r`-Tag | naddr-String | Maschinenlesbarer Board-Link |
| `a`-Tag | `30301:<pubkey>:<boardId>` | Querverweis zum Board-Event |
| `title`-Tag | Board-Titel | Für Discovery/Suche |
| `content` | naddr-String | Human-Readable Fallback |

**Beispiel-Event:**
```json
{
  "kind": 30491,
  "tags": [
    ["d", "mein-projekt"],
    ["r", "naddr1qqpkucttqy28wumn8ghj7..."],
    ["a", "30301:abc123:board-d-tag"],
    ["title", "Mein Projekt"]
  ],
  "content": "naddr1qqpkucttqy28wumn8ghj7..."
}
```

### Datenfluss

```
ShareDialog (UI)
  │
  ├─ slugifyBoardName() → Auto-Slug aus Board-Name
  │
  ├─ [User bearbeitet Slug optional]
  │
  └─ ensurePublished() → Beim Klick auf Copy/Open/QR
       │
       ├─ boardStore.publishShortlink(slug)
       │     ├─ nip19.naddrEncode() → naddr generieren
       │     ├─ createShortlinkEvent() → Kind 30491 Event
       │     └─ event.publish() → Auf öffentliche Relays
       │
       └─ Aktion ausführen (Copy/Open/QR)
```

### Resolver-Route (`/b/[slug]`)

```
Browser: /b/mein-projekt
  │
  ├─ +page.ts → slug aus URL extrahieren, prerender=false
  │
  └─ +page.svelte (onMount)
       ├─ NDK-Bereitschaft abwarten (max. 5s)
       ├─ resolveShortlinkBySlug(slug, ndk)
       │     ├─ Kind 30491, #d=[slug] auf Nostr suchen
       │     └─ Last-Write-Wins bei mehreren Ergebnissen
       └─ goto('/cardsboard/<naddr>', { replaceState: true })
```

**Status-States der Resolver-Seite:**
- `loading` — Slug wird auf Nostr gesucht (mit Fortschrittsanzeige)
- `not-found` — Kein Event mit diesem Slug gefunden
- `error` — NDK nicht bereit oder anderer Fehler

---

## 📁 Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/utils/nostrEvents.ts` | 5 neue Funktionen + `EVENT_KINDS.SHORTLINK = 30491` |
| `src/lib/stores/kanbanStore.svelte.ts` | `publishShortlink(slug)` Methode |
| `src/lib/components/board/ShareDialog.svelte` | Kurzlink-Tab mit Auto-Publish UX |
| `src/routes/b/[slug]/+page.ts` | SvelteKit Load-Funktion |
| `src/routes/b/[slug]/+page.svelte` | Resolver-Seite (Loading/Error/NotFound) |
| `src/lib/utils/nostrEvents.spec.ts` | 17 neue Unit-Tests |

---

## 📚 API-Referenz

### `slugifyBoardName(boardName: string): string`

Generiert einen URL-freundlichen Slug aus einem Board-Namen.

- Umlaute → ASCII (ä→ae, ö→oe, ü→ue, ß→ss) — **vor** NFD-Normalisierung
- Diakritische Zeichen entfernen
- Nicht-alphanumerische Zeichen → Bindestrich
- Max. 48 Zeichen

```typescript
slugifyBoardName('Mein Tolles Board')    // → "mein-tolles-board"
slugifyBoardName('Übung für Schüler')    // → "uebung-fuer-schueler"
slugifyBoardName('Café & Résumé')        // → "cafe-resume"
```

### `createShortlinkEvent(slug, naddr, boardId, authorPubkey, boardTitle?, ndk): NDKEvent`

Erstellt ein unsigniertes Kind 30491 Event.

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `slug` | `string` | Das Kürzel (wird zum d-Tag) |
| `naddr` | `string` | Vollständiger naddr-String |
| `boardId` | `string` | Board d-Tag |
| `authorPubkey` | `string` | Hex-Pubkey des Board-Autors |
| `boardTitle` | `string \| undefined` | Optionaler Board-Titel |
| `ndk` | `NDK` | NDK-Instanz |

### `resolveShortlink(slug, authorPubkey, ndk): Promise<string | null>`

Löst einen Slug auf, wenn der Author bekannt ist (schneller, gezielter Filter).

### `resolveShortlinkBySlug(slug, ndk): Promise<{ naddr, authorPubkey } | null>`

Löst einen Slug auf **ohne** Author-Kenntnis. Sucht über alle Autoren, nimmt das neueste Event (Last-Write-Wins).

### `boardStore.publishShortlink(slug): Promise<boolean>`

Publiziert ein Shortlink-Event für das aktuelle Board.
- Generiert naddr via `nip19.naddrEncode()`
- Publiziert auf öffentliche Relays
- Gibt `true` bei Erfolg zurück

---

## 🧪 Testing

### Unit-Tests (17 Tests in `nostrEvents.spec.ts`)

```
✅ slugifyBoardName
  - Lowercase + Bindestriche
  - Umlaute (ä→ae, ö→oe, ü→ue, ß→ss)
  - Diakritische Zeichen (Café → cafe)
  - Max. 48 Zeichen
  - Leerer String
  - Sonderzeichen

✅ createShortlinkEvent
  - Kind 30491, d/r/a-Tags
  - Without title → kein title-Tag
  - Content = naddr

✅ resolveShortlink
  - Erfolgreiche Auflösung (r-Tag)
  - Fallback auf Content
  - Nicht gefunden → null

✅ resolveShortlinkBySlug
  - Erfolgreiche Auflösung ohne Author
  - Nicht gefunden → null
  - Last-Write-Wins bei Duplikaten
```

---

## ⚠️ Fehlerbehebung

### Kurzlink wird nicht gefunden

**Mögliche Ursachen:**
- Board-Autor ist nicht angemeldet (Shortlink braucht signiertes Event)
- Relays sind nicht erreichbar
- Slug wurde noch nicht publiziert (grüne ✓-Markierung fehlt)

### QR-Code wird nicht generiert

- QR-Button klicken → Shortlink wird automatisch publiziert → QR wird erzeugt
- Wenn Slug geändert wird, muss QR erneut generiert werden

### Slug-Kollision

Addressable Events (NIP-33) sind pro Author + d-Tag unique. Verschiedene Autoren können denselben Slug haben. `resolveShortlinkBySlug` nimmt das neueste Event (Last-Write-Wins).

---

## 🔗 Referenzen

- [Nostr NIP-33: Addressable Events](https://github.com/nostr-protocol/nips/blob/master/33.md)
- [NIP-19: naddr Encoding](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [Share-Link Feature (Token-basiert)](./SHARELINK.md) — Verwandtes Feature für Board-Sharing via komprimiertem Token
- [Kanban-NIP Event Schema](../../Kanban-NIP.md) — Kind 30301/30302 Board/Card Events
