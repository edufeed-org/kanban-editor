# Entwickler-Aufgabenliste (Developer Task List)

**Version:** 2.0 (Phase 4 Infrastructure Update)  
**Erstellt:** 13. November 2025  
**Basis:** ROADMAP.md v3.3 - Phase 4 Infrastruktur-Analyse  
**Status:** ✅ Verifiziert gegen aktuelle Codebase

---

## 📌 Übersicht

Diese Liste enthält **NUR tatsächlich fehlende Aufgaben**, basierend auf systematischer Codebase-Verifikation vom 13.11.2025.

**🎉 MAJOR BREAKTHROUGH: Phase 4 Infrastructure ~85% FERTIG!**

**Was NICHT in dieser Liste ist (bereits existiert):**
- ❌ settingsStore (✅ existiert - 971 Zeilen)
- ❌ authStore (✅ existiert - authStore.svelte.ts)
- ❌ syncManager (✅ existiert - syncManager.svelte.ts)
- ❌ Dark Mode (✅ funktioniert via settingsStore.theme)
- ❌ MCP Configuration (✅ vollständig in settingsStore)
- ❌ **SoftLockManager** (✅ existiert - 160 Zeilen!)
- ❌ **MergeEngine** (✅ existiert - 3-way merge complete!)
- ❌ **CardEditingFlow** (✅ existiert - conflict detection complete!)
- ❌ **Last-Write-Wins** (✅ implementiert in upsertCardFromNostr!)
- ❌ **Maintainers Support** (✅ p-tags in nostrEvents.ts!)

**Was IN dieser Liste ist (tatsächlich fehlend):**
- 🔴 **Phase 3:** 3 fehlende AI Actions (splitCard, mergeCards, reorderCards) - 5-7 Tage
- 🟡 **Phase 2:** Paste System Konsolidierung (Duplikat-Problem) - 1-2 Stunden
- 🟠 **Phase 2:** Mobile/A11y/Performance - 8-12 Tage
- ⚠️ **Phase 1:** Integration Testing für 1.2/1.4 - 3-5 Tage
- 🔴 **Phase 4:** Share Dialog UI + NIP-51 + BoardRole (6-9 Tage)
- 🟡 **Phase 4:** Presence UI + Notifications + Soft-Lock UI (4-7 Tage)
- ⚠️ **Phase 4:** E2E Tests Multi-User (3-4 Tage)

**Total verbleibend: ~30-44 Tage (wenn sequentiell), ~18-25 Tage (wenn parallel mit 2 Devs)**

---

## 🔴 KRITISCH (P0) - Höchste Priorität

### Task 1: AI Action - splitCard implementieren
**Priorität:** 🔴 P0 - CRITICAL  
**Dauer:** 2-3 Tage  
**Abhängigkeit:** Keine  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Implementiere `executeSplitCard()` in `src/lib/agent/actionProcessing.ts` für KI-gesteuerte Content-Strukturierung.

**Technische Details:**
```typescript
// In src/lib/agent/actionProcessing.ts

interface SplitCardAction {
  type: 'split_card';
  columnId: string;
  sourceCardId: string;
  splitPoint?: number; // Optional: Character index zum Split
  newCards: Array<{
    heading: string;
    content?: string;
    labels?: string[];
  }>;
}

async function executeSplitCard(
  action: SplitCardAction, 
  boardStore: BoardStore
): Promise<void> {
  const column = boardStore.board.findColumn(action.columnId);
  if (!column) throw new Error(`Column ${action.columnId} not found`);
  
  const sourceCard = column.findCard(action.sourceCardId);
  if (!sourceCard) throw new Error(`Card ${action.sourceCardId} not found`);
  
  // 1. Capture source card data BEFORE deletion
  const sourceData = sourceCard.getContextData();
  
  // 2. Delete source card
  column.deleteCard(action.sourceCardId);
  
  // 3. Add new cards (preserving labels, author, etc.)
  for (const newCardProps of action.newCards) {
    column.addCard({
      heading: newCardProps.heading,
      content: newCardProps.content,
      labels: newCardProps.labels || sourceData.labels, // Inherit from source
      author: sourceData.author, // Same author
      publishState: 'draft' // Reset to draft
    });
  }
  
  // 4. Trigger reactivity
  boardStore.triggerUpdate();
}
```

**Integration Points:**
- `actionProcessing.ts` - Neue Funktion hinzufügen
- `AIPanel.svelte` - Handler für splitCard Intent
- `intentDetection.ts` - Split-Pattern Recognition (optional, später)

**Tests:**
```typescript
// In actionProcessing.spec.ts
describe('executeSplitCard', () => {
  it('sollte Karte in mehrere Karten aufteilen', () => {
    const action = {
      type: 'split_card',
      columnId: 'col-1',
      sourceCardId: 'card-1',
      newCards: [
        { heading: 'Teil 1', content: 'Erster Teil' },
        { heading: 'Teil 2', content: 'Zweiter Teil' }
      ]
    };
    
    executeSplitCard(action, boardStore);
    
    const column = boardStore.board.findColumn('col-1');
    expect(column.cards.length).toBe(2); // Original deleted, 2 new
    expect(column.cards[0].heading).toBe('Teil 1');
  });
});
```

**Acceptance Criteria:**
- ✅ Source-Karte wird gelöscht
- ✅ Neue Karten werden mit korrekt aufgeteiltem Content erstellt
- ✅ Labels, Author werden von Source übernommen
- ✅ publishState wird auf 'draft' gesetzt
- ✅ boardStore.triggerUpdate() wird aufgerufen
- ✅ Unit Tests mit 80%+ Coverage

**Dokumentation:**
- [ ] Update `AGENTS.md` Section VII (KI-Aktionen)
- [ ] Update `ROADMAP.md` Phase 3 (mark splitCard as DONE)
- [ ] Add JSDoc comments in actionProcessing.ts

---

### Task 2: AI Action - mergeCards implementieren
**Priorität:** 🔴 P0 - CRITICAL  
**Dauer:** 1-2 Tage  
**Abhängigkeit:** Keine  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Implementiere `executeMergeCards()` für Zusammenführung mehrerer Karten.

