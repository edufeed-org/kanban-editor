# Test IDs and Selectors Documentation

This document lists all the test IDs (`data-testid`) and selectors that should be added to the application components for E2E testing.

## Required Test IDs for Components

### Authentication Components

```html
<!-- Login/Auth UI -->
<div data-testid="authenticated-user">User info when logged in</div>
<div data-testid="user-info">Display user information</div>
<div data-testid="user-menu">User menu/dropdown</div>
<button data-testid="logout-button">Logout button</button>

<!-- Login Forms -->
<input data-testid="nsec-input" placeholder="nsec1..." />
<input data-testid="nip46-input" placeholder="bunker://..." />
<button data-testid="nip07-login-button">Login with Extension</button>
<button data-testid="nsec-login-button">Login with Private Key</button>
<button data-testid="nip46-login-button">Login with NIP-46</button>
```

### Board Components

```html
<!-- Main Board -->
<div data-testid="kanban-board">Main kanban board container</div>
<div data-testid="column">Individual column containers</div>
<div data-testid="card-item">Individual card elements</div>

<!-- Column Operations -->
<button data-testid="add-card-button">Add new card button (per column)</button>
<button data-testid="add-column-button">Add new column button</button>
<input data-testid="column-name-input" placeholder="Column name..." />

<!-- Card Operations -->
<input data-testid="card-title-input" placeholder="Card title..." />
<textarea data-testid="card-description-input" placeholder="Card description..." />
<button data-testid="save-card-button">Save card button</button>
<button data-testid="edit-card-button">Edit card button</button>
<button data-testid="delete-card-button">Delete card button</button>
```

### Card Details

```html
<!-- Card Dialog -->
<div data-testid="card-dialog">Card details dialog</div>
<div data-testid="card-author">Card author information</div>
<div data-testid="card-created-date">Card creation date</div>
<div data-testid="card-updated-date">Card last update date</div>

<!-- Comments -->
<div data-testid="comments-section">Comments container</div>
<textarea data-testid="comment-input" placeholder="Add a comment..." />
<button data-testid="add-comment-button">Submit comment button</button>
<div data-testid="comment-item">Individual comment elements</div>
<div data-testid="comment-author">Comment author info</div>
<button data-testid="delete-comment-button">Delete comment button</button>
```

### Board Management

```html
<!-- Board List -->
<div data-testid="boards-list">List of user boards</div>
<button data-testid="create-board-button">Create new board button</button>
<input data-testid="board-name-input" placeholder="Board name..." />
<textarea data-testid="board-description-input" placeholder="Board description..." />

<!-- Board Settings -->
<button data-testid="board-settings-button">Board settings button</button>
<button data-testid="export-board-button">Export board button</button>
<button data-testid="import-board-button">Import board button</button>
<input data-testid="import-file-input" type="file" />
```

### Navigation and Layout

```html
<!-- Top Navigation -->
<nav data-testid="topbar">Main navigation bar</nav>
<button data-testid="sidebar-toggle">Toggle sidebar button</button>
<button data-testid="theme-toggle">Toggle dark mode button</button>

<!-- Sidebars -->
<aside data-testid="left-sidebar">Left sidebar</aside>
<aside data-testid="right-sidebar">Right sidebar</aside>
<div data-testid="ai-panel">AI assistant panel</div>
```

## Implementation Guide

### Adding Test IDs to Svelte Components

```svelte
<!-- Example: Card.svelte -->
<div data-testid="card-item" class="card">
  <h3 data-testid="card-title">{card.title}</h3>
  <p data-testid="card-description">{card.description}</p>
  
  <button 
    data-testid="edit-card-button"
    onclick={handleEdit}
  >
    Edit
  </button>
</div>

<!-- Example: Column.svelte -->
<div data-testid="column" class="column">
  <h2>{column.name}</h2>
  
  {#each column.cards as card}
    <Card {card} />
  {/each}
  
  <button data-testid="add-card-button" onclick={handleAddCard}>
    Add Card
  </button>
</div>
```

### Conditional Test IDs for Authentication

```svelte
<!-- Example: Layout.svelte -->
{#if authStore.isAuthenticated}
  <div data-testid="authenticated-user">
    <span data-testid="user-info">{authStore.getDisplayName()}</span>
    <button data-testid="logout-button" onclick={handleLogout}>
      Logout
    </button>
  </div>
{:else}
  <div data-testid="login-form">
    <!-- Login form content -->
  </div>
{/if}
```

### Dynamic Test IDs

```svelte
<!-- For lists with dynamic content -->
{#each cards as card, index}
  <div 
    data-testid="card-item"
    data-card-id={card.id}
    data-card-index={index}
  >
    <!-- Card content -->
  </div>
{/each}

<!-- For different states -->
<button 
  data-testid="save-card-button"
  data-state={isLoading ? 'loading' : 'ready'}
  disabled={isLoading}
>
  {isLoading ? 'Saving...' : 'Save'}
</button>
```

## Test Data Attributes

### Authentication State

```html
<!-- Useful for testing authentication flows -->
<body data-auth-state={authStore.isAuthenticated ? 'authenticated' : 'unauthenticated'}>
<div data-signer-type={authStore.getSignerType()}></div>
```

### Board State

```html
<!-- Useful for testing board operations -->
<div data-testid="kanban-board" data-board-id={board.id}>
<div data-testid="column" data-column-id={column.id} data-cards-count={column.cards.length}>
<div data-testid="card-item" data-card-id={card.id} data-publish-state={card.publishState}>
```

## Accessibility and Test ID Best Practices

1. **Use semantic HTML elements when possible**
   ```html
   <button role="button" data-testid="save-button">Save</button>
   <input role="textbox" data-testid="card-title-input" />
   ```

2. **Keep test IDs descriptive and consistent**
   - Use kebab-case: `add-card-button`
   - Be specific: `nsec-login-button` not just `login-button`
   - Include context: `todo-column-add-card-button`

3. **Avoid coupling test IDs to implementation details**
   ```html
   <!-- Good -->
   <button data-testid="save-card-button">Save</button>
   
   <!-- Bad - coupled to CSS classes -->
   <button data-testid="btn-primary-save">Save</button>
   ```

4. **Use ARIA labels alongside test IDs**
   ```html
   <button 
     data-testid="delete-card-button"
     aria-label="Delete card"
   >
     <TrashIcon />
   </button>
   ```

## Environment-Specific Considerations

### Development vs Production

```svelte
<script>
  // Only add test IDs in development/test environments
  const isTest = import.meta.env.MODE === 'test' || import.meta.env.MODE === 'development';
  const testId = isTest ? 'card-item' : undefined;
</script>

<div data-testid={testId} class="card">
  <!-- Card content -->
</div>
```

### Test Data Management

For tests, create mock data that matches the production data structure:

```typescript
// test-fixtures.ts
export const mockBoard = {
  id: 'test-board-1',
  name: 'Test Board',
  columns: [
    { id: 'todo', name: 'To Do', cards: [] },
    { id: 'progress', name: 'In Progress', cards: [] },
    { id: 'done', name: 'Done', cards: [] }
  ]
};

export const mockCard = {
  id: 'test-card-1',
  title: 'Test Card',
  description: 'Test Description',
  author: 'test-user-pubkey',
  publishState: 'draft'
};
```