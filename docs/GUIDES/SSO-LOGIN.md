## SSO-Login (OIDC) — Client-only (SPA) für Nostr-User

Dieses Dokument beschreibt, wie Single Sign-On (SSO) per OpenID Connect (OIDC) in einer reinen Client-seitigen Single-Page-App (SPA) implementiert wird. Es geht davon aus, dass keine eigene Backend-Callback-Route (kein `server.ts` / `server.svelte.ts`) verwendet wird und dass der Benutzer ein Nostr-User ist: in den ID-Token-/Claims werden die Felder `npub` (öffentliches Nostr-Pubkey) und `nsec` (privater Schlüssel) erwartet.

WICHTIG: Das Projekt hat strikte Sicherheitsregeln. Private Keys (`nsec`) dürfen niemals persistent gespeichert werden (z. B. LocalStorage, IndexedDB, Logs). Dieses Dokument zeigt, wie man mit der Forderung nach `nsec` in Claims umgeht, nennt sichere Alternativen und gibt klare DoD- und Sicherheits-Hinweise.

## Kurzübersicht: Flow (Authorization Code + PKCE)

- Warum PKCE? SPAs sind öffentliche Clients — PKCE erlaubt den Authorization Code Flow ohne Client-Secret.
- High-level Schritte:
  1. SPA generiert `code_verifier` und `code_challenge` (S256).
  2. SPA redirectet den Nutzer zur OIDC-Authorization-Endpoint mit `response_type=code`, `code_challenge`, `scope=openid profile email nostr` (oder provider-spezifisch), `client_id` und `redirect_uri`.
  3. User authentifiziert beim Identity Provider (IdP) und wird zurück zur `redirect_uri` geleitet mit `?code=...`.
  4. SPA tauscht Code gegen Tokens am Token-Endpoint (POST). Provider muss CORS für Token-Endpunkt für SPAs unterstützen.
  5. SPA dekodiert das `id_token` (JWT) und liest Claims `npub` und (falls vorhanden) `nsec` aus.

## Security-First Regeln (Kurz)

- Niemals `nsec` persistent speichern. Nur im Arbeitsspeicher (ephemeral) und nur wenn unvermeidlich.
- Preferiere stattdessen: IdP liefert nur `npub` (pubkey). Wenn Signieren nötig ist, verwende einen client-side Signer (NIP-07) oder NIP-46 Remote Signer.
- Speichere dauerhaft nur `pubkey`/`npub` und Session-Metadaten (TTL), niemals private Keys.
- Verweise: `docs/DOCUMENTATION-RULES-v3.md`, `docs/NDK.md`, `docs/STORES/AUTHSTORE.md`.

## Zusammenspiel mit Nostr / Projektregeln

- Das Projekt erwartet, dass Benutzer Nostr-Identitäten haben. Idealerweise speichert der IdP nur `npub` in den Claims und liefert eine Möglichkeit, lokal (im Browser) zu signieren per NIP-07.
- Falls der IdP `nsec` liefert (z. B. in einem privaten Claim), muss die App:
  - `nsec` nur in RAM halten (z. B. in einem flüchtigen `AuthStore`),
  - niemals in LocalStorage/IndexedDB/logs schreiben,
  - bei Logout oder Tab-Schließen `nsec` sofort löschen.

## DoD / Acceptance Criteria für diese Integration

- [ ] PKCE-Flow implementiert (code_verifier/challenge generiert & verwendet).
- [ ] Token-Exchange funktioniert (Token Endpoint CORS geprüft).
- [ ] `id_token` verifiziert (Signatur optional, abhängig vom Provider; mind. decode & `iss`/`aud`/`exp` prüfen).
- [ ] `npub` in `AuthStore` persistiert (nur pubkey), `nsec` nur in-memory ephemeral.
- [ ] Security-Note in CHANGELOG/CHANGELOG.md wenn User-visible change.
- [ ] Dokumentation (`docs/GUIDES/SSO-LOGIN.md`) erstellt (dieser File).