**Technische Details:**
```typescript
interface MergeCardsAction {
  type: 'merge_cards';
  columnId: string;
  sourceCardIds: string[]; // Min 2 IDs
  mergedCard: {
    heading: string;
    content?: string;
    labels?: string[];
  };
}

async function executeMergeCards(
  action: MergeCardsAction,
  boardStore: BoardStore
): Promise<void> {
  const column = boardStore.board.findColumn(action.columnId);
  if (!column) throw new Error(`Column ${action.columnId} not found`);
  
  if (action.sourceCardIds.length < 2) {
    throw new Error('Mindestens 2 Karten zum Mergen erforderlich');
  }
  
  // 1. Collect data from all source cards
  const sourceCards = action.sourceCardIds.map(id => {
    const card = column.findCard(id);
    if (!card) throw new Error(`Card ${id} not found`);
    return card;
  });
  
  // 2. Merge labels (unique)
  const mergedLabels = [
    ...new Set([
      ...(action.mergedCard.labels || []),
      ...sourceCards.flatMap(c => c.labels || [])
    ])
  ];
  
  // 3. Delete all source cards
  for (const id of action.sourceCardIds) {
    column.deleteCard(id);
  }
  
  // 4. Add merged card
  column.addCard({
    heading: action.mergedCard.heading,
    content: action.mergedCard.content,
    labels: mergedLabels,
    author: sourceCards[0].author, // First author
    publishState: 'draft'
  });
  
  boardStore.triggerUpdate();
}
```

**Acceptance Criteria:**
- ✅ Mindestens 2 Source-Karten erforderlich
- ✅ Alle Source-Karten werden gelöscht
- ✅ Neue merged Karte wird erstellt
- ✅ Labels werden dedupliziert zusammengeführt
- ✅ Author vom ersten Source übernommen
- ✅ Unit Tests mit Edge Cases (1 card, 10 cards, etc.)

**Dokumentation:**
- [ ] Update AGENTS.md
- [ ] Update ROADMAP.md
- [ ] JSDoc comments

---

### Task 3: AI Action - reorderCards implementieren
**Priorität:** 🔴 P0 - CRITICAL  
**Dauer:** 1-2 Tage  
**Abhängigkeit:** Keine  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Implementiere `executeReorderCards()` für KI-gesteuerte Card-Umordnung innerhalb Spalte.

**Technische Details:**
```typescript
interface ReorderCardsAction {
  type: 'reorder_cards';
  columnId: string;
  cardOrder: string[]; // Array von Card-IDs in neuer Reihenfolge
}

async function executeReorderCards(
  action: ReorderCardsAction,
  boardStore: BoardStore
): Promise<void> {
  const column = boardStore.board.findColumn(action.columnId);
  if (!column) throw new Error(`Column ${action.columnId} not found`);
  
  // 1. Validate all IDs exist
  for (const cardId of action.cardOrder) {
    if (!column.findCard(cardId)) {
      throw new Error(`Card ${cardId} not found in column`);
    }
  }
  
  // 2. Reorder cards array
  const reorderedCards = action.cardOrder.map(id => {
    const card = column.findCard(id);
    if (!card) throw new Error(`Card ${id} not found`);
    return card;
  });
  
  // 3. Update column's cards (array reassignment!)
  column.cards = reorderedCards;
  
  // 4. Trigger reactivity
  boardStore.triggerUpdate();
}
```

**Acceptance Criteria:**
- ✅ Validiert dass alle IDs existieren
- ✅ Fehler wenn ID fehlt oder dupliziert
- ✅ Karten-Reihenfolge wird korrekt geändert
- ✅ Array-Reassignment (kein .sort() direkt!)
- ✅ triggerUpdate() wird aufgerufen
- ✅ Unit Tests mit verschiedenen Ordnungen

**Dokumentation:**
- [ ] Update AGENTS.md
- [ ] Update ROADMAP.md
- [ ] JSDoc comments

---

## 🟡 HOCH (P1) - Wichtig aber nicht blockierend

### Task 4: Paste System Konsolidierung
**Priorität:** 🟡 P1 - HIGH  
**Dauer:** 1-2 Stunden  
**Abhängigkeit:** Keine  
**Status:** 🟡 DUPLIKAT GEFUNDEN

**Problem:**
Zwei Paste-Implementierungen existieren parallel:
- `src/lib/paste/PasteHandler.ts` (113 Zeilen, vollständige Handler-Architektur)
- `src/lib/stores/boardstore/paste.ts` (122 Zeilen, einfachere Version)

**Analyse:**
```
lib/paste/PasteHandler.ts:
✅ Handler Priority System (ImagePasteHandler=20, NostrEvent=15, URL=10, Text=0)
✅ Erweiterbar für neue Handler
✅ Saubere Trennung (Orchestrator + Handlers)
❌ Möglicherweise nicht in Production verwendet?

boardstore/paste.ts:
✅ Funktioniert (wird von boardStore genutzt)
✅ mergeCardUpdates Pattern für Paste-Conflicts
❌ Weniger erweiterbar
❌ Keine Handler-Hierarchie
```

**Empfehlung:**
👉 **lib/paste/ behalten, boardstore/paste.ts entfernen**

**Begründung:**
- Handler-Pattern ist zukunftssicherer
- Priority-System erlaubt einfaches Hinzufügen neuer Paste-Typen
- Orchestrator-Architektur cleaner

**Migration Steps:**
```typescript
// 1. Verify lib/paste/ works in production
//    - Test Image paste
//    - Test Nostr Event paste
//    - Test URL paste
//    - Test Text paste

// 2. In kanbanStore.svelte.ts - Replace import
// OLD:
import { handleCardPaste } from './boardstore/paste';

// NEW:
import { PasteHandler } from '$lib/paste/PasteHandler';
const pasteHandler = new PasteHandler();

// 3. Update call sites
// OLD:
handleCardPaste(clipboardData, cardId);

// NEW:
pasteHandler.handlePaste(clipboardData, { cardId, boardStore });

// 4. Delete boardstore/paste.ts
// 5. Update all imports
// 6. Run tests
```

**Tests:**
```bash
# Vor Migration
pnpm run test:unit -- paste

# Nach Migration
pnpm run test:unit -- paste
pnpm run test:e2e -- paste-scenarios
```

**Acceptance Criteria:**
- ✅ lib/paste/ in Production getestet
- ✅ boardstore/paste.ts entfernt
- ✅ Alle Imports aktualisiert
- ✅ Tests grün
- ✅ Keine Regressions

**Dokumentation:**
- [ ] Update ROADMAP.md (mark Paste consolidation DONE)
- [ ] Add migration notice in CHANGELOG.md
- [ ] Update docs if lib/paste/ has new API

---

### Task 5: Phase 2 - Mobile Responsive Design
**Priorität:** 🟠 P1 - HIGH  
**Dauer:** 4-5 Tage  
**Abhängigkeit:** Phase 1 Complete  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Implementiere vollständige Mobile-First Responsive Design für alle Komponenten.

