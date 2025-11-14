import { persisted } from "svelte-persisted-store";
import { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKUser } from "@nostr-dev-kit/ndk";
import { get } from 'svelte/store'
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { settingsStore } from "./settingsStore.svelte.js";
import { getSyncManager } from "./syncManager.svelte.js";

export interface UserSession {
  pubkey: string;
  npub: string;
  profile: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  };
  signerType: "nip07" | "nsec" | "nip46" | "demo";
  lastLogin: number;
  expires: number;
}

export class AuthStore {
  private sessionStore = persisted<UserSession | null>(
    "nostr-user-session",
    null
  );

  public currentUser = $state<NDKUser | null>(null);
  public isAuthenticated = $derived(!!this.currentUser);
  public isLoading = $state(false);
  public errorMessage = $state<string | null>(null);
  
  // 🚀 NEW: User Profile Cache (pubkey → profile.name)
  private userProfileCache = $state<Map<string, string | null>>(new Map());
  
  constructor(private ndk: NDK) {
    // ℹ️ restoreSessionOrCreateDemo ist jetzt async
    // Wird von +layout.svelte aufgerufen als await initializeAuth().restoreSession()
  }

  /**
   * 🔄 Stelle Session wieder her oder erstelle Demo-Session
   * MUSS von +layout.svelte nach initializeAuth() aufgerufen werden!
   * 
   * @example
   * const authStore = initializeAuth(ndk);
   * await authStore.restoreSession();  // ← WICHTIG!
   */
  public async restoreSession(): Promise<void> {
    return this.restoreSessionOrCreateDemo();
  }

