<script lang="ts">
	interface Props {
		value: 'draft' | 'published' | 'archived';
		onToggle: () => void;
	}

	let { value = 'draft', onToggle }: Props = $props();

	const states: Array<'draft' | 'published' | 'archived'> = ['draft', 'published', 'archived'];
	const labels = {
		draft: 'Entwurf',
		published: 'Veröffentlicht',
		archived: 'Archiviert'
	};
</script>

<button
	class="publish-toggle"
	class:draft={value === 'draft'}
	class:published={value === 'published'}
	class:archived={value === 'archived'}
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		onToggle();
	}}
	aria-label="Toggle publish state"
	title={labels[value]}
	type="button"
>
	<span class="publish-indicator"></span>
</button>

<style>
	.publish-toggle {
		position: relative;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.375rem;
		padding: 0.25rem;
		border: 1px solid var(--border);
		background: var(--background);
		color: var(--foreground);
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.publish-toggle:hover {
		background-color: var(--accent);
		border-color: var(--ring);
		box-shadow: 0 0 0 2px var(--ring);
	}

	.publish-toggle.draft .publish-indicator {
		width: 0.5rem;
		height: 0.5rem;
		background-color: var(--muted-foreground);
		border-radius: 50%;
	}

	.publish-toggle.published .publish-indicator {
		width: 0.5rem;
		height: 0.5rem;
		background-color: #10b981; /* green */
		border-radius: 50%;
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.publish-toggle.archived .publish-indicator {
		width: 0.5rem;
		height: 0.5rem;
		background-color: #ef4444; /* red */
		border-radius: 50%;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.publish-toggle:focus {
		outline: 2px solid transparent;
		outline-offset: 2px;
		box-shadow: 0 0 0 3px var(--ring) / 0.3;
	}
</style>