**Betroffene Komponenten:**
- `Topbar.svelte` - Mobile Menü, Hamburger Icon
- `Column.svelte` - Stacked Layout, Touch Gestures
- `Card.svelte` - Kleinere Spacing, größere Touch-Targets
- `AIPanel.svelte` - Bottom Sheet auf Mobile
- `BoardsList.svelte` - Mobile Navigation
- `CardDialog.svelte` - Full-Screen auf Mobile

**Breakpoints (Tailwind):**
```css
/* Mobile First Approach */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large Desktops */
```

**Beispiel-Implementation (Topbar.svelte):**
```svelte
<script lang="ts">
  let mobileMenuOpen = $state(false);
</script>

<!-- Desktop: Full Topbar -->
<header class="hidden md:flex h-16 border-b">
  <Button variant="ghost" size="sm" onclick={toggleLeftSidebar}>
    <PanelLeftIcon class="h-4 w-4" />
  </Button>
  <!-- ... full topbar -->
</header>

<!-- Mobile: Hamburger Menu -->
<header class="md:hidden flex h-14 border-b">
  <Button variant="ghost" size="icon" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
    <MenuIcon class="h-5 w-5" />
  </Button>
  
  {#if mobileMenuOpen}
    <Sheet.Root bind:open={mobileMenuOpen}>
      <Sheet.Content side="left" class="w-80">
        <!-- Mobile menu content -->
      </Sheet.Content>
    </Sheet.Root>
  {/if}
</header>
```

**Touch Gestures:**
```typescript
// In Column.svelte - Swipe to navigate
let touchStartX = 0;
let touchEndX = 0;

function handleTouchStart(e: TouchEvent) {
  touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e: TouchEvent) {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}

function handleSwipe() {
  const swipeThreshold = 50;
  if (touchStartX - touchEndX > swipeThreshold) {
    // Swipe Left - Next column
    navigateToNextColumn();
  } else if (touchEndX - touchStartX > swipeThreshold) {
    // Swipe Right - Previous column
    navigateToPreviousColumn();
  }
}
```

**Tests:**
```typescript
// E2E Mobile Tests (Playwright)
test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE
  
  test('sollte mobile Menü öffnen', async ({ page }) => {
    await page.goto('/cardsboard');
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });
  
  test('sollte Karten vertikal stacken', async ({ page }) => {
    await page.goto('/cardsboard');
    const cards = page.locator('[data-testid="card"]');
    
    // Verify vertical layout
    const boundingBoxes = await cards.evaluateAll(els => 
      els.map(el => el.getBoundingClientRect())
    );
    
    for (let i = 0; i < boundingBoxes.length - 1; i++) {
      expect(boundingBoxes[i].bottom).toBeLessThanOrEqual(
        boundingBoxes[i + 1].top
      );
    }
  });
});
```

**Acceptance Criteria:**
- ✅ Alle Komponenten responsive (sm/md/lg Breakpoints)
- ✅ Touch Gestures funktionieren (swipe, tap, long-press)
- ✅ Mobile Navigation (Hamburger Menü)
- ✅ Full-Screen Modals auf Mobile
- ✅ Keine horizontalen Scrollbars
- ✅ Touch-Targets min 44x44px (iOS Guidelines)
- ✅ E2E Tests für 3 Viewports (Mobile, Tablet, Desktop)

**Dokumentation:**
- [ ] Update ROADMAP.md (mark Mobile DONE)
- [ ] Add responsive breakpoint guide in docs/GUIDES/
- [ ] Screenshot Gallery für verschiedene Viewports

---

### Task 6: Phase 2 - Accessibility (A11y) Testing
**Priorität:** 🟠 P1 - HIGH  
**Dauer:** 2-3 Tage  
**Abhängigkeit:** Mobile Design Complete  
**Status:** ❌ NICHT VOLLSTÄNDIG

**Beschreibung:**
Comprehensive Accessibility Audit + Fixes für WCAG 2.1 AA Compliance.

**Tools:**
- axe DevTools (Chrome Extension)
- NVDA (Windows Screen Reader)
- JAWS (Windows Screen Reader)
- VoiceOver (macOS Screen Reader)
- Keyboard-Only Navigation

**Audit-Bereiche:**

**1. Keyboard Navigation:**
```typescript
// Alle interaktive Elemente müssen keyboard-erreichbar sein
// Tab Order logisch
// Enter/Space für Aktionen
// Escape für Modals schließen

// Test Pattern:
test('sollte komplett keyboard-navigierbar sein', async ({ page }) => {
  await page.goto('/cardsboard');
  
  // Tab through all interactive elements
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'first-button');
  
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'second-button');
  
  // ... continue for all elements
});
```

**2. ARIA Labels:**
```svelte
<!-- BEFORE (Bad) -->
<button onclick={deleteCard}>
  <TrashIcon />
</button>

<!-- AFTER (Good) -->
<button 
  onclick={deleteCard}
  aria-label="Karte löschen"
  type="button"
>
  <TrashIcon aria-hidden="true" />
</button>

<!-- Dialog ARIA -->
<Dialog.Root>
  <Dialog.Content
    role="dialog"
    aria-labelledby="dialog-title"
    aria-describedby="dialog-description"
  >
    <Dialog.Title id="dialog-title">Karte bearbeiten</Dialog.Title>
    <Dialog.Description id="dialog-description">
      Ändern Sie die Karteninformationen
    </Dialog.Description>
  </Dialog.Content>
</Dialog.Root>
```

**3. Focus Management:**
```typescript
// In CardDialog.svelte
import { tick } from 'svelte';

let dialogOpen = $state(false);
let firstFocusableElement: HTMLElement;

$effect(() => {
  if (dialogOpen) {
    tick().then(() => {
      // Focus first input when dialog opens
      firstFocusableElement?.focus();
    });
  }
});

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    dialogOpen = false;
    // Return focus to trigger element
    triggerButton?.focus();
  }
}
```

**4. Color Contrast:**
```css
/* WCAG AA Minimum: 4.5:1 for normal text, 3:1 for large text */

/* BAD */
.text-gray-400 { color: #9CA3AF; } /* 2.8:1 on white - FAIL */

/* GOOD */
.text-gray-600 { color: #4B5563; } /* 4.6:1 on white - PASS */
.text-gray-700 { color: #374151; } /* 7.1:1 on white - PASS */
```

