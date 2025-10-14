<script lang="ts">
	import type { PublishState } from "./types.js";

	export let title: string;
	export let publishState: PublishState = 'draft';
	export let showMenu: boolean = false;
	export let showPublishToggle: boolean = false;

	function handleMenuClick() {
		if (showMenu) {
			// Dispatch custom event for menu actions
			const event = new CustomEvent('menuClick');
			dispatchEvent(event);
		}
	}

	function handlePublishToggle() {
		if (showPublishToggle) {
			const newState = publishState === 'draft' ? 'published' : 'draft';
			// Dispatch custom event for state change
			const event = new CustomEvent('publishToggle', {
				detail: { newState }
			});
			dispatchEvent(event);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (event.target === event.currentTarget) {
				handleMenuClick();
			}
		}
	}
</script>

<div class="header-bar">
	<div class="header-title">
		{title}
	</div>

	<div class="header-actions">
		{#if showPublishToggle}
			<button
				class="publish-toggle"
				class:draft={publishState === 'draft'}
				class:published={publishState === 'published'}
				class:archived={publishState === 'archived'}
				on:click|passive={handlePublishToggle}
				aria-label="Toggle publish state"
				title="Toggle publish state"
			>
				<span class="publish-indicator"></span>
			</button>
		{/if}

		{#if showMenu}
			<button
				class="menu-button"
				on:click|passive={handleMenuClick}
				on:keydown|passive={handleKeyDown}
				aria-label="Open menu"
				title="Open menu"
				tabindex="0"
			>
				<span class="menu-dots">⋮</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.header-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		min-height: 2.5em;
	}

	.header-title {
		font-weight: 600;
		font-size: 1em;
		color: #212529;
		flex: 1;
		margin-right: 0.5em;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5em;
	}

	.publish-toggle {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid #dee2e6;
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		position: relative;
	}

	.publish-toggle:hover {
		border-color: #ced4da;
		transform: scale(1.1);
	}

	.publish-toggle.draft {
		border-color: #ffc107;
		background-color: #fff3cd;
	}

	.publish-toggle.published {
		border-color: #28a745;
		background-color: #d4edda;
	}

	.publish-toggle.archived {
		border-color: #6c757d;
		background-color: #f8f9fa;
	}

	.publish-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		transition: background-color 0.2s ease;
	}

	.publish-toggle.draft .publish-indicator {
		background-color: #ffc107;
	}

	.publish-toggle.published .publish-indicator {
		background-color: #28a745;
	}

	.publish-toggle.archived .publish-indicator {
		background-color: #6c757d;
	}

	.menu-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25em;
		border-radius: 4px;
		transition: background-color 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.menu-button:hover {
		background-color: #e9ecef;
	}

	.menu-button:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}

	.menu-dots {
		font-size: 1.2em;
		color: #6c757d;
		line-height: 1;
	}
</style>