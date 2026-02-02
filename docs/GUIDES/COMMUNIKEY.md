# Communikeys

https://njump.me/naddr1qvzqqqrcvgpzp22rfmsktmgpk2rtan7zwu00zuzax5maq5dnsu5g3xxvqr2u3pd7qyghwumn8ghj7mn0wd68ytnhd9hx2tcprdmhxue69uhhg6r9vehhyetnwshxummnw3erztnrdakj7qgcwaehxw309aaxzurvv93zumn0wd68yvfwvdhk6tcpz4mhxue69uhhyetvv9ujuerpd46hxtnfduhsqrnwd9cz6cm0d4kh2mnfddjhjynm9vs

## Übersicht

Definiert einen Standard für die Erstellung, Verwaltung und Veröffentlichung in Communities durch Nutzung vorhandener Schlüsselpaare und Relays.

Dieser Ansatz ermöglicht es einzigartig:

- Jeder existierenden npub, eine Community zu werden (Identität + Verwaltung)
- Jede existierende Veröffentlichung auf eine beliebige Community auszurichten
- Communities haben ihre eigenen ausgewählten Inhaltstypen

## Motivation

Aktuelle Community-Management-Lösungen auf Nostr erfordern oft komplexe Relay-spezifische Implementierungen, ermangeln echter Dezentralisierung und erlauben es nicht, Veröffentlichungen auf mehrere Communities auszurichten.

Dieser Vorschlag zielt darauf ab, Community-Management zu vereinfachen, indem vorhandene Nostr-Primitive (Schlüsselpaare und Relays) genutzt werden, während gleichzeitig minimal neue Event-Typen hinzugefügt werden.

## Community-Erstellungs-Event (kind:10222)

Eine Community wird erstellt, wenn ein Schlüsselpaar ein [[kind-10222]]-Event veröffentlicht. Die Pubkey dieses Schlüsselpaares wird zur eindeutigen Kennung dieser Community. Ein Schlüsselpaar kann nur eine Community repräsentieren.

Der Name, das Bild und die Beschreibung der Community werden aus dem [[kind-0]]-Metadaten-Event des Pubkeys abgeleitet.

```json
{
  "id": "<event-id>",
  "pubkey": "<community-pubkey>",
  "created_at": 1675642635,
  "kind": 10222,
  "tags": [
    // mindestens ein Haupt-Relay für die Community + weitere optionale Backup-Relays
    ["r", "<relay-url>"],

    // ein oder mehrere Blossom-Server
    ["blossom", "<blossom-url>"],

    // ein oder mehrere Ecash-Mints
    ["mint", "<mint-url>", "cashu"],

    // ein oder mehrere Inhaltsabschnitte: ["content", "<name>"]
    ["content", "Chat"],
    ["k", "9"],
    ["a", "<badge-definition>"], // nur npubs mit diesem Badge können Chat-Nachrichten veröffentlichen

    ["content", "Beiträge"],
    ["k", "1"],
    ["k", "11"],
    ["a", "<badge-definition>"], // nur npubs mit diesem Badge können Beiträge veröffentlichen

    ["content", "Artikel"],
    ["k", "30023"],
    ["k", "30040"],
    ["a", "<badge-definition-member>"],
    ["a", "<badge-definition-pro>"],
    ["a", "<badge-definition-team>"], // Nutzer mit einem dieser Badges können Artikel veröffentlichen

    // Optionale Nutzungsbedingungen, verweist auf ein anderes Event
    ["tos", "<event-id-or-address>", "<relay-url>"],

    // Optionaler Ort
    ["location", "<location>"],
    ["g", "<geo-hash>"],

    // Optionale Beschreibung
    ["description", "Ein Beschreibungstext, der die Beschreibung des Profils überschreibt, falls nötig"]
  ],
  "content": "",
  "sig": "<signature>"
}
```

### Tag-Definitionen