**5. Screen Reader Testing:**
```svelte
<!-- Semantic HTML + ARIA -->
<main aria-labelledby="page-title">
  <h1 id="page-title">Kanban Board</h1>
  
  <nav aria-label="Board Navigation">
    <ul role="list">
      <li><a href="#col-1">To Do</a></li>
      <li><a href="#col-2">In Progress</a></li>
    </ul>
  </nav>
  
  <section aria-labelledby="col-1-title">
    <h2 id="col-1-title">To Do</h2>
    <ul role="list" aria-label="To Do Karten">
      <li role="listitem">
        <article aria-labelledby="card-1-title">
          <h3 id="card-1-title">Karte 1</h3>
        </article>
      </li>
    </ul>
  </section>
</main>
```

**Acceptance Criteria:**
- ✅ axe DevTools: 0 Errors, 0 Warnings
- ✅ Keyboard-Only Navigation: Alle Features erreichbar
- ✅ Screen Reader: NVDA + JAWS tested, alle Elemente lesbar
- ✅ Color Contrast: Mindestens WCAG AA (4.5:1)
- ✅ Focus-Indikatoren: Klar sichtbar (nicht outline:none!)
- ✅ Skip Links für Keyboard Users
- ✅ Dokumentation: A11y Guidelines für Entwickler

**Dokumentation:**
- [ ] Create docs/GUIDES/ACCESSIBILITY.md
- [ ] Update ROADMAP.md (mark A11y DONE)
- [ ] Add A11y checklist to PR template

---

### Task 7: Phase 2 - Performance Optimization
**Priorität:** 🟡 P1 - MEDIUM  
**Dauer:** 2-3 Tage  
**Abhängigkeit:** Mobile + A11y Complete  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Virtualisierung, Lazy Loading, Code Splitting für große Boards.

**1. Column Virtualization (>20 Cards):**
```svelte
<script lang="ts">
  import { VirtualList } from 'svelte-virtual-list';
  
  let { column } = $props();
  let items = $derived(column.cards);
  
  // Only render visible cards + buffer
  const ITEM_HEIGHT = 120; // px
  const BUFFER_SIZE = 3;
</script>

<VirtualList
  {items}
  itemHeight={ITEM_HEIGHT}
  buffer={BUFFER_SIZE}
  let:item
>
  <Card card={item} />
</VirtualList>
```

**2. Lazy Loading Images:**
```svelte
<script lang="ts">
  let { card } = $props();
  let imageLoaded = $state(false);
  
  function handleImageLoad() {
    imageLoaded = true;
  }
</script>

{#if card.image}
  <img
    src={card.image}
    alt={card.heading}
    loading="lazy" <!-- Native lazy loading -->
    class:opacity-0={!imageLoaded}
    class:opacity-100={imageLoaded}
    onload={handleImageLoad}
  />
{/if}
```

**3. Code Splitting:**
```typescript
// Dynamic import für heavy components
const AIPanel = lazy(() => import('./AIPanel.svelte'));
const MergeConflictDialog = lazy(() => import('./MergeConflictDialog.svelte'));

// In Component:
{#if showAIPanel}
  <Suspense fallback={<Spinner />}>
    <AIPanel />
  </Suspense>
{/if}
```

**4. Bundle Size Analysis:**
```bash
# Analyse bundle size
pnpm run build
pnpm run analyze

# Target: < 200KB initial bundle
# < 500KB total (with code splitting)
```

**5. Lighthouse Performance Target:**
```
Performance: > 90
Accessibility: > 90
Best Practices: > 90
SEO: > 90

Metrics:
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.8s
- Total Blocking Time: < 300ms
- Cumulative Layout Shift: < 0.1
```

**Tests:**
```typescript
// Performance Budget Tests
test('sollte Performance Budget einhalten', async ({ page }) => {
  await page.goto('/cardsboard');
  
  const performanceMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
    };
  });
  
  expect(performanceMetrics.loadTime).toBeLessThan(3000);
  expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
});

// Large Board Test
test('sollte 100 Karten ohne Lag rendern', async ({ page }) => {
  // Create board with 100 cards
  await createLargeBoard(100);
  
  await page.goto('/cardsboard');
  
  // Measure FPS during scroll
  const fps = await measureScrollFPS(page);
  expect(fps).toBeGreaterThan(50); // Min 50 FPS
});
```

**Acceptance Criteria:**
- ✅ Lighthouse Performance > 90
- ✅ Bundle Size < 200KB initial
- ✅ Virtualization for >20 cards
- ✅ Images lazy loaded
- ✅ Code splitting für heavy components
- ✅ No visueller Jank bei 60fps
- ✅ Memory-Leaks ausgeschlossen (DevTools)

**Dokumentation:**
- [ ] Update ROADMAP.md (mark Performance DONE)
- [ ] Add performance budget to CI/CD
- [ ] Document virtualization approach

---

## ⚠️ MITTEL (P2) - Integration Testing

### Task 8: Phase 1.2 - Offline Sync Integration Tests
**Priorität:** ⚠️ P2 - MEDIUM  
**Dauer:** 2-3 Tage  
**Abhängigkeit:** syncManager.svelte.ts (✅ EXISTS)  
**Status:** ⚠️ NUR TESTING FEHLT

**Beschreibung:**
Implementiere Integration Tests für syncManager + Nostr Publishing.

**Was bereits existiert:**
✅ syncManager.svelte.ts Klasse (Line 53)  
✅ IndexedDB Queue Implementierung  
✅ Retry-Logik (2^retries)

**Was fehlt:**
❌ Integration Tests mit echtem IndexedDB  
❌ Nostr Publishing Verification  
❌ Offline/Online Toggle Tests

**Test-Szenarien:**

**1. IndexedDB Queue Testing:**
```typescript
import { syncManager } from '$lib/stores/syncManager.svelte';
import Dexie from 'dexie';

describe('SyncManager Queue', () => {
  let db: Dexie;
  
  beforeEach(async () => {
    // Setup test DB
    db = new Dexie('test-event-queue');
    await db.open();
  });
  
  afterEach(async () => {
    await db.delete();
  });
  
  it('sollte Events in Queue speichern wenn offline', async () => {
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    const event = createMockBoardEvent();
    await syncManager.publishOrQueue(event, 'board');
    
    const queue = await syncManager.getQueuedEvents();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('board');
  });
  
  it('sollte Queue beim Reconnect synchronisieren', async () => {
    // Queue 3 events offline
    Object.defineProperty(navigator, 'onLine', { value: false });
    await syncManager.publishOrQueue(event1, 'board');
    await syncManager.publishOrQueue(event2, 'card');
    await syncManager.publishOrQueue(event3, 'comment');
    
    // Go online
    Object.defineProperty(navigator, 'onLine', { value: true });
    window.dispatchEvent(new Event('online'));
    
    // Wait for sync
    await vi.waitFor(() => {
      expect(syncManager.getQueuedEvents()).toHaveLength(0);
    }, { timeout: 5000 });
  });
});
```

