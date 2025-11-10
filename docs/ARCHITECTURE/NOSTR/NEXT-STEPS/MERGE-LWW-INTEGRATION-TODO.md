# 🔗 Integration Action Items: Merge-System + LWW

**Erstellt:** 10. November 2025  
**Abhängig von:** Integration-Analysis-Merge-vs-LWW.md

---

## 📋 Die 3 Fixes (70 Minuten Total)

### 1️⃣ FIX mergeEngine.ts - detectConflict() LWW-aware machen

**Datei:** `src/lib/utils/mergeEngine.ts`

**Was ändert sich:**
```typescript
// BEFORE:
export async function detectConflict(
  session: EditingSession,
  latestEvent: NDKEvent
): Promise<{ conflict: boolean }> { ... }

// AFTER:
export async function detectConflict(
  session: EditingSession,
  latestEvent: NDKEvent
): Promise<{
  conflict: boolean;
  isLWWOlder: boolean;      // ← NEW
  eventTimestamp: number;   // ← NEW
}> { ... }
```

**Implementation Steps:**
```typescript
// Step 1: Extract timestamps
const eventTime = (latestEvent.created_at || 0) * 1000; // Convert to ms
const baseTime = new Date(session.baseTimestamp).getTime();

// Step 2: LWW-Check (Last-Write-Wins)
if (eventTime <= baseTime) {
  console.log('✅ LWW: Event älter als Base - kein Konflikt');
  return {
    conflict: false,
    isLWWOlder: true,
    eventTimestamp: eventTime
  };
}

// Step 3: Event ist neuer, prüfe Inhalts-Konflikt (existing logic)
const latestVersion = JSON.parse(latestEvent.content || '{}');
// ... existing merge logic
```

**Time:** 15 min | **Files:** 1 | **Tests to update:** 3

---

### 2️⃣ FIX cardEditingFlow.ts - Nutze neues detectConflict()

**Datei:** `src/lib/utils/cardEditingFlow.ts` (Lines 60-85)

**Was ändert sich:**
```typescript
// BEFORE:
const { conflict } = await detectConflict(this.currentSession, latestEvent);
return { hasConflict: conflict, latestVersion };

// AFTER:
const { conflict, isLWWOlder } = await detectConflict(
  this.currentSession,
  latestEvent
);

if (isLWWOlder) {
  console.log('✅ Latest event is older (LWW) - skipping merge');
  return { hasConflict: false, latestVersion: null };
}

return { hasConflict: conflict, latestVersion };
```

**Time:** 15 min | **Files:** 1 | **Tests to update:** 2

---

### 3️⃣ FIX MergeConflictDialog.svelte - Zeige Timestamps

**Datei:** `src/routes/cardsboard/MergeConflictDialog.svelte` (Lines ~80-120)

**Was ändert sich:**
```svelte
<!-- BEFORE: Nur Werte, keine Timestamps -->
<h4 class="text-xs font-semibold text-green-600">🟢 Pauls Änderung</h4>
<div class="bg-green-50 border-2 border-green-200 p-3 rounded">
  {formatValue(conflict.theirVersion)}
</div>

<!-- AFTER: Mit Timestamp-Info -->
<h4 class="text-xs font-semibold text-green-600">🟢 Pauls Änderung</h4>
{#if conflict.theirTimestamp}
  <div class="text-xs text-slate-500 bg-green-50 p-1 rounded">
    🕐 Geändert: {new Date(conflict.theirTimestamp * 1000).toLocaleString()}
  </div>
{/if}
<div class="bg-green-50 border-2 border-green-200 p-3 rounded">
  {formatValue(conflict.theirVersion)}
</div>
```

**Step 1:** ConflictingField Interface erweitern
```typescript
export interface ConflictingField {
  // ... existing fields ...
  theirTimestamp?: number;  // ← ADD
}
```

**Step 2:** mergeEngine.ts muss Timestamps zu Conflicts hinzufügen
```typescript
// In threeWayMerge() wo ConflictingField[] erstellt wird:
conflicts.push({
  field: key,
  baseVersion: base[key],
  myVersion: my[key],
  theirVersion: their[key],
  theirTimestamp: their.updatedAt  // ← ADD
});
```

**Time:** 10 min | **Files:** 2 | **Tests to update:** 0 (UI-only)

---

## 🧪 Testing Plan

### Unit Tests (mergeEngine.ts)

```typescript
describe('detectConflict with LWW', () => {
  it('returns isLWWOlder=true wenn event älter als base', async () => {
    const session = { baseTimestamp: new Date('2025-11-10T09:00:00Z') };
    const event = { created_at: 1000000 /* older */ };
    
    const result = await detectConflict(session, event);
    expect(result.isLWWOlder).toBe(true);
    expect(result.conflict).toBe(false);
  });
  
  it('returns conflict=true wenn event neuer und inhalte unterschiedlich', async () => {
    const session = { baseTimestamp: new Date('2025-11-10T09:00:00Z') };
    const event = { created_at: 2000000 /* newer */ };
    
    const result = await detectConflict(session, event);
    expect(result.isLWWOlder).toBe(false);
    expect(result.conflict).toBe(true);
  });
});
```