| Tag | Beschreibung |
|-----|-------------|
| `r` | URLs der Relays, wo Community-Inhalte veröffentlicht werden sollen. Das erste wird als Haupt-Relay betrachtet. |
| `blossom` | (optional) URLs der Blossom-Server für zusätzliche Community-Funktionen. |
| `mint` | (optional) URL der Community-Mint für Token/Zahlungsfunktionen. |
| `content` | Name des Inhaltstyp-Abschnitts, mit dem der Communikey arbeitet. |
| `k` | Event-Typ, innerhalb eines Inhaltstyp-Abschnitts. |
| `a` | Badge-Anforderung für die Veröffentlichung. Verweist auf ein Badge-Definition-Event, siehe [[NIP-58]]. Mehrere `a`-Tags können pro Inhaltsabschnitt angegeben werden — Nutzer, die eines dieser Badges haben, können veröffentlichen. |
| `retention` | (optional) Aufbewahrungsrichtlinie im Format [kind, value, type], wobei type entweder "time" (Sekunden) oder "count" (Anzahl der Events) ist. |
| `tos` | (optional) Verweis auf die Veröffentlichungsrichtlinie der Community. |
| `location` | (optional) Ort der Community. |
| `g` | (optional) Geo-Hash der Community. |
| `description` | (optional) Beschreibung der Community. |

Der Pubkey des Schlüsselpaares, das dieses Event erstellt, dient als eindeutige Kennung der Community. Das bedeutet:

1. Jedes Schlüsselpaar kann nur eine Community repräsentieren
2. Communities können leicht gefunden werden, indem nach dem neuesten [[kind-10222]]-Event für einen bestimmten Pubkey abgefragt wird
3. Community-Verwalter können ihre Einstellungen aktualisieren, indem sie ein neues [[kind-10222]]-Event veröffentlichen

## Community-Identifikations-Format

Communities können über ein "ncommunity"-Format referenziert werden:

```
ncommunity://<pubkey>?relay=<url-encoded-relay-1>&relay=<url-encoded-relay-2>
```

Dieses Format folgt den gleichen Prinzipien wie nprofile, ist aber speziell für Community-Identifikation. Während das ncommunity-Format für vollständige Relay-Informationen empfohlen wird, kann das Standard-Pubkey-Format auch verwendet werden, wenn Relay-Erkennung nicht erforderlich ist.

## Auflistung der Communities eines Nutzers

Für die UI gilt: **Ein Nutzer darf ausschließlich in Communities teilen, in denen er selbst Mitglied ist.** Zusätzliche Communities zu „entdecken“ ist nicht erforderlich und würde falsche Treffer erzeugen.

Die zuverlässige Quelle für Mitgliedschaft ist das **Profil‑Badges‑Event [[kind-30008]]**. Es listet alle Badges, die der Nutzer besitzt. Aus den Badge‑Adressen lässt sich die Community‑Pubkey ableiten.

### Community‑Badges (Single Source of Truth)

Clients lesen das Profil‑Badges‑Event [[kind-30008]] und extrahieren daraus die Community‑Pubkeys:

1. **Badge‑Adressen (`a`‑Tags)** haben das Format `30009:<community-pubkey>:<badge-name>`.
2. Der **Author‑Teil** ist die Community‑Pubkey.
3. Für jede Community‑Pubkey wird anschließend das [[kind-10222]]‑Event geladen, um Name, Relays und Beschreibung anzuzeigen.

### Code‑Beispiele (Realisierung)

```ts
// 1) Eigene Communities aus Kind-30008 extrahieren
async function getMyCommunityPubkeys(ndk: NDK, userPubkey: string): Promise<string[]> {
  const badgesEvent = await ndk.fetchEvent({
    kinds: [30008],
    authors: [userPubkey]
  });

  if (!badgesEvent) return [];

  const communityPubkeys = new Set<string>();
  for (const tag of badgesEvent.tags) {
    if (tag[0] !== 'a') continue;
    const [kind, author] = tag[1].split(':');
    if (kind === '30009' && author) {
      communityPubkeys.add(author);
    }
  }

  return Array.from(communityPubkeys);
}

// 2) Community‑Metadaten (Kind-10222) laden
async function loadMyCommunities(ndk: NDK, userPubkey: string) {
  const pubkeys = await getMyCommunityPubkeys(ndk, userPubkey);

  const communities = [] as Array<{
    pubkey: string;
    name?: string;
    description?: string;
    relays: string[];
  }>;

  for (const pubkey of pubkeys) {
    const communityEvent = await ndk.fetchEvent({
      kinds: [10222],
      authors: [pubkey]
    });

    if (!communityEvent) continue;

    const relays = communityEvent.tags
      .filter((t) => t[0] === 'r' && t[1])
      .map((t) => t[1]);

    const descriptionTag = communityEvent.tags.find((t) => t[0] === 'description');

    communities.push({
      pubkey,
      name: communityEvent.content || undefined,
      description: descriptionTag?.[1],
      relays
    });
  }

  return communities;
}
```

## Zielgerichtete Veröffentlichungs-Event (kind:30222)