## OIDC PKCE: Hilfsfunktionen (TypeScript — Browser)

```ts
// utils/oidc-pkce.ts — Hilfsfunktionen, browser-only
function base64urlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generateCodeChallengePair() {
  const verifier = crypto.getRandomValues(new Uint8Array(64)).reduce((s, b) => s + String.fromCharCode(b), '');
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64urlEncode(digest);
  // Keep verifier as plain string; challenge is urlsafe
  return { code_verifier: verifier, code_challenge: challenge };
}
```

Hinweis: Für `verifier` ist es besser, eine sichere Zufalls-String-Implementierung zu verwenden. Hier ist eine kompakte Browser-Approach; Libraries wie `oauth4web` oder `pkce` können verwendet werden.

## SPA: Login-Initiation (Svelte Beispiel)

In `src/lib/stores/authStore.svelte.ts` (oder einer passenden AuthStore-Datei) kann eine `login()`-Funktion die Weiterleitung auslösen:

```ts
// Beispiel: authStore.svelte.ts (vereinfachte Skizze)
import { $state } from 'svelte-runes';
import { generateCodeChallengePair } from '$lib/utils/oidc-pkce';

export class AuthStore {
  private session = $state<{ npub?: string, expiresAt?: number } | null>(null);

  async loginWithOIDC() {
    const { code_verifier, code_challenge } = await generateCodeChallengePair();
    // Wichtig: verifier temporär sicher speichern (sessionStorage in-memory-like) — löschen nach Exchange!
    sessionStorage.setItem('pkce_verifier', code_verifier);

    const params = new URLSearchParams({
      client_id: IMPORT_YOUR_CLIENT_ID,
      response_type: 'code',
      scope: 'openid profile email nostr',
      redirect_uri: window.location.origin + '/auth/callback',
      code_challenge_method: 'S256',
      code_challenge,
    });

    window.location.href = `https://your-idp.example.com/authorize?${params.toString()}`;
  }
}

```

Hinweis: `IMPORT_YOUR_CLIENT_ID` ist ein Platzhalter; nutze Build-time env vars (z. B. `import.meta.env.PUBLIC_OIDC_CLIENT_ID`).

## SPA: Callback-Handler & Token-Exchange

Die Route `redirect_uri` (z. B. `/auth/callback`) muss in der SPA existieren und den Query-Parameter `code` auswerten. Beispiel in `src/routes/auth/callback/+page.svelte` oder einem kleinen JS-Handler:

```ts
// callback handler (vereinfachte Logik)
const params = new URLSearchParams(location.search);
const code = params.get('code');
const verifier = sessionStorage.getItem('pkce_verifier');
if (!code || !verifier) {
  throw new Error('Missing code or verifier');
}

// Token Exchange — POST an Token Endpoint
const body = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: window.location.origin + '/auth/callback',
  client_id: IMPORT_YOUR_CLIENT_ID,
  code_verifier: verifier,
});

const res = await fetch('https://your-idp.example.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
});

if (!res.ok) throw new Error('Token exchange failed');
const tokens = await res.json();
// tokens may contain: access_token, id_token, refresh_token

