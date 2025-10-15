<script lang="ts">
	export let isOpen: boolean;
	export let onClose: () => void;
	export let onAction: (action: string) => void;

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	function handleAction(action: string) {
		onAction(action);
		onClose();
	}
</script>

{#if isOpen}
	<div
		class="sidebar-overlay"
		onclick={onClose}
		onkeydown={handleKeyDown}
		role="button"
		tabindex="0"
		aria-label="Sidebar schließen"
	>
		<div
			class="sidebar"
			onclick={() => {}}
			onkeydown={handleKeyDown}
			role="dialog"
			aria-label="Karten-Aktionen"
			tabindex="0"
		>
			<div class="sidebar-header">
				<h4>Karte bearbeiten</h4>
				<button class="close-button" onclick={onClose} aria-label="Sidebar schließen">×</button>
			</div>
			<div class="sidebar-content">
				<button class="sidebar-action" onclick={() => handleAction('delete')}>
					Karte löschen
				</button>
				<button class="sidebar-action" onclick={() => handleAction('duplicate')}>
					Duplizieren
				</button>
				<button class="sidebar-action" onclick={() => handleAction('move')}>
					Verschieben
				</button>
				<button class="sidebar-action" onclick={() => handleAction('color')}>
					Farbe ändern
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Sidebar Styles */
	.sidebar-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.3);
		display: flex;
		justify-content: flex-end;
		z-index: 999;
	}

	.sidebar {
		width: 300px;
		height: 100%;
		background: white;
		box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
		overflow-y: auto;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1em 1.5em;
		border-bottom: 1px solid #e9ecef;
	}

	.sidebar-header h4 {
		margin: 0;
		color: #212529;
	}

	.sidebar-content {
		padding: 1em;
	}

	.sidebar-action {
		display: block;
		width: 100%;
		padding: 0.75em;
		margin-bottom: 0.5em;
		background: none;
		border: 1px solid #ced4da;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s ease;
	}

	.sidebar-action:hover {
		background-color: #f8f9fa;
		border-color: #adb5bd;
	}

	.sidebar-action:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}
</style>