Um eine bestehende Veröffentlichung auf bestimmte Communities auszurichten, erstellen Nutzer ein [[kind-30222]]-Event:

```json
{
  "id": "<event-id>",
  "pubkey": "<pubkey>",
  "created_at": 1675642635,
  "kind": 30222,
  "tags": [
    ["d", "<random-id>"],
    ["e", "<event-id-of-original-publication>"],
    ["k", "<kind-of-original-publication>"],
    ["p", "<community1-pubkey>"],
    ["r", "<main-relay1-url>"],
    ["p", "<community2-pubkey>"],
    ["r", "<main-relay2-url>"]
  ],
  "content": "",
  "sig": "<signature>"
}
```

Das zielgerichtete Veröffentlichungs-Event kann die ursprüngliche Veröffentlichung auf zwei Arten referenzieren:

1. Mit einem `e`-Tag mit der Event-ID, Relay-Hinweis und Pubkey-Hinweis
2. Mit einem `a`-Tag mit der Event-Adresse und Relay-Hinweis

Das `k`-Tag gibt den Typ der ursprünglichen Veröffentlichung an, und die `p`-Tags listen die Communities auf, an die diese Veröffentlichung gerichtet ist.

Derzeit können maximal 12 Communities pro Veröffentlichung getaggt werden.

**Hinweis:** Für neue Veröffentlichungen sollten Clients zunächst ein zielgerichtetes Veröffentlichungs-Event erstellen (das nur eine id hat) und es mit einem `h`-Tag im Haupt-Event referenzieren.

## Community-exklusive Veröffentlichungen

Chat-Nachrichten [[kind-9]] und Forum-Beiträge [[kind-11]] sind standardmäßig exklusiv. Sie können nur einer Community angehören und können nicht auf mehrere Communities ausgerichtet werden.

Für diese exklusiven Inhaltstypen benötigen wir kein zielgerichtetes Veröffentlichungs-Event. Stattdessen verwenden sie ein `h`-Tag, um ihre Community direkt zu referenzieren.

Für Chat-Nachrichten innerhalb einer Community sollten Nutzer [[kind-9]]-Events mit einem Community-Tag verwenden:

```json
{
  "id": "<event-id>",
  "pubkey": "<pubkey>",
  "created_at": 1675642635,
  "kind": 9,
  "tags": [
    ["h", "<community-pubkey>"]
  ],
  "content": "<message>",
  "sig": "<signature>"
}
```

Das gleiche Muster gilt für Forum-Beiträge, siehe [[kind-11]].

## Badge-basierte Zugriffskontrolle

Communities verwenden [[NIP-58|Badges]] für Veröffentlichungsberechtigungen. Jeder Inhaltsabschnitt kann ein oder mehrere `a`-Tags haben, die auf Badge-Definition-Events verweisen. Nutzer, die **eines dieser Badges** besitzen, können in diesem Inhaltsabschnitt veröffentlichen.

```json
["content", "Artikel"],
["k", "30023"],
["a", "30009:community-pubkey:member"],
["a", "30009:community-pubkey:pro"],
["a", "30009:community-pubkey:team"]
```

In diesem Beispiel können Badge-Inhaber von "Member", "Pro" und "Team" alle Artikel veröffentlichen.

Badge-Definitionen können ein `form`-Tag enthalten, das auf eine Formularvorlage verweist, siehe [[kind-30168]] und [[NIP-101]]. Nutzer fordern Badges an, indem sie ein Formularantwort-Event [[kind-1069]] einreichen, das sowohl das Formular als auch das Badge referenziert. Dies ermöglicht es Communities, Informationen von Nutzern zu sammeln, bevor Zugriff gewährt wird.

### Delegierte Badge-Vergabe

Der Pubkey, der Badges vergibt, **muss nicht derselbe sein** wie der Pubkey der Community. Das `a`-Tag in einem Inhaltsabschnitt referenziert einfach eine Badge-Definition — dieses Badge kann von jedem Pubkey erstellt und vergeben werden.

Dies ermöglicht wichtige Sicherheitsmuster:

- **Separater Vergabe-Schlüssel:** Communities können einen dedizierten Pubkey für die Verarbeitung von Badge-Vergaben verwenden. Dieser Schlüssel kann auf einem Live-Server laufen, um Formularantworten zu verarbeiten, ohne den Haupt-Community-Schlüssel freizulegen.
- **Mehrere Vergabe-Autoritäten:** Verschiedene Badges können von verschiedenen Pubkeys verwaltet werden, was eine Delegierung der Mitgliedschaftsverwaltung ermöglicht.
- **Speicherung im Tresor für Community-Schlüssel:** Der Haupt-Community-Schlüssel kann im Tresor bleiben und nur zur Aktualisierung des Community-Definition-Events verwendet werden.

