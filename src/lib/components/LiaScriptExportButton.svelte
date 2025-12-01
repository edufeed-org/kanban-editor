<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import LiaScriptExportDialog from './LiaScriptExportDialog.svelte';

	let dialogOpen = $state(false);
</script>

<Button
	variant="ghost"
	size="sm"
	onclick={() => (dialogOpen = true)}
	title="Board als LiaScript exportieren"
>
	<FileTextIcon class="mr-2 h-4 w-4" />
	<span class="hidden sm:inline">LiaScript</span>
</Button>

<LiaScriptExportDialog bind:open={dialogOpen} />