### E2E Tests (Playwright)

**Scenario 1: Älteres Event wird ignoriert**
```typescript
test('Card edit with older Nostr event - no conflict dialog', async () => {
  // 1. Open card in Browser A (base time: 09:00)
  // 2. In Browser B: Publish older event (created_at: 08:55)
  // 3. Browser A saves changes
  // 4. Verify: ❌ No conflict dialog (LWW older)
  // 5. Verify: ✅ Browser A's version saved
});
```

**Scenario 2: Neueres Event zeigt Timestamps im Dialog**
```typescript
test('Card edit with newer Nostr event - shows timestamps', async () => {
  // 1. Open card in Browser A (base time: 09:00)
  // 2. In Browser B: Publish newer event (created_at: 09:10)
  // 3. Browser A saves changes
  // 4. Verify: ✅ Conflict dialog appears
  // 5. Verify: ✅ Dialog shows timestamp of B's change
  // 6. User chooses version
  // 7. Verify: ✅ Correct version saved
});
```

### Manual Testing

```
Test 1: Two Browser Tabs - Same Board
├─ Tab A: Open Card "Design-System" (base: 09:00)
├─ Tab B: Open Card "Design-System" (base: 09:00)
├─ Tab A: Edit heading to "Annas Version", save at 09:10
├─ Tab B: Edit heading to "Pauls Version", try save at 09:15
├─ Result: ✅ Conflict dialog appears
├─ Result: ✅ Dialog shows timestamps (09:10 vs 09:15)
└─ User: Choose version

Test 2: Older Event should be ignored
├─ Browser: Open Board at 10:00
├─ Relay: Publish old event at 10:05 (but created_at: 09:30)
├─ Browser: Try to save something
├─ Result: ✅ Old event ignored (LWW)
├─ Result: ✅ No conflict dialog
└─ Verify: ✅ Browser's version saved
```

---

## 📝 Files to Modify

```
Priority 1 (Required):
├─ src/lib/utils/mergeEngine.ts
│  └─ detectConflict() function (new LWW logic)
├─ src/lib/utils/cardEditingFlow.ts
│  └─ checkForConflictBeforeSave() method (use LWW)
└─ src/routes/cardsboard/MergeConflictDialog.svelte
   └─ Display theirTimestamp

Priority 2 (Documentation):
├─ docs/INTEGRATION-ANALYSIS-MERGE-vs-LWW.md
│  └─ Add section "✅ IMPLEMENTATION COMPLETE"
└─ docs/FEATURE/MERGE-SYSTEM.md
   └─ Add section "🔗 Integration with Nostr LWW"

Priority 3 (Tests):
├─ src/lib/utils/__tests__/mergeEngine.spec.ts
│  └─ Add LWW test cases (3)
└─ e2e/merge-with-timestamps.spec.ts
   └─ Add E2E scenarios (2)
```

---

## ✅ Definition of Done

```
For this integration to be COMPLETE:

[ ] Code Changes
  [ ] mergeEngine.ts: detectConflict() returns isLWWOlder
  [ ] cardEditingFlow.ts: Handles isLWWOlder case
  [ ] MergeConflictDialog.svelte: Shows timestamps
  [ ] ConflictingField interface: Has theirTimestamp field

[ ] Tests
  [ ] Unit: 3 new LWW test cases (all passing)
  [ ] E2E: 2 new Playwright scenarios (all passing)
  [ ] Manual: 2 manual test scenarios validated
  [ ] No regression in existing tests

[ ] Documentation
  [ ] Update INTEGRATION-ANALYSIS.md with ✅ COMPLETE
  [ ] Update MERGE-SYSTEM.md with LWW section
  [ ] Add comments in code explaining LWW flow
  [ ] Update ROADMAP if needed

[ ] Verification
  [ ] Build passes: pnpm run build
  [ ] Tests pass: pnpm run test:unit
  [ ] Lint passes: pnpm run lint
  [ ] Type check passes: pnpm run check
  [ ] No console warnings in dev
```

---

## 🎯 Next Steps

1. **Entscheide:** Soll diese Integration JETZT gemacht werden (70 min)?
   - JA → Starte mit FIX #1
   - NEIN → Schedule für später (nach Card-Duplication + Background-Sync Fixes)

2. **Bei JA:**
   - [ ] Start mit mergeEngine.ts (15 min)
   - [ ] Dann cardEditingFlow.ts (15 min)
   - [ ] Dann MergeConflictDialog.svelte (10 min)
   - [ ] Dann Tests schreiben (20 min)
   - [ ] Dann Docs aktualisieren (10 min)

3. **Verifizierung:**
   ```bash
   pnpm run test:unit      # Unit tests grün?
   pnpm run test:e2e       # E2E tests grün?
   pnpm run check          # Type check ok?
   pnpm run build          # Build erfolgreich?
   ```

---

**Estimated Time:** 70 minutes  
**Complexity:** 🟠 MEDIUM (conceptual + implementation)  
**Risk:** 🟢 LOW (isolated changes, existing tests cover fallback)  
**Value:** 🟠 MEDIUM (prevents race conditions in edge cases)