// decode id_token (jwt) — minimal decode
function parseJwt (token: string) {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

const idClaims = parseJwt(tokens.id_token);
// Expect claims: npub, nsec (if IdP provides it)
const npub = idClaims.npub as string | undefined;
const nsec = idClaims.nsec as string | undefined; // SENSITIV

// Security handling below
```

## Umgang mit `nsec` Claim (Sicherheits-Policy)

- Falls `nsec` in den Claims vorhanden ist **dürfen Sie es niemals persistieren**. Empfohlene Vorgehensweise:
  1. Speichere nur `npub` dauerhaft (LocalStorage mit TTL). `nsec` halte nur in-memory im `AuthStore`.
  2. Nutze `nsec` nur, wenn du im gleichen Session-Tab unmittelbar signieren musst.
  3. Bei Logout/Tab-Close/Refresh: `nsec` aus Speicher löschen. Entferne `pkce_verifier`.

- Besser: Verwende NIP-07 (Browser Signer) statt `nsec` in Token:
  - Wenn möglich, liefere `npub` im Token und forciere Signieren via NIP-07 (oder NIP-46) für Event-Signaturen.

Beispiel: sichere In-Memory Speicherung (Svelte pseudo-code):

```ts
// authStore.svelte.ts (snipped)
private ephemeralNsec?: string;

handleTokens(tokens) {
  const idClaims = parseJwt(tokens.id_token);
  this.session = { npub: idClaims.npub, expiresAt: Date.now() + tokens.expires_in * 1000 };
  if (idClaims.nsec) {
    this.ephemeralNsec = idClaims.nsec; // ONLY in RAM
  }
}

logout() {
  this.ephemeralNsec = undefined; // wipe
  this.session = null;
  sessionStorage.removeItem('pkce_verifier');
}
```

## Beispiel: Signieren einer Nostr-Event mit ephemeral `nsec`

```ts
// nur wenn ephemeralNsec vorhanden — NICHT persistiert!
if (authStore.ephemeralNsec) {
  const signed = signNostrEvent(event, authStore.ephemeralNsec); // signNostrEvent ist projekt-spezifisch
  await publishEvent(signed);
  // Optional: Nach sicherheitskritischen Operationen löschen
  authStore.ephemeralNsec = undefined;
}
```

Noch besser ist: Delegiere das Signieren an NIP-07 Browser Signer (extension), dann wird `nsec` niemals an die SPA übergeben.

## Hinweise zu Provider-Implementierung & CORS

- Token-Endpoint muss CORS erlauben, sonst schlägt der Token-Exchange vom Browser fehl.
- Manche IdPs verweigern sensible Claims in `id_token` für öffentliche Clients. Falls `nsec` zwingend ist: koordiniere mit IdP-Admins, setze sinnvolle TTLs und Rate-Limits.

## Session Management & Persistenz

- Persistiere nur `npub` + session metadata (expiresAt) in LocalStorage mit TTL. Beispiel-Shape:

```json
{
  "npub": "npub1...",
  "expiresAt": 1698710400000
}
```

- WICHTIG: `nsec` NIE in JSON-serialisiertem storage schreiben.

## Beispiel: +layout.svelte Integration (kurz)

In `+layout.svelte` initialisierst du `AuthStore`, prüfst vorhandene `npub`-Session und richtest Redirect-Handler ein.

Wichtig: Bei Refresh prüfe `expiresAt` und führe bei Bedarf silent-refresh oder erneuten Login durch (abhängig vom Provider und ob `refresh_token` für SPAs erlaubt ist).

## Troubleshooting & FAQs

- "Token exchange blocked by CORS" → Token-Endpoint CORS konfigurieren.
- "IdP liefert kein nsec" → Verwende NIP-07 oder ergänze Provider-Claims sicher.
- "Wie verifiziere ich id_token?" → Verifiziere `iss`, `aud` und `exp`; optionale Signatur-Validation über JWKs ist empfohlen.

## Referenzen & weiterführende Docs

- OIDC Spec: https://openid.net/specs/openid-connect-core-1_0.html
- PKCE: RFC 7636
- Projekt-Dokumente:
  - `docs/DOCUMENTATION-RULES-v3.md`
  - `docs/NDK.md`
  - `docs/GUIDES/PROP-VS-STATE-CHEATSHEET.md`
  - `docs/STORES/AUTHSTORE.md`

## Next steps / TODOs

- Maintainer: Bitte ergänzen Sie `_INDEX.md` um einen Link zu diesem Guide (siehe `docs/_INDEX.md`).

---
Datum: 2025-10-30
