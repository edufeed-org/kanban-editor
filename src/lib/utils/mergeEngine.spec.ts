import { describe, it, expect } from 'vitest';

// Import the merge function under test
import { threeWayMerge } from './mergeEngine.js';

interface TestScenario {
  name: string;
  description: string;
  base: any;
  mine: any;
  theirs: any;
  expectedConflicts: number;
}

const scenarios: TestScenario[] = [
  {
    name: 'Keine Konflikte',
    description: 'Base + unterschiedliche nicht-überlappende Änderungen',
    base: {
      id: 'card-1',
      heading: 'Original Karte',
      content: 'Original Inhalt',
      labels: [],
      updatedAt: '2025-10-26T10:00:00Z'
    },
    mine: {
      id: 'card-1',
      heading: 'Meine Karte',
      content: 'Original Inhalt',
      labels: ['urgent'],
      updatedAt: '2025-10-26T10:05:00Z'
    },
    theirs: {
      id: 'card-1',
      heading: 'Original Karte',
      content: 'Paul hat Inhalt geändert',
      labels: [],
      updatedAt: '2025-10-26T10:04:00Z'
    },
    expectedConflicts: 0
  },
  {
    name: "Konflikt im Feld 'heading'",
    description: 'Beide haben den Titel geändert',
    base: {
      id: 'card-2',
      heading: 'Original Titel',
      content: 'Inhalt',
      labels: [],
      updatedAt: '2025-10-26T10:00:00Z'
    },
    mine: {
      id: 'card-2',
      heading: 'Mein neuer Titel',
      content: 'Inhalt',
      labels: [],
      updatedAt: '2025-10-26T10:05:00Z'
    },
    theirs: {
      id: 'card-2',
      heading: 'Pauls neuer Titel',
      content: 'Inhalt',
      labels: [],
      updatedAt: '2025-10-26T10:04:00Z'
    },
    expectedConflicts: 1
  },
  {
    name: 'Mehrere Konflikte',
    description: 'Sowohl Titel als auch Content geändert',
    base: {
      id: 'card-3',
      heading: 'Original',
      content: 'Original Content',
      labels: ['todo'],
      updatedAt: '2025-10-26T10:00:00Z'
    },
    mine: {
      id: 'card-3',
      heading: 'Mein Titel',
      content: 'Mein Content',
      labels: ['in-progress'],
      updatedAt: '2025-10-26T10:05:00Z'
    },
    theirs: {
      id: 'card-3',
      heading: 'Pauls Titel',
      content: 'Pauls Content',
      labels: ['done'],
      updatedAt: '2025-10-26T10:04:00Z'
    },
    expectedConflicts: 3
  },
  {
    name: 'Array Merge (Labels)',
    description: 'Unterschiedliche Labels, sollten zusammengefasst werden',
    base: {
      id: 'card-4',
      heading: 'Karte',
      content: 'Inhalt',
      labels: [],
      updatedAt: '2025-10-26T10:00:00Z'
    },
    mine: {
      id: 'card-4',
      heading: 'Karte',
      content: 'Inhalt',
      labels: ['urgent', 'review'],
      updatedAt: '2025-10-26T10:05:00Z'
    },
    theirs: {
      id: 'card-4',
      heading: 'Karte',
      content: 'Inhalt',
      labels: ['urgent', 'needs-help'],
      updatedAt: '2025-10-26T10:04:00Z'
    },
    expectedConflicts: 1
  }
];

describe('threeWayMerge scenarios from merge test page', () => {
  for (const s of scenarios) {
    it(`${s.name} -> expected conflicts: ${s.expectedConflicts}`, () => {
      const result = threeWayMerge(s.base, s.mine, s.theirs);

      const conflicts = result?.conflicts || [];

      expect(conflicts.length).toBe(s.expectedConflicts);

      if (s.expectedConflicts === 0) {
        // no conflicts: result should be defined and contain a merged payload
        expect(result).toBeDefined();
        expect((result as any).merged).toBeTruthy();
        expect((result as any).merged.id).toBe(s.base.id);
      } else {
        // conflicts exist: ensure each conflict references a field name
        for (const c of conflicts) {
          expect(c.field).toBeDefined();
        }
      }
    });
  }
});
