<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { Avatar } from "@nostr-dev-kit/svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { authStore } from '$lib/stores/authStore.svelte';
  import UserIcon from "@lucide/svelte/icons/user";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  
  interface Props {
    onOpenProfile?: () => void;
    onOpenSettings?: () => void;
  }
  
  const { onOpenProfile, onOpenSettings }: Props = $props();
  
  const user = $derived(authStore.currentUser);
  const isAuthenticated = $derived(authStore.isAuthenticated);
  
  async function handleLogout() {
    await authStore.logout();
  }
  
  function getDisplayName(): string {
    if (!user?.profile) return 'Anonymous';
    // FIXME: display_name should not return number
    return user.profile.name || user.profile.display_name || 'Anonymous';
  }
  
  function getNip05(): string | null {
    return user?.profile?.nip05 || null;
  }
  
  function getAvatarUrl(): string {
    return user?.profile?.picture || user?.profile?.image || '';
  }
</script>

{#if isAuthenticated && user}
  <div class="flex items-center gap-3">
    <!-- User Info -->
    <div class="hidden sm:flex sm:items-center sm:gap-3">
      <Avatar 
        pubkey={user?.pubkey}
        size={32}
        class="ring-2 ring-offset-2 ring-purple-500/20"
      />
      
      <div class="hidden md:block">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {getDisplayName()}
        </p>
        {#if getNip05()}
          <div class="flex items-center gap-1">
            <Badge variant="secondary" class="text-xs">
              ✓ {getNip05()}
            </Badge>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Dropdown Menu -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild let:builder>
        <Button variant="ghost" size="sm" builders={[builder]} class="h-8 w-8 p-0 sm:hidden">
          <Avatar
            pubkey={user?.pubkey}
            size={24}
          />
        </Button>
      </DropdownMenu.Trigger>
      
      <DropdownMenu.Content align="end" class="w-56">
        <DropdownMenu.Label class="font-normal">
          <div class="flex flex-col space-y-1">
            <p class="text-sm font-medium leading-none">{getDisplayName()}</p>
            <p class="text-xs leading-none text-muted-foreground">
              {user.npub.slice(0, 16)}...
            </p>
            {#if getNip05()}
              <Badge variant="secondary" class="text-xs w-fit">
                ✓ {getNip05()}
              </Badge>
            {/if}
          </div>
        </DropdownMenu.Label>
        
        <DropdownMenu.Separator />
        
        <DropdownMenu.Item onclick={() => onOpenProfile?.()}>
          <UserIcon class="mr-2 h-4 w-4" />
          Edit Profile
        </DropdownMenu.Item>
        
        <DropdownMenu.Item onclick={() => onOpenSettings?.()}>
          <SettingsIcon class="mr-2 h-4 w-4" />
          Settings
        </DropdownMenu.Item>
        
        <DropdownMenu.Separator />
        
        <DropdownMenu.Item onclick={handleLogout} class="text-red-600 focus:text-red-600">
          <LogOutIcon class="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
{/if}