Beispiel: Ein "Member"-Badge einer Community könnte von einem separaten "Membership-Bot"-Pubkey definiert und vergeben werden, der Anwendungen automatisch verarbeitet, während der Haupt-Schlüssel der Community sicher offline bleibt.

## Kommentare, Reaktionen, Etiketten und Zaps

Wenn eine Veröffentlichung mehrere Communities anspricht, nehmen Mitglieder aller dieser Communities gemeinsam teil:

**Kommentare, Reaktionen und Etiketten** — filtern nach Badge-Halter-Pubkeys aus allen angesteuerten Communities. Mitglieder verschiedener Communities treffen sich in einer gemeinsamen Diskussion um die Veröffentlichung. Keine Duplikate, keine fragmentierten Gespräche über mehrere Orte verteilt.

HINWEIS: Communities, die nicht Teil von Diskussionen mit bestimmten anderen Communities sein möchten, können diese Events einfach nicht akzeptieren.

**Zaps** — jeder kann Community-Inhalte mit Zaps würdigen. Zap-Bestätigungen auf den Community-Relays abfragen. Kein Badge-Halter-Filter — externe Wertschätzung ist immer willkommen.

## Kanban-Boards in Communities teilen - ShareLink Integration

Ein innovativer Anwendungsfall von Communikeys ist das Teilen von Kanban-Boards innerhalb von Communities über **ShareLinks**. Dies ermöglicht es, Projektboards dezentralisiert und vertrauenslos zwischen Community-Mitgliedern auszutauschen.

### ShareLink-Konzept

Ein ShareLink ist eine URL-sichere Repräsentation eines gesamten Kanban-Boards. Während die Board-Daten selbst komprimiert werden können (was zu großen Tokens führt), wird empfohlen, den Link zu einem webgestützten Board-Viewer zu teilen, der die Daten dekodiert.

Der ShareLink enthält Referenzen zu:
- Board-Metadaten (Name, Beschreibung, Ersteller)
- Alle Spalten und deren Reihenfolge
- Alle Karten mit vollständigen Details (Titel, Beschreibung, Labels, Anhänge)
- Kommentare und Reaktionen
- Community-Referenzen und Badge-Anforderungen

### Workflow: Board in einer Community teilen

**Hinweis zu `e`/`k`:** Im Board‑Workflow wird das Board über `a` (Address von Kind 30301) referenziert. Für **replaceable** Boards ist `a` die kanonische Referenz; `e` und `k` sind nur nötig, wenn eine **bestehende Veröffentlichung** per Event‑ID zielgerichtet verteilt wird. Daher sind `e`/`k` hier optional und bewusst weggelassen.

**1. Board als Kind 30222 (Targeted Publication) registrieren:**

```json
{
  "kind": 30222,
  "tags": [
    ["d", "<board-id>"],
    ["a", "30301:<board-creator>:<board-id>"],
    ["p", "<community-pubkey>"],
    ["url", "https://edufeed-org.github.io/kanban-editor/cardsboard/naddr1qvzqqqrkt5pz..."],
    ["naddr", "naddr1qvzqqqrkt5pz..."]
  ],
  "content": "📊 **Board-Titel**\n\nBeschreibung des Boards mit Kontext und Ziel.\n\n🔗 [Board öffnen](https://edufeed-org.github.io/kanban-editor/cardsboard/naddr1qvzqqqrkt5pz...)"
}
```

Das `url`-Tag enthält die Web-URL zum Board-Viewer. Das `naddr`-Tag ermöglicht Clients, das Board zu verifikation und dezentral zu laden. Der `content` enthält aussagekräftige Metadaten für Community-Previews.

**2. ShareLink generieren:**

Der Client generiert einen Link zu einem Board-Viewer mit naddr-Referenz:

```
https://edufeed-org.github.io/kanban-editor/cardsboard/naddr1qvzqqqrkt5pz...
```

**Optionale Optimierung:** Für Offline-Unterstützung kann ein komprimierter Token als Query-Parameter hinzugefügt werden:

```
https://edufeed-org.github.io/kanban-editor/cardsboard/naddr1qvzqqqrkt5pz...?import=<compressed-token>
```