**2. Retry-Logik Testing:**
```typescript
it('sollte Event nach 3 Versuchen aus Queue entfernen', async () => {
  // Mock Nostr publish to always fail
  const mockNdk = {
    publish: vi.fn().mockRejectedValue(new Error('Relay error'))
  };
  
  const event = createMockCardEvent();
  await syncManager.publishOrQueue(event, 'card');
  
  // Trigger 3 retry attempts
  for (let i = 0; i < 3; i++) {
    await syncManager.syncQueue();
    await delay(1000);
  }
  
  // Event should be removed after 3 failures
  const queue = await syncManager.getQueuedEvents();
  expect(queue).toHaveLength(0);
  expect(mockNdk.publish).toHaveBeenCalledTimes(3);
});
```

**3. Nostr Publishing Verification:**
```typescript
it('sollte Board-Event korrekt publizieren', async () => {
  const mockNdk = createMockNDK();
  const board = createTestBoard();
  
  await syncManager.publishBoardEvent(board, mockNdk);
  
  expect(mockNdk.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 30301,
      tags: expect.arrayContaining([
        ['d', board.id],
        ['title', board.name]
      ])
    })
  );
});
```

**Acceptance Criteria:**
- ✅ IndexedDB Queue Tests mit echtem Dexie
- ✅ Offline/Online Toggle simuliert
- ✅ Retry-Logik mit 2^n Backoff getestet
- ✅ Dead-Letter Pattern (3 attempts) verifiziert
- ✅ Nostr Event Publishing integriert
- ✅ Tests laufen in CI/CD

**Dokumentation:**
- [ ] Update ROADMAP.md (mark 1.2 Integration Tests DONE)
- [ ] Add syncManager test patterns to docs/GUIDES/

---

### Task 9: Phase 1.4 - Auth E2E Tests
**Priorität:** ⚠️ P2 - MEDIUM  
**Dauer:** 1-2 Tage  
**Abhängigkeit:** authStore.svelte.ts (✅ EXISTS)  
**Status:** ⚠️ NUR E2E TESTING FEHLT

**Beschreibung:**
End-to-End Tests für Login-Flow, Session-Persistence, Profile-Caching.

**Was bereits existiert:**
✅ authStore.svelte.ts (File exists)  
✅ Unit Tests: authstore.profile-cache.spec.ts (290+ Tests)

**Was fehlt:**
❌ E2E Login Flow Tests  
❌ NIP-07 Extension Mocking  
❌ Session Persistence Tests

**Test-Szenarien:**

**1. NIP-07 Login Flow:**
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock window.nostr (NIP-07 Extension)
    await context.addInitScript(() => {
      window.nostr = {
        getPublicKey: async () => '0000000000000001',
        signEvent: async (event) => {
          event.sig = 'mock-signature';
          return event;
        },
        getRelays: async () => ({
          'wss://relay.damus.io': { read: true, write: true }
        })
      };
    });
  });
  
  test('sollte mit NIP-07 Extension einloggen', async ({ page }) => {
    await page.goto('/');
    
    // Click Login button
    await page.click('[data-testid="login-button"]');
    
    // Should see user menu with pubkey
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-pubkey"]'))
      .toContainText('0000...0001');
  });
});
```

**2. Session Persistence:**
```typescript
test('sollte Session nach Reload behalten', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="login-button"]');
  
  // Verify logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  
  // Reload page
  await page.reload();
  
  // Should still be logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-pubkey"]'))
    .toContainText('0000...0001');
});
```

**3. Logout Flow:**
```typescript
test('sollte Session komplett clearen bei Logout', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="login-button"]');
  
  // Logout
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  
  // Should show login button again
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  
  // Reload - should stay logged out
  await page.reload();
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
});
```

**4. Profile Caching:**
```typescript
test('sollte Profile nur einmal laden', async ({ page }) => {
  let fetchCount = 0;
  await page.route('**/profile/**', route => {
    fetchCount++;
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        name: 'Alice',
        picture: 'https://example.com/alice.jpg'
      })
    });
  });
  
  await page.goto('/');
  await page.click('[data-testid="login-button"]');
  
  // Wait for profile load
  await page.waitForSelector('[data-testid="user-name"]');
  expect(fetchCount).toBe(1);
  
  // Reload page
  await page.reload();
  
  // Should use cached profile (no new fetch)
  await page.waitForSelector('[data-testid="user-name"]');
  expect(fetchCount).toBe(1); // Still 1!
});
```

**Acceptance Criteria:**
- ✅ NIP-07 Extension Mock funktioniert
- ✅ Login Flow komplett getestet
- ✅ Session Persistence verifiziert (über Reload)
- ✅ Logout cleant komplett
- ✅ Profile Caching funktioniert
- ✅ Error Handling (keine Extension, Network Error)

**Dokumentation:**
- [ ] Update ROADMAP.md (mark 1.4 E2E Tests DONE)
- [ ] Add NIP-07 mock pattern to docs/GUIDES/

---

## 🔴 PHASE 4 TASKS (P0-P1) - Real-time Kollaboration UI

**⚡ KRITISCHE ERKENNTNIS:** Phase 4 Backend Infrastructure ist ~85% fertig!

**✅ WAS BEREITS EXISTIERT (Backend - 85%):**
- SoftLockManager (160 Zeilen) - publishLock(), releaseLock(), subscribeLocks()
- MergeEngine - threeWayMerge(), Conflict Detection
- CardEditingFlow - checkForConflictBeforeSave(), Session Management
- SyncManager - IndexedDB Queue, Retry Logic, publishOrQueue()
- Nostr Events - createSoftLockEvent() (Kind 20001), Maintainers p-tags
- Last-Write-Wins - Timestamp-basierte Conflict Resolution
- Maintainers Support - Multi-User Event Publishing

**❌ WAS FEHLT (UI + Integration - 15%):**

### Task 10: Phase 4.1 - Share Dialog UI
**Priorität:** 🔴 P0 - CRITICAL  
**Dauer:** 3-5 Tage  
**Abhängigkeit:** NIP-51 Integration (parallel möglich)  
**Status:** ❌ UI FEHLT (Backend ✅ Maintainers ready)

**Beschreibung:**
Implementiere Share Dialog in Topbar für Board-Sharing mit User-Management.

**Technische Details:**
```svelte
<!-- src/routes/cardsboard/ShareDialog.svelte -->
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { boardStore } from "$lib/stores/kanbanStore.svelte";
  import ShareIcon from "@lucide/svelte/icons/share-2";
  
  let shareDialogOpen = $state(false);
  let userToAdd = $state('');
  let selectedRole = $state<'owner' | 'editor' | 'viewer'>('editor');
  
  let sharedUsers = $derived(boardStore.board?.maintainers || []);
  
  async function handleAddUser() {
    if (!userToAdd) return;
    
    await boardStore.addMaintainer(userToAdd, selectedRole);
    userToAdd = '';
  }
  
  async function handleRemoveUser(pubkey: string) {
    await boardStore.removeMaintainer(pubkey);
  }
  
  function handleCopyLink() {
    const shareUrl = `${window.location.origin}/board/${boardStore.board.id}`;
    navigator.clipboard.writeText(shareUrl);
  }
