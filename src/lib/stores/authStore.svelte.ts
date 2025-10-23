/**
 * BASICS AuthStore für Development
 * 
 * 🎯 Zweck: Einfache Dummy-User-Verwaltung für lokale Tests
 * Später wird dies durch echte NIP-07 / NIP-46 Authentifizierung ersetzt
 * 
 * Features:
 * - Mock nsec/npub User
 * - Session-Persistierung in localStorage
 * - Reactive $state für Svelte 5
 * - Ready für echte NDK-Integration
 */

export type SignerType = 'development' | 'nip07' | 'nip46';

export interface UserSession {
  pubkey: string; // Hex Public Key
  npub: string; // Bech32 encoded npub (für UI)
  name: string; // Display Name
  signerType: SignerType;
  createdAt: number;
}

/**
 * BASICS Auth Store - nur für Entwicklung!
 * 
 * ⚠️ WICHTIG: Diese Dummy-Implementierung wird später ersetzt durch:
 * - NIP-07 Browser Extensions (Alby, nos2x)
 * - NIP-46 Remote Signers
 * - Proper session management
 */
export class AuthStore {
  private static readonly STORAGE_KEY = 'kanban-auth-session';
  private static readonly DEFAULT_DUMMY_PUBKEY = '0000000000000000000000000000000000000000000000000000000000000001';
  private static readonly DEFAULT_DUMMY_NPUB = 'npub1dev00000000000000000000000000000000000000000000000000000000';

  // Reaktiver State (Svelte 5 Runes)
  public currentUser = $state<UserSession | null>(null);
  public isAuthenticated = $derived(!!this.currentUser);
  public isLoading = $state(false);
  public errorMessage = $state<string | null>(null);

  constructor() {
    // Restore session from localStorage on init
    this.restoreSession();
  }

  /**
   * 🔐 Login mit Dummy-User (Development)
   * 
   * Später wird dies durch NIP-07 ersetzt:
   * const signer = new NDKNip07Signer();
   * const user = await signer.user();
   */
  public async loginWithDummy(name: string = 'Dev User'): Promise<boolean> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      const session: UserSession = {
        pubkey: AuthStore.DEFAULT_DUMMY_PUBKEY,
        npub: AuthStore.DEFAULT_DUMMY_NPUB,
        name,
        signerType: 'development',
        createdAt: Date.now()
      };

      this.currentUser = session;
      this.saveSession();

      console.log('✅ Dummy user logged in:', { name, pubkey: session.pubkey.slice(0, 8) + '...' });
      return true;
    } catch (error) {
      this.errorMessage = `Login failed: ${error}`;
      console.error('❌ Login error:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔐 Login mit Custom nsec (Development only!)
   * 
   * ⚠️ SECURITY: Nur für Development! In Production NIEMALS Private Keys akzeptieren!
   */
  public async loginWithNsec(nsec: string, name: string = 'nsec User'): Promise<boolean> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      // Validiere nsec format (starts with 'nsec1')
      if (!nsec.startsWith('nsec1')) {
        throw new Error('Invalid nsec format. Must start with "nsec1"');
      }

      // TODO: Decode nsec zu pubkey (Später mit @nostr-dev-kit/ndk)
      // const decoded = nip19.decode(nsec);
      // const pubkey = decoded.data;

      const session: UserSession = {
        pubkey: 'nsec-derived-pubkey', // Placeholder
        npub: 'npub-derived-from-nsec', // Placeholder
        name,
        signerType: 'development',
        createdAt: Date.now()
      };

      this.currentUser = session;
      this.saveSession();

      console.log('✅ nsec user logged in:', { name, nsec: nsec.slice(0, 15) + '...' });
      return true;
    } catch (error) {
      this.errorMessage = `nsec login failed: ${error}`;
      console.error('❌ nsec login error:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔐 Login mit NIP-07 (Browser Extension)
   * 
   * ✅ PRODUCTION: Dies ist die empfohlene Methode!
   * Benötigt: Alby, nos2x oder andere NIP-07 Extensionen
   */
  public async loginWithNIP07(): Promise<boolean> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      // TODO: Integration mit NDKNip07Signer
      // const signer = new NDKNip07Signer();
      // const user = await signer.user();
      // const pubkey = user.pubkey;

      throw new Error('NIP-07 not yet implemented. Use loginWithDummy() for now.');
    } catch (error) {
      this.errorMessage = `NIP-07 login failed: ${error}`;
      console.error('❌ NIP-07 login error:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🚪 Logout - Clear session and currentUser
   * ⚠️ WICHTIG: Nur im Browser, nicht auf SSR Server!
   */
  public logout(): void {
    this.currentUser = null;
    this.errorMessage = null;
    
    // Nur im Browser localStorage clearen
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AuthStore.STORAGE_KEY);
    }
    
    console.log('✅ User logged out');
  }

  /**
   * 💾 Save session to localStorage
   * ⚠️ WICHTIG: Nur im Browser, nicht auf SSR Server!
   */
  private saveSession(): void {
    // Checke ob wir im Browser sind
    if (typeof window === 'undefined') {
      console.debug('⏭️ Skipping saveSession on SSR server');
      return;
    }

    if (this.currentUser) {
      localStorage.setItem(AuthStore.STORAGE_KEY, JSON.stringify(this.currentUser));
    }
  }

  /**
   * 📂 Restore session from localStorage on app startup
   * ⚠️ WICHTIG: Nur im Browser, nicht auf SSR Server!
   */
  private restoreSession(): void {
    // Checke ob wir im Browser sind (typeof window !== 'undefined')
    if (typeof window === 'undefined') {
      console.debug('⏭️ Skipping restoreSession on SSR server');
      return;
    }

    try {
      const stored = localStorage.getItem(AuthStore.STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as UserSession;
        this.currentUser = session;
        console.log('✅ Session restored:', { name: session.name, pubkey: session.pubkey.slice(0, 8) + '...' });
      }
    } catch (error) {
      console.error('❌ Failed to restore session:', error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AuthStore.STORAGE_KEY);
      }
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
   */
  public getUserName(): string | null {
    return this.currentUser?.name ?? null;
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
}

/**
 * ============================================================================
 * GLOBAL SINGLETON INSTANCE
 * ============================================================================
 * 
 * Verwendung in Komponenten:
 * 
 * import { authStore } from '$lib/stores/authStore.svelte';
 * 
 * // In Komponente:
 * let { isAuthenticated, currentUser } = $derived({
 *   isAuthenticated: authStore.isAuthenticated,
 *   currentUser: authStore.currentUser
 * });
 * 
 * // Login:
 * await authStore.loginWithDummy('Mein Name');
 * 
 * // Logout:
 * authStore.logout();
 */
export const authStore = new AuthStore();