⚠️ **Hinweis zur Token-Größe:** Komprimierte Tokens können 50-200KB+ erreichen. URL-basierte Links sind praktikabler für Community-Sharing, da Events klein bleiben und schneller repliziert werden.

**3. In Community veröffentlichen:**

Das `kind-30222`-Event wird auf den Community-Relays veröffentlicht und kann von allen Community-Mitgliedern importiert werden.

**4. Import mit Badge-Validierung:**

- Client folgt dem `url`-Tag oder dekodiert den optionalen `import`-Query-Parameter
- Lädt das Board vom Viewer oder dekomprimiert lokales Import-Token
- Validiert, dass der Nutzer die erforderlichen Badges für die Inhaltstypen hat
- Überprüft das Kind-30222-Event auf korrekter Signatur
- Importiert das Board lokal mit wählbaren Modi:
  - **merge**: Erzeugt neue IDs (konfliktfrei)
  - **new**: Erstellt Variante mit "(Imported)"-Suffix
  - **overwrite**: Überschreibt bestehendes Board (mit Warnung)

### Sicherheitsüberlegungen

- **XSS-Prevention**: Alle importierten Daten werden bereinigt
- **URL-Validierung**: Das `url`-Tag wird auf HTTPS und bekannte Domain-Whitelist validiert
- **naddr-Verifikation**: Der naddr wird dekodiert und gegen das Nostr-Event verglichen
- **Badge-Filtering**: Nur Badge-Halter können Boards mit Zugriffsbeschränkungen sehen
- **Signatur-Validierung**: Das Kind-30222-Event wird auf korrekter Signatur überprüft
- **Event-Größe**: Kleine Event-Größe (< 5KB) durch URL-Referenzierung statt Inline-Token

### Vorteile für Community-Zusammenarbeit

✅ **Dezentralisiert**: Kein zentraler Server nötig, alles über Nostr
✅ **Transparent**: Audit-Trail über Nostr Events
✅ **Flexible Zugangskontrolle**: Badges definieren wer teilen darf
✅ **Offline-ready**: Boards können offline bearbeitet und später synced werden
✅ **Multi-Community**: Ein Board kann in mehreren Communities gleichzeitig aktiv sein

## Implementierungshinweise

Im Gegensatz zu [[NIP-29]] (Relay-basierte Gruppen) funktionieren Communikeys auf **jedem Standard-Nostr-Relay**. Die Zugriffskontrolle wird auf Clientseite durchgesetzt, nicht vom Relay (obwohl dieses sie natürlich optimieren kann).

**Client-Filtering-Workflow:**

1. Abrufen des Community-[[kind-10222]]-Events, um Inhaltsabschnitte und deren `k`-Tags zu erhalten
2. Abfrage nach Events dieser Typen, die auf die Community ausgerichtet sind (über `h`-Tag oder zielgerichtete Veröffentlichung)
3. Filtern der Ergebnisse, um nur Events von Pubkeys zu zeigen, die eines der erforderlichen Badges für diesen Inhaltsabschnitt halten

**Medien-Fallback:**

Community-Blossom-Server SOLLTEN alle in Community-Veröffentlichungen referenzierten Mediendateien sichern — auch wenn die ursprünglichen URLs auf verschiedene Server verweisen. Durch das Speichern von Dateien nach ihrem Content-Hash wird der Community-Server zu einem zuverlässigen Fallback, wenn externe URLs unter Link-Rot leiden. Clients können den Community-Blossom-Server versuchen, wenn die ursprüngliche Medien-URL fehlschlägt.

**Zusätzliche Empfehlungen:**

- Clients KÖNNEN Community-Metadaten und Badge-Vergaben zwischenspeichern, um Relay-Abfragen zu reduzieren
- Clients SOLLTEN Badge-Anforderungen vor dem Veröffentlichungsversuch überprüfen
- Relays KÖNNEN optional Badge-Anforderungen überprüfen oder Aufbewahrungsrichtlinien implementieren, aber das ist nicht erforderlich

## Benefits

1. No special relay required — works on any standard Nostr relay, unlike [[NIP-29]]
2. Easy onboarding — new users don't need to set up any personal relay or media server to join Nostr via a community. They can use the community's relay and blossom server immediately.
3. Any existing npub can become a community
4. Any existing publication can be targeted at communities (backwards compatible)
5. Communities are not permanently tied to specific relays
6. Communities can define their own content types with badge-based access control
7. Cross-community interaction via Targeted Publications
8. Users can request access by submitting Form Responses
9. Delegated badge awarding — separate keys can handle membership without exposing the main community keypair