</script>

<Dialog.Root bind:open={shareDialogOpen}>
  <Dialog.Trigger>
    <Button variant="ghost" size="sm">
      <ShareIcon class="h-4 w-4 mr-2" />
      Teilen
    </Button>
  </Dialog.Trigger>
  
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Board teilen</Dialog.Title>
      <Dialog.Description>
        Laden Sie andere Benutzer ein, an diesem Board zu arbeiten
      </Dialog.Description>
    </Dialog.Header>
    
    <!-- User List -->
    <div class="space-y-2">
      {#each sharedUsers as user}
        <div class="flex items-center justify-between">
          <span class="text-sm">{user.pubkey}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">{user.role}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onclick={() => handleRemoveUser(user.pubkey)}
            >
              Entfernen
            </Button>
          </div>
        </div>
      {/each}
    </div>
    
    <!-- Add User Form -->
    <div class="flex gap-2">
      <Input 
        bind:value={userToAdd} 
        placeholder="npub oder Hex Pubkey..."
      />
      <select bind:value={selectedRole}>
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
      <Button onclick={handleAddUser}>Hinzufügen</Button>
    </div>
    
    <!-- Share Link -->
    <div class="flex gap-2">
      <Input readonly value={`${window.location.origin}/board/${boardStore.board.id}`} />
      <Button onclick={handleCopyLink}>Link kopieren</Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
```

**Integration in Topbar.svelte:**
```svelte
<script>
  import ShareDialog from './ShareDialog.svelte';
</script>

<header>
  <!-- ... existing topbar ... -->
  <ShareDialog />
</header>
```

**Acceptance Criteria:**
- ✅ Share Dialog UI in Topbar integriert
- ✅ User-Liste zeigt alle Maintainers
- ✅ Add/Remove User funktioniert
- ✅ Rollen-Dropdown (Owner, Editor, Viewer)
- ✅ Share-Link Copy-to-Clipboard
- ✅ Board-ID in URL navigierbar

---

### Task 11: Phase 4.1 - NIP-51 Integration
**Priorität:** 🔴 P0 - CRITICAL  
**Dauer:** 2-3 Tage  
**Abhängigkeit:** Share Dialog UI (parallel möglich)  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Implementiere NIP-51 Board-Sharing API für Contact-List-basierte Permissions.

**Technische Details:**
```typescript
// In boardStore.svelte.ts

export enum BoardRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}

export interface BoardShare {
  pubkey: string;
  role: BoardRole;
  addedAt: string; // ISO timestamp
}

export class BoardStore {
  // ... existing code ...
  
  /**
   * NIP-51: Board-Sharing via Contact Lists (Kind 30051)
   */
  public async addMaintainer(pubkey: string, role: BoardRole): Promise<void> {
    if (!this.board) throw new Error('No active board');
    
    // Add to local maintainers list
    if (!this.board.maintainers) {
      this.board.maintainers = [];
    }
    
    this.board.maintainers.push(pubkey);
    
    // Publish board event with updated p-tags
    this.triggerUpdate();
    await this.publishToNostr();
    
    // Create NIP-51 Contact List Event
    const contactListEvent = new NDKEvent(this.ndk);
    contactListEvent.kind = 30051; // Categorized Contact List
    contactListEvent.tags = [
      ['d', `board-${this.board.id}`], // d-tag for replaceable
      ['p', pubkey, '', role], // p-tag with role
      ['title', `Board: ${this.board.name}`]
    ];
    
    await contactListEvent.publish();
  }
  
  public async removeMaintainer(pubkey: string): Promise<void> {
    if (!this.board) throw new Error('No active board');
    
    // Remove from local list
    this.board.maintainers = this.board.maintainers?.filter(p => p !== pubkey) || [];
    
    this.triggerUpdate();
    await this.publishToNostr();
    
    // Update NIP-51 event (remove p-tag)
    // ... (similar to addMaintainer but filter out pubkey)
  }
  
  public async readBoardShares(): Promise<BoardShare[]> {
    if (!this.board) return [];
    
    // Fetch NIP-51 Contact List Event
    const event = await this.ndk.fetchEvent({
      kinds: [30051],
      authors: [this.currentUser.pubkey],
      '#d': [`board-${this.board.id}`]
    });
    
    if (!event) return [];
    
    // Parse p-tags for shares
    const shares: BoardShare[] = event.tags
      .filter(tag => tag[0] === 'p')
      .map(tag => ({
        pubkey: tag[1],
        role: (tag[3] || 'viewer') as BoardRole,
        addedAt: new Date(event.created_at! * 1000).toISOString()
      }));
    
    return shares;
  }
}
```

**Acceptance Criteria:**
- ✅ NIP-51 Kind 30051 Events published
- ✅ addMaintainer() funktioniert
- ✅ removeMaintainer() funktioniert
- ✅ readBoardShares() lädt korrekt
- ✅ p-tags mit Rollen-Information
- ✅ Board-Events enthalten alle Maintainers

---

### Task 12: Phase 4.1 - BoardRole Permission System
**Priorität:** 🔴 P0 - CRITICAL  
**Dauer:** 1 Tag  
**Abhängigkeit:** NIP-51 Integration  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Implementiere Permission Checks für Owner/Editor/Viewer Rollen.

**Technische Details:**
```typescript
// In boardStore.svelte.ts

