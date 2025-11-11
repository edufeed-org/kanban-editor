# AuthStore Dokumentation

**Datei:** `src/lib/stores/authStore.svelte.ts`  
**Technologie:** Svelte 5 Runes (Klassen-basierter Store) + NDK  
**Pattern:** Manuelles `localStorage` (siehe `STORE-PATTERNS.md`)  
**Zweck:** Benutzerauthentifizierung mit Nostr (NIP-07, nsec, Demo-Mode)

---

## 📋 Inhaltsverzeichnis

1. [Architektur & Pattern](#architektur--pattern)
2. [Authentifizierungs-Flows](#authentifizierungs-flows)
3. [Session-Management](#session-management)
4. [Demo-Modus](#demo-modus)
5. [User-Profile](#user-profile)
6. [API-Referenz](#api-referenz)
7. [Security-Rules](#security-rules)
8. [Integration](#integration)

---

## Architektur & Pattern

Der `AuthStore` verwaltet die **Benutzerauthentifizierung** und die **Session** in einer Svelte 5 Klassen-basierten Store. Er folgt dem **manuellen `localStorage` Pattern**, da er eine asynchrone Initialisierung (NDK, `fetchProfile`) und die Verwaltung einer einzelnen, aber komplexen Session-Objekts benötigt.

**Warum nicht `persisted()`?**
- **Async-Initialisierung:** Der `AuthStore` muss auf die NDK-Initialisierung und das Laden von Konfigurationen warten.
- **Komplexe Logik:** Session-Wiederherstellung, Expiration-Checks und Signer-Management erfordern manuelle Kontrolle.

```mermaid
graph TD
    subgraph AuthStore
        A[currentUser = $state(null)]
        B[isAuthenticated = $derived(...)]
        C[saveSession()]
        D[restoreSession()]
    end

    subgraph Browser
        E[localStorage]
        F[window.nostr]
    end

    subgraph Backend
        G[Nostr Relays]
    end

    UI -- ruft auf --> Login-Methoden
    Login-Methoden -- schreibt --> A
    Login-Methoden -- ruft auf --> C
    C -- schreibt --> E
    App-Start -- ruft auf --> D
    D -- liest --> E
    D -- schreibt --> A
    Login-Methoden -- interagiert mit --> F
    NDK -- interagiert mit --> G
```

### Kern-Implementierung (`authStore.svelte.ts`)

```typescript
// src/lib/stores/authStore.svelte.ts
import type NDK from '@nostr-dev-kit/ndk';
import { NDKNip07Signer, NDKPrivateKeySigner, type NDKUser } from '@nostr-dev-kit/ndk';

const AUTH_SESSION_KEY = 'kanban-auth-session';

export class AuthStore {
    // 1. Reaktiver State mit Svelte 5 Runes
    public currentUser = $state<NDKUser | null>(null);
    public isLoading = $state<boolean>(true);
    public errorMessage = $state<string | null>(null);

    // 2. Abgeleiteter reaktiver State
    public isAuthenticated = $derived(this.currentUser !== null);

    private ndk: NDK;

    constructor(ndkInstance: NDK) {
        this.ndk = ndkInstance;
        this.restoreSession(); // Session beim Start wiederherstellen
    }
    
    // ... Login-Methoden, etc.
}
```

---

## Authentifizierungs-Flows

### Flow 1: NIP-07 Browser Extension Login (Production)

```typescript
/**
 * NIP-07: Sichere Login via Browser Extension
 * Nutzt window.nostr API (Alby, nos2x, etc.)
 */
public async loginWithNip07(): Promise<NDKUser> {
    this.isLoading = true;
    
    // 1. Extension Check
    if (!window.nostr) {
        throw new Error('Nostr extension not found. Install Alby or nos2x.');
    }
    
    // 2. Signer initialisieren
    const signer = new NDKNip07Signer();
    this.ndk.signer = signer;
    
    // 3. User laden
    const user = await signer.user();
    this.currentUser = user;
    
    // 4. Profil laden
    this.currentUser.profile = await user.fetchProfile() || undefined;
    
    // 5. Session speichern (ohne Private Key!)
    await this.saveSession(user, 'nip07');
    
    this.isLoading = false;
    return user;
}
```

**Sequenzdiagramm:**

```
User → Browser Extension (Alby) → AuthStore → NDK → Nostr Relays
  1. Klick "Login"
  2. Extension popup: Pubkey freigeben?
  3. Extension gibt Pubkey zurück
  4. NDK lädt Profil von Relays
  5. Session wird gespeichert (nur pubkey!)
```

**REGEL 1:** NIP-07 ist die **einzige** Production-Login-Methode!

### Flow 2: nsec Private Key Login (Development ONLY!)

```typescript
/**
 * ⚠️ DEVELOPMENT ONLY!
 * Nimmt nsec1... String und erstellt lokalen Signer
 */
public async loginWithNsec(nsec: string): Promise<NDKUser> {
    // TODO: Check if in development environment
    
    this.isLoading = true;
    
    // 1. nsec Format validieren
    if (!nsec.startsWith('nsec1') || nsec.length !== 63) {
        throw new Error('Invalid nsec format');
    }
    
    // 2. Privat-Signer erstellen
    const signer = new NDKPrivateKeySigner(nsec);
    this.ndk.signer = signer;
    
    // 3. User laden
    const user = await signer.user();
    await user.fetchProfile();
    this.currentUser = user;
    
    // 4. Session speichern (ohne nsec!)
    await this.saveSession(user, 'nsec');
    
    this.isLoading = false;
    return user;
}
```

**⚠️ SECURITY WARNING:**
- ❌ **NIEMALS** in Production verwenden!
- ❌ **NIEMALS** nsec in localStorage speichern!
- ✅ Nur für lokale Development/Testing

**REGEL 2:** nsec-Login MUSS deaktiviert werden in Production-Build!

### Flow 3: Demo-Modus (Offline Identity)

```typescript
/**
 * Demo-Session: Lokale Identity ohne Nostr-Connection
 * Ermöglicht Board-Verwaltung ohne Login
 */
public createDemoSession(): void {
    // 1. Config-Check: Ist Demo erlaubt?
    if (!this.isDemoSessionAllowed()) {
        throw new Error('Demo sessions are disabled in configuration');
    }
    
    // 2. Generiere Demo-ID
    const demoId = `demo-${Math.random().toString(36).slice(2, 10)}`;
    
    // 3. Erstelle Session
    const demoSession: UserSession = {
        pubkey: demoId,
        npub: `npub_demo_${demoId.slice(5)}`,
        profile: {
            name: 'Demo User',
            about: 'Local demo session'
        },
        signerType: 'demo',
        lastLogin: Date.now(),
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000  // 30 Tage
    };
    
    // 4. Speichern & aktivieren
    this.sessionStore.set(demoSession);
    this.currentUser = { ...demoSession } as any;
    
    console.log('✅ Demo-Session erstellt:', demoId);
}
```

**Demo-Modus Features:**
- ✅ Boards lokal erstellen & bearbeiten
- ✅ Keine Nostr-Relays nötig
- ✅ Persistence in localStorage
- ❌ Keine Synchronisation mit anderen Geräten
- ❌ Keine Nostr-Event-Publishing

**REGEL 3:** Demo-Modus kann via `config.json` deaktiviert werden.

---

## Session-Management

### Session-Struktur

```typescript
export interface UserSession {
    pubkey: string;           // Hex Public Key
    npub: string;             // Bech32 Format
    profile: {
        name?: string;
        about?: string;
        picture?: string;
        nip05?: string;
        lud16?: string;       // Lightning Address
    };
    signerType: 'nip07' | 'nsec' | 'nip46' | 'demo';
    lastLogin: number;
    expires: number;          // Unix Timestamp
}
```

**REGEL 4:** Sessions enthalten **NIEMALS** Private Keys!

### Session speichern (Manuelles localStorage)

```typescript
private async saveSession(
    user: NDKUser,
    signerType: 'nip07' | 'nsec' | 'nip46'
): Promise<void> {
    const session: UserSession = {
        pubkey: user.pubkey,  // ← Nur pubkey (HEX)!
        npub: user.npub,
        profile: {
            name: user.profile?.name,
            picture: user.profile?.picture || user.profile?.image,
            // ...
        },
        signerType,
        lastLogin: Date.now(),
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 Tage
    };
    
    // Manuelles Speichern in localStorage
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    
    console.log(`💾 Session saved for ${user.profile?.name || 'Anonymous'}`);
}
```

**REGEL 5:** Session Expiration ist **7 Tage** für echte Nostr-Sessions, **30 Tage** für Demo.

### Session wiederherstellen (Manuelles localStorage)

```typescript
private async restoreSession(): Promise<void> {
    const storedJson = localStorage.getItem(AUTH_SESSION_KEY);
    if (!storedJson) {
        this.isLoading = false;
        console.log('👤 Keine Session gefunden.');
        return;
    }

    const stored: UserSession = JSON.parse(storedJson);
    
    // Expiration Check
    if (Date.now() > stored.expires) {
        localStorage.removeItem(AUTH_SESSION_KEY);
        this.currentUser = null;
        this.isLoading = false;
        console.log('⏰ Session expired');
        return;
    }
    
    // Demo-Session: Direkt aktivieren
    if (stored.signerType === 'demo') {
        this.currentUser = { ...stored } as any; // Type assertion for simplicity
        this.isLoading = false;
        console.log('✅ Demo-Session wiederhergestellt');
        return;
    }
    
    // Nostr-Session: User von NDK laden
    try {
        const user = await this.ndk.fetchUser({ pubkey: stored.pubkey });
        if (user) {
            user.profile = stored.profile;
            this.currentUser = user;
            
            // Signer wiederherstellen (nur NIP-07)
            if (stored.signerType === 'nip07' && window.nostr) {
                this.ndk.signer = new NDKNip07Signer();
            }
            console.log('🔄 Nostr-Session wiederhergestellt');
        }
    } catch (error) {
        console.error("Fehler bei der Wiederherstellung der Nostr-Session:", error);
        this.currentUser = null;
        localStorage.removeItem(AUTH_SESSION_KEY);
    } finally {
        this.isLoading = false;
    }
}
```

**REGEL 6:** Beim App-Start wird **automatisch** die letzte Session wiederhergestellt.

### Logout

```typescript
public async logout(): Promise<void> {
    // 1. User löschen ($state wird reaktiv)
    this.currentUser = null;
    
    // 2. Signer entfernen
    this.ndk.signer = undefined;
    
    // 3. Session aus localStorage löschen
    localStorage.removeItem(AUTH_SESSION_KEY);
    
    console.log('🚪 User logged out');
}
```

**REGEL 7:** Logout entfernt **vollständig** alle User-Daten aus Memory & localStorage.

---

## Demo-Modus

### Config-Integration

Der `AuthStore` ist vom `SettingsStore` abhängig, um zu prüfen, ob der Demo-Modus erlaubt ist. Diese Prüfung sollte idealerweise außerhalb des `AuthStore` stattfinden, bevor `createDemoSession` aufgerufen wird.

```typescript
// In einem UI-Component (z.B. LoginSheet.svelte)
import { settingsStore } from '$lib/stores/settingsStore.svelte.ts';
import { authStore } from '$lib/stores/authStore.svelte.ts';

const isDemoAllowed = $derived(settingsStore.data.allow_demo_session.enabled);

function handleDemoLogin() {
    if (isDemoAllowed) {
        authStore.createDemoSession();
    } else {
        // UI-Feedback, dass Demo-Modus deaktiviert ist
    }
}
```

**config.json Beispiel:**

```json
{
  "allow_demo_session": {
    "enabled": true,
    "max_duration_days": 30
  }
}
```

**REGEL 8:** Die UI sollte den Demo-Login-Button ausblenden, wenn er via `config.json` deaktiviert ist.

### Demo vs Nostr: Funktionsvergleich

| Feature | Demo-Modus | Nostr-Modus |
|---------|------------|-------------|
| Boards erstellen | ✅ | ✅ |
| Karten bearbeiten | ✅ | ✅ |
| localStorage Sync | ✅ | ✅ |
| Nostr Event Publishing | ❌ | ✅ |
| Multi-Device Sync | ❌ | ✅ |
| Reactions/Zaps | ❌ | ✅ |
| Expiration | 30 Tage | 7 Tage |

**REGEL 9:** Demo ist **Offline-First** — ideal für Testing ohne Relay-Zugang.

---

## User-Profile

### Profil aktualisieren

```typescript
public async updateProfile(profileData: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
}): Promise<void> {
    if (!this.currentUser) {
        throw new Error('No user session');
    }
    
    // 1. Lokales Update
    Object.assign(this.currentUser.profile, profileData);
    
    // 2. Nur für echte Nostr-User publizieren
    const session = this.getStoredSession();
    if (session?.signerType !== 'demo' && this.ndk.signer) {
        await this.currentUser.publish();  // ← Kind 0 Event
    }
    
    // 3. Session aktualisieren
    const storedJson = localStorage.getItem(AUTH_SESSION_KEY);
    if (storedJson) {
        const session = JSON.parse(storedJson) as UserSession;
        session.profile = { ...session.profile, ...profileData };
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    }
    
    console.log('✅ Profile updated');
}
```

**REGEL 10:** Demo-User Profile werden **nur lokal** gespeichert (kein Nostr-Event).

### NIP-05 Verifikation

```typescript
public async verifyNip05(identifier: string): Promise<boolean> {
    if (!this.currentUser) return false;
    
    try {
        // 1. Parse identifier (user@domain)
        const [user, domain] = identifier.split('@');
        
        // 2. Fetch .well-known/nostr.json
        const response = await fetch(
            `https://${domain}/.well-known/nostr.json?name=${user}`
        );
        
        if (!response.ok) return false;
        
        // 3. Verify pubkey match
        const data = await response.json();
        return data.names[user] === this.currentUser.pubkey;
    } catch {
        return false;
    }
}
```

**REGEL 11:** NIP-05 Verifikation ist **optional** — nur für Public Profiles sinnvoll.

---

## API-Referenz

### Public Properties

```typescript
class AuthStore {
    // Reaktive States
    public currentUser: NDKUser | null
    public isAuthenticated: boolean  // $derived
    public isLoading: boolean
    public errorMessage: string | null
}
```

### Login-Methoden

```typescript
// Production
loginWithNip07(): Promise<NDKUser>

// Development ONLY
loginWithNsec(nsec: string): Promise<NDKUser>

// Demo-Modus
createDemoSession(): void

// Future
loginWithNip46(connectionString: string): Promise<NDKUser>
```

### User-Info Getter

```typescript
// Public Key (Hex)
getPubkey(): string | null

// NPub (Bech32)
getNpub(): string | null

// Display Name (with fallback)
getUserName(): string | null        // Returns profile.name or null
getDisplayName(): string            // Returns profile.name or "Nostr Nutzer" (never null)
getUserInitials(): string           // Returns initials from name or "NN"
getAvatarColor(): string            // Returns consistent Tailwind color class based on pubkey

// SSR-Safe Variants (return fallback instead of throwing)
getPubkeySafe(): string | null
getUserNameSafe(): string | null
getDisplayNameSafe(): string        // Returns "Nostr Nutzer" if not initialized
getUserInitialsSafe(): string       // Returns "NN" if not initialized
getAvatarColorSafe(): string        // Returns "bg-slate-500" if not initialized
```

**Verwendung in UI:**
```typescript
// ✅ RICHTIG - Nutze getDisplayName() für UI-Anzeige
<p>{authStore.getDisplayName()}</p>  // "Alice" oder "Nostr Nutzer"

// ✅ RICHTIG - Nutze getUserInitials() für Avatar
<Avatar.Fallback>{authStore.getUserInitials()}</Avatar.Fallback>  // "AL" oder "NN"

// ✅ RICHTIG - Nutze getAvatarColor() für konsistente Farbe
<Avatar.Fallback class={`${authStore.getAvatarColor()} text-white`}>
  {authStore.getUserInitials()}
</Avatar.Fallback>

// ❌ FALSCH - Nutze nicht getUserName() direkt in UI (kann null sein)
<p>{authStore.getUserName()}</p>  // Kann leer sein!
```

// Display Name
getUserName(): string | null

// Status
getStatus(): {
    isAuthenticated: boolean
    isLoading: boolean
    user: NDKUser | null
    error: string | null
}

// Session-Info (Debug)
getSessionInfo(): {
    isAuthenticated: boolean
    user: any
    session: UserSession | null
}
```

### Session-Management

```typescript
logout(): Promise<void>
updateProfile(profileData: {...}): Promise<void>
verifyNip05(identifier: string): Promise<boolean>
isDemoSessionAllowed(): boolean
```

---

## Security-Rules

### RULE 1: Niemals Private Keys speichern

```typescript
// ❌ FALSCH - SICHERHEITSLECK!
localStorage.setItem('nsec', nsec);
const session = { pubkey, nsec };  // ← nsec NIEMALS speichern!

// ✅ RICHTIG
const session = {
    pubkey,  // ← Nur Public Key!
    npub,
    profile: {...},
    signerType: 'nip07'
};
```

**Warum?** Private Keys in localStorage = **sofortiger Account-Verlust** bei XSS!

### RULE 2: nsec-Login nur in Development

```typescript
// ✅ RICHTIG: Environment-Check
public async loginWithNsec(nsec: string): Promise<NDKUser> {
    if (import.meta.env.PROD) {
        throw new Error('nsec login is disabled in production');
    }
    // ... login logic
}
```

**Implementation:**
- In `vite.config.ts` setze `define: { 'import.meta.env.ALLOW_NSEC': 'false' }` für Production
- Oder: Vollständig entfernen via Tree-Shaking

### RULE 3: Session Expiration

```typescript
// Bei Login
const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;  // 7 Tage

// Bei Restore
if (Date.now() > session.expires) {
    this.logout();  // ← Auto-Logout
}
```

**REGEL 12:** Abgelaufene Sessions MÜSSEN automatisch gelöscht werden.

### RULE 4: Profile Pictures validieren

```typescript
// ✅ RICHTIG: URL-Validierung
function sanitizeImageUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return '';  // ← Nur HTTPS!
        return url;
    } catch {
        return '';  // ← Fehlerhafte URL = keine Anzeige
    }
}
```

**REGEL 13:** User-Input (Profile URLs) MUSS validiert werden!

---

## Integration

### Initialisierung in +layout.svelte

```typescript
import NDK from '@nostr-dev-kit/ndk';
import { initializeAuth } from '$lib/stores/authStore.svelte';
import { settingsStore } from '$lib/stores/settingsStore.svelte';

// 1. Config laden (BEVOR AuthStore!)
await settingsStore.loadAndCacheConfig();

// 2. NDK initialisieren
const ndk = new NDK({
    explicitRelayUrls: settingsStore.settings.relaysPublic
});
await ndk.connect();

// 3. AuthStore initialisieren
const authStore = initializeAuth(ndk);

// 4. Session wird automatisch wiederhergestellt
// (via restoreSessionOrCreateDemo im Constructor)
```

**REGEL 14:** Reihenfolge ist **kritisch**: Config → NDK → AuthStore!

### Verwendung in Komponenten

```svelte
<script lang="ts">
    import { authStore } from '$lib/stores/authStore.svelte.ts';
    
    let user = $derived(authStore.currentUser);
    let isLoggedIn = $derived(authStore.isAuthenticated);
    let userName = $derived(authStore.getUserName() || 'Gast');
    
    async function handleLogin() {
        try {
            await authStore.loginWithNip07();
        } catch (error) {
            console.error('Login failed:', error);
        }
    }
</script>

{#if isLoggedIn}
    <div>Eingeloggt als: {userName}</div>
    <button onclick={() => authStore.logout()}>Logout</button>
{:else}
    <button onclick={handleLogin}>Login mit Nostr</button>
{/if}
```

### Autorisierungs-Checks in BoardStore

```typescript
// In BoardStore
import { authStore } from './authStore.svelte';

public addCard(columnId: string, props: CardProps) {
    const signerPubkey = authStore.getPubkey();
    if (!this.board.canAddCard(signerPubkey ?? undefined)) {
        throw new Error('❌ Keine Berechtigung');
    }
    // ... Karte hinzufügen
}
```

**REGEL 15:** ALLE Write-Operationen MÜSSEN `authStore.getPubkey()` für Autorisierung nutzen!

---

## 🔗 Verwandte Dokumentationen

- **[AUTH-UI-COMPONENTS.md](../AUTH-UI-COMPONENTS.md)** — UI-Komponenten (LoginSheet, UserHeader, ProfileEditor)
- **[REACTIVITY.md](../REACTIVITY.md)** — Svelte 5 Runes Pattern
- **[NDK.md](../NDK.md)** — NDK Integration Details
- **[UX-RULES.md](../UX-RULES.md)** — shadcn-svelte Guidelines

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | NIP-07 ist einzige Production-Login-Methode | 🔴 CRITICAL |
| **REGEL 2** | nsec-Login NIEMALS in Production | 🔴 CRITICAL |
| **REGEL 4** | Sessions ohne Private Keys speichern | 🔴 CRITICAL |
| **REGEL 12** | Auto-Logout bei Expiration | 🟠 HIGH |
| **REGEL 13** | User-Input validieren (Profile URLs) | 🟠 HIGH |
| **REGEL 14** | Initialisierung: Config → NDK → AuthStore | 🔴 CRITICAL |

**Ohne diese Regeln: Account-Diebstahl & Security-Breaches! ⚠️**