  /**
   * NIP-07 Browser Extension Login
   */
  public async loginWithNip07(): Promise<NDKUser> {
    try {
      this.isLoading = true;

      if (!window.nostr) {
        throw new Error("Nostr extension not found. Install Alby or nos2x.");
      }

      const signer = new NDKNip07Signer();
      this.ndk.signer = signer;

      const user = await signer.user();

      await user.fetchProfile();

      this.currentUser = user;

      await this.saveSession(user, "nip07");
      
      // 🔄 Update SyncManager with new signer
      try {
        getSyncManager().updateSigner(signer);
        console.log('✅ SyncManager signer updated after NIP-07 login');
      } catch (error) {
        console.warn('⚠️ SyncManager signer update warning:', error);
      }

      // 🔗 Nach erfolgreichem Login: Boards aus Nostr laden & Live-Subscription starten
      try {
        const { boardStore } = await import('./kanbanStore.svelte.js');
        // Board-Author ggf. aktualisieren
        boardStore.updateBoardAuthor?.();
        await boardStore.loadBoardsFromNostrForCurrentUser?.();
        boardStore.subscribeToBoardUpdatesForCurrentUser?.();
        console.log('[AuthStore] ✅ Boards synced from Nostr after NIP-07 login');
      } catch (error) {
        console.warn('[AuthStore] ⚠️ Failed to sync boards from Nostr after NIP-07 login:', error);
      }

      return user;
    } catch (error) {
      console.error("NIP-07 login failed:", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Private Key (nsec) Login - DEVELOPMENT ONLY!
   */
  public async loginWithNsec(nsec: string): Promise<NDKUser> {
    try {
      // TODO: Check if in development environment and throw error if not

      this.isLoading = true;

      if (!nsec.startsWith("nsec1") || nsec.length !== 63) {
        throw new Error("Invalid nsec format");
      }

      const signer = new NDKPrivateKeySigner(nsec);
      this.ndk.signer = signer;

      const user = await signer.user();
      await user.fetchProfile();

      this.currentUser = user;

      await this.saveSession(user, "nsec");
      
      // � WICHTIG: nsec temporär in sessionStorage speichern (für Reload-Recovery)
      // ⚠️ ACHTUNG: sessionStorage wird bei Tab-Schließung geleert (=sicher für Development)
      sessionStorage.setItem("nostr-nsec-temp", nsec);
      console.log("💾 nsec temporarily stored in sessionStorage (cleared on tab close)");
      
      // �🔄 Update SyncManager with new signer
      try {
        getSyncManager().updateSigner(signer);
        console.log('✅ SyncManager signer updated after nsec login');
      } catch (error) {
        console.warn('⚠️ SyncManager signer update warning:', error);
      }

      return user;
    } catch (error) {
      console.error("nsec login failed:", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * NIP-46 Remote Signing - FUTURE
   */
  public async loginWithNip46(connectionString: string): Promise<NDKUser> {
    // TODO: Implement NIP-46
    throw new Error("NIP-46 not yet implemented");
  }

  public async loginWithOidc(oidcUser: User): Promise<NDKUser> {
    try {
      this.isLoading = true;

      const nsec = (oidcUser.profile as { nsec?: string }).nsec;

      if (!nsec ||
        !nsec.startsWith("nsec1") || 
        nsec.length !== 63) {
        throw new Error("Invalid nsec format");
      }

      const signer = new NDKPrivateKeySigner(nsec);
      this.ndk.signer = signer;

      const user = await signer.user();
      await user.fetchProfile();

      this.currentUser = user;

      await this.saveSession(user, "nsec");
      
      // 🔄 Update SyncManager with new signer
      try {
        getSyncManager().updateSigner(signer);
        console.log('✅ SyncManager signer updated after OIDC login');
      } catch (error) {
        console.warn('⚠️ SyncManager signer update warning:', error);
      }

      // 🔗 Nach OIDC-Login: Boards aus Nostr laden & Live-Subscription starten
      try {
        const { boardStore } = await import('./kanbanStore.svelte.js');
        boardStore.updateBoardAuthor?.();
        await boardStore.loadBoardsFromNostrForCurrentUser?.();
        boardStore.subscribeToBoardUpdatesForCurrentUser?.();
        console.log('[AuthStore] ✅ Boards synced from Nostr after OIDC login');
      } catch (error) {
        console.warn('[AuthStore] ⚠️ Failed to sync boards from Nostr after OIDC login:', error);
      }

      return user;
    } catch (error) {
      console.error("oidc login failed:", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Logout
   */
  public async logout(): Promise<void> {
    this.currentUser = null;
    this.ndk.signer = undefined;

    this.sessionStore.set(null);
    
    // � Clear nsec from sessionStorage on logout (security)
    sessionStorage.removeItem("nostr-nsec-temp");
    
    // �🔄 Clear SyncManager signer on logout
    try {
      getSyncManager().updateSigner(undefined);
      console.log('✅ SyncManager signer cleared after logout');
    } catch (error) {
      console.warn('⚠️ SyncManager signer clear warning:', error);
    }

    console.log("🚪 User logged out");
  }

  /**
   * Save Session (ohne Private Keys!)
   */
  private async saveSession(
    user: NDKUser,
    signerType: "nip07" | "nsec" | "nip46"
  ): Promise<void> {
    const session: UserSession = {
      pubkey: user.pubkey,
      npub: user.npub,
      profile: {
        name: user.profile?.name,
        about: user.profile?.about,
        picture: user.profile?.picture || user.profile?.image,
        nip05: user.profile?.nip05,
        lud16: user.profile?.lud16,
      },
      signerType,
      lastLogin: Date.now(),
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 Tage
    };

    this.sessionStore.set(session);
    console.log(`💾 Session saved for ${user.profile?.name || "Anonymous"}`);
  }

  /**
   * Restore Session or stay logged out
   * 🎯 NEUES VERHALTEN:
   * - Existierende Session? → Restore + Signer rekonstruieren
   * - Keine Session? → Bleibe ausgeloggt (User kann explizit Demo starten)
   * - Demo nur wenn config.allow_demo_session.enabled = true
   */
  private async restoreSessionOrCreateDemo(): Promise<void> {
    try {
      const stored = this.getStoredSession();

      // Fall 1: Session vorhanden
      if (stored && Object.keys(stored).length > 0) {
        if (Date.now() > stored.expires) {
          console.log("⏰ Session expired");
          this.sessionStore.set(null);
          this.currentUser = null;
          return;
        }

        // 🔑 KRITISCH: Signer rekonstruieren basierend auf signerType
        let signer: any = null;
        
        if (stored.signerType === "nip07") {
          console.log("🔄 Rekonstruiere NIP-07 Signer nach Page Reload...");
          try {
            signer = new NDKNip07Signer();
            this.ndk.signer = signer;
            
            // Verify signer is accessible
            const signerUser = await signer.user();
            if (signerUser.pubkey !== stored.pubkey) {
              throw new Error("NIP-07 pubkey mismatch - extension changed?");
            }
            console.log("✅ NIP-07 Signer successfully reconnected!");
            
            // 🔄 Update SyncManager
            try {
              getSyncManager().updateSigner(signer);
              console.log('✅ SyncManager signer updated after NIP-07 restore');
            } catch (e) {
              console.warn('⚠️ SyncManager update on restore:', e);
            }

            // ℹ️ Note: BoardStore will load boards from Nostr when initializeNostr() is called
            // Don't do it here - avoid duplicate loading and race conditions

          } catch (error) {
            console.warn("⚠️ NIP-07 Signer rekonstruktion fehlgeschlagen:", error);
            // Fall back to demo if NIP-07 fails
            signer = null;
          }
        } else if (stored.signerType === "nsec") {
          // 🔑 nsec-Restore: Nur wenn es noch im sessionStorage ist (Development only)
          console.log("🔄 Versuch nsec-Signer nach Page Reload zu rekonstruieren...");
          const savedNsec = sessionStorage.getItem("nostr-nsec-temp");
          if (savedNsec) {
            try {
              signer = new NDKPrivateKeySigner(savedNsec);
              this.ndk.signer = signer;
              
              const signerUser = await signer.user();
              if (signerUser.pubkey !== stored.pubkey) {
                throw new Error("nsec pubkey mismatch");
              }
              console.log("✅ nsec Signer successfully reconnected!");
              
              // 🔄 Update SyncManager
              try {
                getSyncManager().updateSigner(signer);
                console.log('✅ SyncManager signer updated after nsec restore');
              } catch (e) {
                console.warn('⚠️ SyncManager update on restore:', e);
              }

              // ℹ️ Note: BoardStore will load boards from Nostr when initializeNostr() is called
              // Don't do it here - avoid duplicate loading and race conditions

            } catch (error) {
              console.warn("⚠️ nsec Signer rekonstruktion fehlgeschlagen:", error);
              signer = null;
            }
          } else {
            console.log("⚠️ nsec not found in sessionStorage - user needs to login again");
          }
        }

        // Für Demo-Sessions: Nicht neu laden, einfach direkt set
        if (stored.signerType === "demo") {
          this.currentUser = {
            pubkey: stored.pubkey,
            npub: stored.npub,
            profile: stored.profile
          } as any;
          console.log(`✅ Demo-Session wiederhergestellt: ${stored.profile.name}`);
          return;
        }

        // Für echte Nostr-Sessions: Versuch zu fetchen
        const user = await this.ndk.fetchUser(stored.pubkey);
        
        if (!user) {
          console.log("⚠️  Failed to fetch user from NDK - staying logged out");
          this.sessionStore.set(null);
          this.currentUser = null;
          return;
        }

        user.profile = stored.profile;
        this.currentUser = user;

        console.log(
          `🔄 Session restored for ${stored.profile.name || "Anonymous"}`
        );

        // ✅ Signer wurde bereits oben rekonstruiert!
        return;
      }

      // Fall 2: Keine Session vorhanden → User bleibt ausgeloggt
      console.log("👤 Keine Session gefunden → User ist ausgeloggt");
      this.currentUser = null;

    } catch (error) {
      console.error("Failed to restore session:", error);
      this.sessionStore.set(null);
      this.currentUser = null; // Ausgeloggt bei Error
    }
  }

  /**
   * PUBLIC: Erstelle Demo-Session für Anonymous User
   * 🎯 Wird vom User explizit ausgelöst (Button in Sidebar)
   * Gibt dem User eine lokale Identity (demo-xxxx)
   * 
   * @throws Error wenn config.allow_demo_session.enabled = false
   */
  public createDemoSession(): void {
    // 🔐 CHECK: Ist Demo in Config aktiviert?
    const isDemoAllowed = this.isDemoSessionAllowed();
    if (!isDemoAllowed) {
      throw new Error("Demo sessions are disabled in configuration");
    }

    const demoId = `demo-${Math.random().toString(36).slice(2, 10)}`;
    const demoSession: UserSession = {
      pubkey: demoId,
      npub: `npub_demo_${demoId.slice(5)}`,
      profile: {
        name: "Demo User",
        about: "Local demo session"
      },
      signerType: "demo",
      lastLogin: Date.now(),
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 Tage Demo
    };

    this.sessionStore.set(demoSession);
    
    // Erstelle einfaches User-Mock für Demo (kompatibel mit NDKUser API)
    this.currentUser = {
      pubkey: demoId,
      npub: demoSession.npub,
      profile: demoSession.profile
    } as any;

    console.log(`✅ Demo-Session erstellt: ${demoId}`);
    console.log(`   User kann lokal Boards anlegen und bearbeiten`);
    console.log(`   Nach Login → echte Nostr-Session mit gleicher Validierung`);
  }

  /**
   * Check ob Demo-Sessions in der Config aktiviert sind
   * Liest aus config.json: allow_demo_session.enabled
   * 
   * IMPORTANT: Diese Funktion macht einen synchronen Check auf localStorage.
   * Bei erstem Call wird Config möglicherweise noch nicht geladen sein.
   * Bei Button-Click ist sie aber garantiert geladen.
   */
  public isDemoSessionAllowed(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      // Versuche aus gecachter Config zu lesen (von SettingsStore)
      // localStorage Schlüssel: 'kanban-config'
      const cachedConfig = localStorage.getItem('kanban-config');
      if (cachedConfig) {
        try {
          const config = JSON.parse(cachedConfig);
          const demoAllowed = config?.allow_demo_session?.enabled;
          
          if (typeof demoAllowed === 'boolean') {
            console.log(`ℹ️  Demo sessions: ${demoAllowed ? 'enabled ✅' : 'disabled ❌'}`);
            return demoAllowed;
          }
        } catch (parseErr) {
          console.error("Failed to parse cached config:", parseErr);
        }
      }

      // Fallback: Wenn keine Config vorhanden: Default auf false (sicherer)
      // DEBUG: Zeige dass wir nachschlagen müssen
      console.log('ℹ️  Demo sessions: config not yet in localStorage (being loaded async)');
      return false;
    } catch (error) {
      console.error("Error checking demo session config:", error);
      return false;
    }
  }

  /**
   * Get stored session
   */
  private getStoredSession(): UserSession | null {
    const stored = get(this.sessionStore);
    return stored ? JSON.parse(JSON.stringify(stored)) : null;
  }

  /**
   * Update Profile (Kind 0)
   * 🎯 Für Demo-User: Lokal updaten, für Nostr-User: auf Relay publizieren
   */
  public async updateProfile(profileData: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  }): Promise<void> {
    if (!this.currentUser) {
      throw new Error("No user session");
    }

    try {
      if (!this.currentUser.profile) {
        this.currentUser.profile = {};
      }

      Object.assign(this.currentUser.profile, profileData);

      // Nur für echte Nostr-User publizieren (nicht für Demo)
      const session = this.getStoredSession();
      if (session?.signerType !== "demo" && this.ndk.signer) {
        await this.currentUser.publish();
      }

      const session2 = this.getStoredSession();
      if (session2) {
        session2.profile = { ...session2.profile, ...profileData };
        this.sessionStore.set(session2);
      }

      console.log("✅ Profile updated");
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  }

  /**
   * Verify NIP-05
   */
  public async verifyNip05(identifier: string): Promise<boolean> {
    if (!this.currentUser) return false;

    try {
      const [user, domain] = identifier.split("@");

      const response = await fetch(
        `https://${domain}/.well-known/nostr.json?name=${user}`
      );

      if (!response.ok) return false;

      const data = await response.json();

      return data.names[user] === this.currentUser.pubkey;
    } catch {
      return false;
    }
  }

  /**
   * 🔑 Get current user's public key (Hex format)
   */
  public getPubkey(): string | null {
    return this.currentUser?.pubkey ?? null;
  }

  /**
   * 🔑 Get current user's npub (Bech32 format)
   */
  public getNpub(): string | null {
    return this.currentUser?.npub ?? null;
  }

  /**
   * 👤 Get current user's display name
   * Returns the profile name if available, otherwise null
   */
  public getUserName(): string | null {
    return this.currentUser?.profile?.name ?? null;
  }

  /**
   * 👤 Get display name with fallback
   * Returns: profile.name OR "Nostr Nutzer" (never null)
   * Use this for UI display where you always want to show something
   */
  public getDisplayName(): string {
    return this.currentUser?.profile?.name || 'Nostr Nutzer';
  }

  /**
   * � Get Author Attribution (DUAL-FIELD STRATEGY)
   * 
   * Returns BOTH pubkey AND display name for storing in Board/Card/Comment
   * 
   * USE CASES:
   * - Creating new boards: `new Board({ author, authorName, ... })`
   * - Creating new cards: `new Card({ author, authorName, ... })`
   * - Adding comments: `new Comment({ author, authorName, ... })`
   * 
   * RETURN VALUE:
   * {
   *   pubkey: "0a1b2c3d4e5f..." (hex format, REQUIRED for Nostr identity)
   *   displayName: "Alice" | null (UI-friendly name, OPTIONAL)
   * }
   * 
   * BEHAVIOR:
   * - pubkey: ALWAYS present (or null if no session)
   * - displayName: profile.name if available, otherwise null
   * - This enables UI to show readable names while maintaining Nostr identity
   * 
   * STORAGE:
   * - author: string → pubkey (hex) - REQUIRED for Nostr protocol
   * - authorName?: string → displayName - OPTIONAL for UI display
   * 
   * @returns { pubkey: string | null, displayName: string | null }
   * 
   * @example
   * // In BoardStore.createBoard()
   * const { pubkey, displayName } = authStore.getAuthorAttribution();
   * const board = new Board({
   *   name: 'My Board',
   *   author: pubkey || 'anonymous',
   *   authorName: displayName  // ← kann null sein
   * });
   * 
   * @example
   * // In BoardStore.addComment()
   * const { pubkey, displayName } = authStore.getAuthorAttribution();
   * const comment = new Comment({
   *   text: '...',
   *   author: pubkey || 'anonymous',
   *   authorName: displayName
   * });
   * 
   * @example
   * // In UI (Card display)
   * {#if card.authorName}
   *   <p>Von: {card.authorName}</p>
   * {:else}
   *   <p>Von: {authStore.getDisplayNameForPubkey(card.author)}</p>
   * {/if}
   */
  public getAuthorAttribution(): { pubkey: string | null; displayName: string | null } {
    const pubkey = this.getPubkey();
    const displayName = this.getUserName(); // ← Returns null if no name
    
    return { pubkey, displayName };
  }

  /**
   * �🌐 Get display name for ANY pubkey (not just current user)
   * 
   * USE CASES:
   * - Comment authors (show name instead of truncated npub)
   * - Card attendees
   * - Board maintainers
   * - Any Nostr user reference
   * 
   * BEHAVIOR:
   * 1. If current user → return cached name immediately
   * 2. If in cache → return cached name
   * 3. If not cached → fetch from Nostr (async), return truncated npub meanwhile
   * 
   * CACHING:
   * - Profiles are cached in memory (Map<pubkey, name>)
   * - Cache persists during session
   * - Re-fetched on app reload
   * 
   * @param pubkey - Hex pubkey (NOT npub!)
   * @returns Display name or truncated pubkey (e.g. "0a1b2c3d...9e8f")
   * 
   * @example
   * // In component:
   * const authorName = authStore.getDisplayNameForPubkey(comment.author);
   * // Returns: "Alice" (if profile found) or "0a1b2c3d...9e8f" (fallback)
   */
  public getDisplayNameForPubkey(pubkey: string): string {
    if (!pubkey) return 'Anonym';
    
    // 1. Current user? → instant return
    if (this.currentUser?.pubkey === pubkey) {
      return this.getDisplayName();
    }
    
    // 2. In cache? → return cached
    if (this.userProfileCache.has(pubkey)) {
      const cachedName = this.userProfileCache.get(pubkey);
      if (cachedName) return cachedName;
    }
    
    // 3. Not cached → fetch async (non-blocking)
    this.fetchUserProfile(pubkey);
    
    // 4. Meanwhile: return truncated pubkey
    return this.truncatePubkey(pubkey);
  }

  /**
   * 🔍 Fetch user profile from Nostr (async, non-blocking)
   * Caches result in userProfileCache
   * 
   * @private
   */
  private async fetchUserProfile(pubkey: string): Promise<void> {
    try {
      // Prevent duplicate fetches
      if (this.userProfileCache.has(pubkey)) return;
      
      // Mark as "fetching" (null = fetching in progress)
      this.userProfileCache.set(pubkey, null);
      
      // Fetch profile via NDK
      const user = this.ndk.getUser({ pubkey });
      await user.fetchProfile();
      
      // Cache result (name or null if no profile)
      const displayName = user.profile?.name || null;
      this.userProfileCache.set(pubkey, displayName);
      
      console.log(`📇 Cached profile for ${this.truncatePubkey(pubkey)}: ${displayName || 'no name'}`);
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch profile for ${pubkey}:`, error);
      // Keep null in cache to avoid re-fetching
    }
  }

  /**
   * 🔤 Truncate pubkey for display
   * Returns: "0a1b2c3d...9e8f" (first 8 + last 4 chars)
   * 
   * @private
   */
  private truncatePubkey(pubkey: string): string {
    if (pubkey.length < 20) return pubkey; // Short = display full
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  }

  /**
   * 🎨 Get user initials for avatar
   * Returns: Initials from name OR "NN" for "Nostr Nutzer"
   */
  public getUserInitials(): string {
    const name = this.currentUser?.profile?.name;
    if (!name) return 'NN';
    
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * 🎨 Get consistent avatar color based on user's pubkey
   * Returns: Tailwind CSS class for background color
   * 
   * Uses pubkey for consistent color across all avatar instances
   * (profile sidebar, avatar stack, comments, etc.)
   */
  public getAvatarColor(): string {
    const pubkey = this.currentUser?.pubkey;
    if (!pubkey) return 'bg-slate-500';
    
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-cyan-500',
      'bg-orange-500'
    ];
    
    // Hash über gesamten Pubkey für konsistente Verteilung
    const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * 📊 Get current auth status
   */
  public getStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      isLoading: this.isLoading,
      user: this.currentUser,
      error: this.errorMessage
    };
  }

  /**
   * Get session info for debugging
   */
  public getSessionInfo() {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.currentUser?.profile,
      session: this.getStoredSession(),
    };
  }
}

/**
 * ✅ Singleton Pattern mit Init-Guard
 * authStore ist IMMER definiert, wird aber erst bei initializeAuth() vollständig initialisiert
 */
class AuthStoreWrapper {
  private static instance: AuthStore | null = null;
  private static initialized = false;

  static getInstance(): AuthStore {
    if (!this.instance) {
      throw new Error(
        '❌ authStore not initialized! Call initializeAuth(ndk) from +layout.svelte first.'
      );
    }
    return this.instance;
  }

  /**
   * Sichere Getter-Methode für SSR-Context
   * Gibt null zurück statt Error zu werfen
   */
  static getInstanceSafe(): AuthStore | null {
    return this.instance;
  }

  static initialize(ndk: NDK): AuthStore {
    if (!this.instance) {
      this.instance = new AuthStore(ndk);
    }
    this.initialized = true;
    return this.instance;
  }

  static isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Globale authStore Singleton - wird durch Proxy geschützt
 * Falls nicht initialisiert: Werft Error mit klarer Meldung
 */
class AuthStoreProxy {
  get isAuthenticated(): boolean {
    return AuthStoreWrapper.getInstance().isAuthenticated;
  }
  get currentUser() {
    return AuthStoreWrapper.getInstance().currentUser;
  }
  get isLoading() {
    return AuthStoreWrapper.getInstance().isLoading;
  }
  get errorMessage() {
    return AuthStoreWrapper.getInstance().errorMessage;
  }

  // Delegiere alle Methoden
  loginWithNip07() {
    return AuthStoreWrapper.getInstance().loginWithNip07();
  }
  loginWithNsec(nsec: string) {
    return AuthStoreWrapper.getInstance().loginWithNsec(nsec);
  }
  loginWithNip46(relayUrl: string) {
    return AuthStoreWrapper.getInstance().loginWithNip46(relayUrl);
  }
  loginWithOidc(oidcUser: User) {
    return AuthStoreWrapper.getInstance().loginWithOidc(oidcUser);
  }
  logout() {
    return AuthStoreWrapper.getInstance().logout();
  }
  createDemoSession() {
    return AuthStoreWrapper.getInstance().createDemoSession();
  }
  isDemoSessionAllowed() {
    return AuthStoreWrapper.getInstance().isDemoSessionAllowed();
  }
  getPubkey() {
    return AuthStoreWrapper.getInstance().getPubkey();
  }
  getNpub() {
    return AuthStoreWrapper.getInstance().getNpub();
  }
  getUserName() {
    return AuthStoreWrapper.getInstance().getUserName();
  }
  getDisplayName() {
    return AuthStoreWrapper.getInstance().getDisplayName();
  }
  getDisplayNameForPubkey(pubkey: string) {
    return AuthStoreWrapper.getInstance().getDisplayNameForPubkey(pubkey);
  }
  getUserInitials() {
    return AuthStoreWrapper.getInstance().getUserInitials();
  }
  getAvatarColor() {
    return AuthStoreWrapper.getInstance().getAvatarColor();
  }
  
  /**
   * ✅ NEW (Phase 1): Dual-Field Author Attribution
   * Returns both pubkey and displayName for entity creation
   * 
   * @returns Object with pubkey (hex) and displayName (string | null)
   * @example
   * ```typescript
   * const { pubkey, displayName } = authStore.getAuthorAttribution();
   * const board = new Board({
   *   author: pubkey || 'anonymous',
   *   authorName: displayName
   * });
   * ```
   */
  getAuthorAttribution() {
    return AuthStoreWrapper.getInstance().getAuthorAttribution();
  }
  
  /**
   * Sichere Getter für SSR-Context (gibt null statt Error)
   */
  getPubkeySafe(): string | null {
    const instance = AuthStoreWrapper.getInstanceSafe();
    return instance ? instance.getPubkey() : null;
  }
  
  getUserNameSafe(): string | null {
    const instance = AuthStoreWrapper.getInstanceSafe();
    return instance ? instance.getUserName() : null;
  }
  
  getDisplayNameSafe(): string {
    const instance = AuthStoreWrapper.getInstanceSafe();
    return instance ? instance.getDisplayName() : 'Nostr Nutzer';
  }
  
  getDisplayNameForPubkeySafe(pubkey: string): string {
    const instance = AuthStoreWrapper.getInstanceSafe();
    return instance ? instance.getDisplayNameForPubkey(pubkey) : 'Anonym';
  }
  
  getUserInitialsSafe(): string {
    const instance = AuthStoreWrapper.getInstanceSafe();
    return instance ? instance.getUserInitials() : 'NN';
  }
  
  getAvatarColorSafe(): string {
    const instance = AuthStoreWrapper.getInstanceSafe();
    return instance ? instance.getAvatarColor() : 'bg-slate-500';
  }
  updateProfile(profile: Partial<UserSession['profile']>) {
    return AuthStoreWrapper.getInstance().updateProfile(profile);
  }
  verifyNip05(nip05: string) {
    return AuthStoreWrapper.getInstance().verifyNip05(nip05);
  }
  getStatus() {
    return AuthStoreWrapper.getInstance().getStatus();
  }
  getSessionInfo() {
    return AuthStoreWrapper.getInstance().getSessionInfo();
  }
}

// ✅ Exportiere Proxy - nicht die echte Instanz
export const authStore = new AuthStoreProxy();

/**
 * Initialize function (MUSS aus +layout.svelte aufgerufen werden!)
 * 
 * @example
 * // In src/routes/+layout.svelte:
 * import { initializeAuth } from '$lib/stores/authStore.svelte.ts';
 * 
 * initializeAuth(ndk);  // ✅ Muss VOR Komponenten-Render aufgerufen werden!
 */
export function initializeAuth(ndk: NDK): AuthStore {
  return AuthStoreWrapper.initialize(ndk);
}

export async function initializeOidcUserManager(currentUrl: string): Promise<UserManager> {
  const envConfig = await settingsStore.getConfig()

  return new UserManager({
    authority: envConfig.oidc.authority || 'http://localhost:8080/realms/master',
    client_id: envConfig.oidc.client_id || 'kanban-board',
    redirect_uri: currentUrl,
    post_logout_redirect_uri: currentUrl,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: localStorage }),
  });
}