export class BoardStore {
  /**
   * Check if current user has permission to perform action
   */
  private checkPermission(requiredRole: BoardRole): boolean {
    if (!this.board || !this.currentUser) return false;
    
    const userPubkey = this.currentUser.pubkey;
    
    // Owner can do everything
    if (this.board.author === userPubkey) return true;
    
    // Get user's role from maintainers
    const userRole = this.getUserRole(userPubkey);
    if (!userRole) return false;
    
    // Permission hierarchy: owner > editor > viewer
    const roleHierarchy = {
      [BoardRole.OWNER]: 3,
      [BoardRole.EDITOR]: 2,
      [BoardRole.VIEWER]: 1
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
  
  private getUserRole(pubkey: string): BoardRole | null {
    if (this.board?.author === pubkey) return BoardRole.OWNER;
    
    // Check maintainers list with roles
    // (Implement after NIP-51 integration)
    return null;
  }
  
  public createCard(columnId: string, heading: string): string {
    // Permission check before mutation
    if (!this.checkPermission(BoardRole.EDITOR)) {
      throw new Error('Permission denied: Editor role required');
    }
    
    // ... existing createCard logic ...
  }
  
  public deleteCard(cardId: string): void {
    if (!this.checkPermission(BoardRole.EDITOR)) {
      throw new Error('Permission denied: Editor role required');
    }
    
    // ... existing deleteCard logic ...
  }
  
  public deleteBoard(): void {
    if (!this.checkPermission(BoardRole.OWNER)) {
      throw new Error('Permission denied: Owner role required');
    }
    
    // ... delete logic ...
  }
}
```

**Acceptance Criteria:**
- ✅ Owner kann alles ändern
- ✅ Editor kann Cards bearbeiten + Kommentare
- ✅ Viewer nur Read-Only
- ✅ Permission Checks in allen Mutations
- ✅ Error Messages bei Permission Denied

---

### Task 13: Phase 4.2 - Presence-Indicator UI
**Priorität:** 🟡 P1 - HIGH  
**Dauer:** 2-3 Tage  
**Abhängigkeit:** SoftLockManager (✅ EXISTS)  
**Status:** ❌ UI FEHLT

**Beschreibung:**
Implementiere "Alice arbeitet gerade hier" Badges in Column Headers.

**Technische Details:**
```svelte
<!-- src/routes/cardsboard/Column.svelte -->
<script lang="ts">
  import { softLockManager } from '$lib/utils/softLockManager.svelte';
  import UsersIcon from "@lucide/svelte/icons/users";
  
  let { column } = $props();
  
  // Subscribe to locks for this column's cards
  let activeLocks = $derived(() => {
    const locks = softLockManager.getLocks();
    return locks.filter(lock => 
      column.cards.some(card => card.id === lock.cardId)
    );
  });
  
  let activeUsers = $derived(() => {
    const users = new Set(activeLocks.map(lock => lock.userPubkey));
    return Array.from(users);
  });
</script>

<div class="column-header">
  <h2>{column.name}</h2>
  
  {#if activeUsers.length > 0}
    <div class="presence-indicator">
      <UsersIcon class="h-4 w-4 mr-1" />
      <span class="text-xs text-muted-foreground">
        {activeUsers.length} aktive Benutzer
      </span>
      
      <!-- Tooltip with user names -->
      <div class="tooltip">
        {#each activeUsers as user}
          <div>{user}</div>
        {/each}
      </div>
    </div>
  {/if}
</div>
```

**Acceptance Criteria:**
- ✅ Column Header zeigt aktive User-Count
- ✅ Tooltip zeigt User-Namen
- ✅ Live-Updates via subscribeLocks()
- ✅ Avatar-Display (optional)
- ✅ Last-Seen Timestamp (optional)

---

### Task 14: Phase 4.2 - Live-Notifications
**Priorität:** 🟡 P1 - HIGH  
**Dauer:** 1-2 Tage  
**Abhängigkeit:** Keine  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Toast Notifications für Real-time Events (Kommentare, Card Moves, etc).

**Technische Details:**
```typescript
// src/lib/stores/notificationStore.svelte.ts
import { toast } from 'svelte-sonner';

export class NotificationStore {
  public showCommentAdded(cardName: string, author: string) {
    toast.info(`${author} hat einen Kommentar zu "${cardName}" hinzugefügt`);
  }
  
  public showCardMoved(cardName: string, fromColumn: string, toColumn: string) {
    toast.info(`"${cardName}" wurde von ${fromColumn} nach ${toColumn} verschoben`);
  }
  
  public showBoardUpdated(boardName: string) {
    toast.success(`Board "${boardName}" wurde aktualisiert`);
  }
}

export const notificationStore = new NotificationStore();
```

**Integration in boardStore:**
```typescript
public async addComment(cardId: string, text: string): Promise<void> {
  // ... existing logic ...
  
  // Show notification
  notificationStore.showCommentAdded(card.heading, author);
}
```

**Acceptance Criteria:**
- ✅ Toast für Kommentare
- ✅ Toast für Card-Moves
- ✅ Toast für Board-Updates
- ✅ Sound Option (optional)
- ✅ Notification Settings (enable/disable)

---

### Task 15: Phase 4.2 - Soft-Lock UI Integration
**Priorität:** 🟡 P1 - HIGH  
**Dauer:** 1-2 Tage  
**Abhängigkeit:** SoftLockManager (✅ EXISTS)  
**Status:** ❌ UI FEHLT

**Beschreibung:**
CardDetailsDialog zeigt Warnung wenn andere editiert.

**Technische Details:**
```svelte
<!-- CardDetailsDialog.svelte -->
<script lang="ts">
  import { softLockManager } from '$lib/utils/softLockManager.svelte';
  import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
  
  let { card, open } = $props();
  
  // Check for existing lock
  let cardLock = $derived(softLockManager.getCardLock(card.id));
  let isLockedByOther = $derived(
    cardLock && cardLock.userPubkey !== currentUser.pubkey
  );
  
  // Publish our lock when opening
  $effect(() => {
    if (open) {
      softLockManager.publishLock(card.id, currentUser.pubkey);
    } else {
      softLockManager.releaseLock(card.id);
    }
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    {#if isLockedByOther}
      <div class="alert alert-warning">
        <AlertTriangleIcon class="h-5 w-5" />
        <span>
          {cardLock.userPubkey} bearbeitet gerade diese Karte
        </span>
      </div>
    {/if}
    
    <!-- Rest of dialog ... -->
  </Dialog.Content>
</Dialog.Root>
```

**Acceptance Criteria:**
- ✅ Warning Badge bei Soft-Lock
- ✅ Lock wird published beim Öffnen
- ✅ Lock wird released beim Schließen
- ✅ Live-Updates von anderen Locks

---

### Task 16: Phase 4.2 - E2E Tests Multi-User
**Priorität:** ⚠️ P2 - MEDIUM  
**Dauer:** 3-4 Tage  
**Abhängigkeit:** Alle Phase 4 Features  
**Status:** ❌ NICHT IMPLEMENTIERT

**Beschreibung:**
Playwright E2E Tests mit mehreren Browsern für Concurrent Editing.

**Technische Details:**
```typescript
// e2e/collaboration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Multi-User Collaboration', () => {
  test('sollte concurrent edits mit Soft-Locks handhaben', async ({ browser }) => {
    // Create 2 browser contexts (2 users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // User 1 opens card
    await page1.goto('/cardsboard');
    await page1.click('[data-testid="card-1"]');
    
    // User 2 tries to open same card
    await page2.goto('/cardsboard');
    await page2.click('[data-testid="card-1"]');
    
    // User 2 should see warning
    await expect(page2.locator('[data-testid="lock-warning"]')).toBeVisible();
    await expect(page2.locator('[data-testid="lock-warning"]'))
      .toContainText('bearbeitet gerade diese Karte');
  });
  
  test('sollte Merge-Konflikte korrekt auflösen', async ({ browser }) => {
    // Similar multi-browser test for merge conflicts
    // ...
  });
});
```

**Acceptance Criteria:**
- ✅ 2+ Browser Instances simuliert
- ✅ Concurrent Edits getestet
- ✅ Soft-Lock Warnings verifiziert
- ✅ Merge-Konflikte getestet
- ✅ Network Failure simuliert

---

## 📋 Zusammenfassung & Timeline (AKTUALISIERT)

**Gesamtaufwand:** ~42-59 Tage (wenn sequentiell)  
**Parallelisierung möglich:** ~24-33 Tage (wenn 2 Devs)

### Kritischer Pfad (P0) - AKTUALISIERT:
```
Week 1 (5 Tage): AI Actions
- Task 1: splitCard (2-3 Tage) ← Dev 1
- Task 2: mergeCards (1-2 Tage) ← Dev 2
- Task 3: reorderCards (1-2 Tage) ← Dev 2

Week 2 (5 Tage): Phase 4.1 Board-Sharing
- Task 10: Share Dialog UI (3-5 Tage) ← Dev 1
- Task 11: NIP-51 Integration (2-3 Tage) ← Dev 2 (parallel)
- Task 12: BoardRole Permissions (1 Tag) ← Dev 2

Week 3 (6 Tage): Phase 2 Mobile + Phase 4.2 UI
- Task 5: Mobile Responsive (4-5 Tage) ← Dev 1 + Dev 2
- Task 13: Presence Indicators (2-3 Tage) ← Dev 1 (parallel)
- Task 14: Live Notifications (1-2 Tage) ← Dev 2 (parallel)

Week 4 (5 Tage): Phase 2 Polish
- Task 6: A11y Testing (2-3 Tage) ← Dev 1
- Task 7: Performance (2-3 Tage) ← Dev 2
- Task 4: Paste Consolidation (0.5 Tage) ← Dev 1 (parallel)
- Task 15: Soft-Lock UI (1-2 Tage) ← Dev 2 (parallel)

Week 5 (4-6 Tage): Testing
- Task 8: Offline Sync Tests (2-3 Tage) ← Dev 1
- Task 9: Auth E2E Tests (1-2 Tage) ← Dev 2
- Task 16: Multi-User E2E Tests (3-4 Tage) ← Dev 1 + Dev 2
```

**Total: ~24-26 Tage mit 2 Devs parallel**

### Phase-Completion nach Tasks:

**Nach Week 1:**
- Phase 3: 90% → **100% COMPLETE** ✅

**Nach Week 2:**
- Phase 2: 15% → **60% COMPLETE** 🟡

**Nach Week 3:**
- Phase 2: 60% → **95% COMPLETE** ✅

**Nach Week 4:**
- Phase 1: 95% → **100% COMPLETE** ✅
- Phase 2: 95% → **100% COMPLETE** ✅

**Deadline-Projektion:**
- Start: 14.11.2025 (Heute + 1 Tag)
- Ende: ~02.12.2025 (18 Arbeitstage)
- **Puffer bis 31.12:** ~29 Tage für Phase 4! ✅

---

## 🎯 Quick Start für Entwickler

### Empfohlene Reihenfolge (1 Developer):
1. **Task 1** (splitCard) - KRITISCH für AI
2. **Task 2** (mergeCards) - Noch KRITISCH
3. **Task 3** (reorderCards) - Noch KRITISCH
4. **Task 4** (Paste Consolidation) - Quick Win (1h)
5. **Task 5** (Mobile Responsive) - Größerer Block
6. **Task 6** (A11y Testing) - Nach Mobile
7. **Task 7** (Performance) - Nach A11y
8. **Task 8** (Offline Sync Tests) - Parallel möglich
9. **Task 9** (Auth E2E Tests) - Parallel möglich

### Empfohlene Reihenfolge (2 Developers):

**Developer 1 (Backend/Logic-Fokus):**
1. Task 1: splitCard (2-3 Tage)
2. Task 5: Mobile Responsive (2 Tage, nur Component Logic)
3. Task 6: A11y Testing (2-3 Tage)
4. Task 8: Offline Sync Tests (2-3 Tage)

**Developer 2 (Frontend/UI-Fokus):**
1. Task 2: mergeCards (1-2 Tage)
2. Task 3: reorderCards (1-2 Tage)
3. Task 4: Paste Consolidation (0.5 Tage)
4. Task 5: Mobile Responsive (2-3 Tage, Styling + Touch)
5. Task 7: Performance (2-3 Tage)
6. Task 9: Auth E2E Tests (1-2 Tage)

**Parallel Total: ~12-15 Tage** ⚡

---

## 📞 Fragen & Support

**Bei Fragen zu dieser Task-Liste:**
- Siehe: `docs/COLLABORATION/ROADMAP.md` für Kontext
- Siehe: `AGENTS.md` für technische Spezifikationen
- GitHub Issues für Diskussionen

**Code-Beispiele:**
- Alle Code-Snippets in diesem Dokument sind Copy-Paste-ready
- Pattern aus bestehendem Code übernommen (actionProcessing.ts, etc.)

**Testing:**
- Unit Tests: Vitest (`*.spec.ts`)
- E2E Tests: Playwright (`e2e/*.spec.ts`)
- Siehe: `docs/TESTSUITE/GUIDE.md` für Details

---

**Erstellt:** 13. November 2025  
**Basis:** ROADMAP.md v3.2 Codebase-Analyse  
**Nächste Überprüfung:** Nach Completion von Task 1-3 (AI Actions)
