import { persisted } from "svelte-persisted-store";
import { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKUser } from "@nostr-dev-kit/ndk";

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
  signerType: "nip07" | "nsec" | "nip46";
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
  
  constructor(private ndk: NDK) {
    this.restoreSession();
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

  /**
   * Logout
   */
  public async logout(): Promise<void> {
    this.currentUser = null;
    this.ndk.signer = undefined;

    this.sessionStore.set(null);

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
   * Restore Session
   */
  private async restoreSession(): Promise<void> {
    try {
      const session = this.getStoredSession();

      if (!session || Object.keys(session).length === 0) return;

      if (Date.now() > session.expires) {
        console.log("⏰ Session expired");
        this.sessionStore.set(null);
        return;
      }

      const user = await this.ndk.fetchUser(session.pubkey);
      
      if (!user) return;

      user.profile = session.profile;

      this.currentUser = user;

      console.log(
        `🔄 Session restored for ${session.profile.name || "Anonymous"}`
      );

      // Try to restore signer (only for NIP-07)
      if (session.signerType === "nip07" && window.nostr) {
        const signer = new NDKNip07Signer();
        this.ndk.signer = signer;
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
      this.sessionStore.set(null);
    }
  }

  /**
   * Get stored session
   */
  private getStoredSession(): UserSession | null {
    // Use get() from svelte-persisted-store
    const stored = this.sessionStore;
    return stored ? JSON.parse(JSON.stringify(stored)) : null;
  }

  /**
   * Update Profile (Kind 0)
   */
  public async updateProfile(profileData: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  }): Promise<void> {
    if (!this.currentUser || !this.ndk.signer) {
      throw new Error("User not authenticated");
    }

    try {
      if (!this.currentUser.profile) {
        this.currentUser.profile = {};
      }

      Object.assign(this.currentUser.profile, profileData);

      await this.currentUser.publish();

      const session = this.getStoredSession();
      if (session) {
        session.profile = { ...session.profile, ...profileData };
        this.sessionStore.set(session);
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
   */
  public getUserName(): string | null {
    return this.currentUser?.profile?.name ?? null;
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

export let authStore: AuthStore;

// Initialize function (call from +layout.svelte)
export function initializeAuth(ndk: NDK): AuthStore {
  authStore = new AuthStore(ndk);
  return authStore;
}
