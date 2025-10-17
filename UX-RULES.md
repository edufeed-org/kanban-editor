# SHADCN.md

---

# 🎨 UX Design Regeln für AI-Agenten (Basis: shadcn-svelte)

Der AI-Agent muss bei der Implementierung des UI/UX die folgenden Prinzipien und Regeln strikt befolgen. Die Wahl der Komponenten und deren Konfiguration hat immer die **Konsistenz** mit dem `shadcn-svelte` Designsystem und die **Zugänglichkeit** (Accessibility) zu gewährleisten.

## I. Grundlegende Designprinzipien (Design Philosophy)

1.  **Konsistenz über alles:** Verwende ausschließlich die in `shadcn-svelte` verfügbaren UI-Komponenten. Custom Components (wenn nicht anders beauftragt) müssen in ihrem Aussehen, ihrer Struktur und ihrem Verhalten den bestehenden `shadcn-svelte`-Patterns folgen.
2.  **Minimalismus und Klarheit (Clarity):** Das Design muss "unaufgeregt" wirken (wie das Standard-Theme von `shadcn/ui`). Bevorzuge klare, lesbare Typografie, viel Weißraum und eine reduzierte Farbpalette. Vermeide unnötige Animationen oder visuelle Ablenkungen.
3.  **Zugänglichkeit (Accessibility-First):** Alle interaktiven Elemente müssen über die Tastatur bedienbar sein. Sorge für ausreichenden Farbkontrast und verwende die semantischen HTML-Strukturen, die von `shadcn-svelte` (z.B. bei Button, Dialog, Form) bereitgestellt werden.
4.  **Responsivität:** Das Layout muss nahtlos auf allen Gerätegrößen (Mobil, Tablet, Desktop) funktionieren. Nutze das Tailwind-System für Breakpoints (`sm:`, `md:`, `lg:`, etc.) konsequent.

## II. Komponenten- & Stil-Regeln (Component & Styling Rules)

### A. Farbe und Styling

| Regel | Beschreibung | Konkrete Anweisung für AI-Agent |
| :--- | :--- | :--- |
| **1. Basis-Farbwahl** | Die **`baseColor`** aus der `components.json` ist die Grundlage für Hintergründe, Texte und Ränder (z.B. `slate` im Kontext). | **Bevorzuge neutrale Töne** (Hintergründe, Text, Border) aus der eingestellten `baseColor` (`slate`, `zinc`, etc.). |
| **2. Primäre Aktionen** | Die **`primary`** Farbe muss für die wichtigsten Handlungen (Haupt-Buttons) verwendet werden. | **Verwende `variant="default"`** (Primary Color) nur für die *eine* wichtigste Aktion pro Bildschirm (z.B. "Speichern", "Bestätigen"). |
| **3. Sekundäre Aktionen** | Nicht-kritische, unterstützende oder weniger hervorgehobene Aktionen sollen das Layout nicht dominieren. | **Verwende `variant="outline"`, `secondary`, `ghost` oder `link`** für alle anderen Buttons (z.B. "Abbrechen", "Zurück"). |
| **4. Fehler/Warnungen** | Kritische Handlungen wie Löschen oder Systemfehler müssen die `destructive` Farbe verwenden. | **Verwende `variant="destructive"`** für Aktionen, die unwiderrufliche Datenverluste zur Folge haben (z.B. "Konto löschen"). |

### B. Button-Verwendung (Basierend auf `<Button>` Component)

| Regel | Beschreibung | Konkrete Anweisung für AI-Agent |
| :--- | :--- | :--- |
| **5. Größen-Konsistenz** | Die Größe eines Buttons muss dem Kontext entsprechen, in dem er verwendet wird. | **Standard-Größe (`size="default"`)** für Haupt-Aktionen. **Kleine Größe (`size="sm"`)** für Aktionen innerhalb von Tabellen, Karten oder dichten UI-Bereichen. **Icon-Größe (`size="icon"`)** nur für reine Icon-Buttons (z.B. Suchen-Lupe). |
| **6. Position von Icons** | Icons dienen der visuellen Unterstützung und sollten die Lesbarkeit nicht beeinträchtigen. | Positioniere ein Icon **links** vom Button-Text. Wenn der Platz begrenzt ist, verwende ausschließlich einen `icon`-Button (Regel 5). |
| **7. Deaktivierter Zustand** | Deaktivierte Buttons müssen klar als nicht-interaktiv erkennbar sein. | Setze bei allen Buttons, deren Aktion aktuell nicht möglich ist (z.B. Formular ist ungültig), das **`disabled`**-Prop. |

Die **Auswahl der Icons** findet über https://lucide.dev/ statt. Verwende nur Icons aus diesem Set.
Die Angaben zu Svelte Icons sind allerdings nicht kompatibel mit shadcn-svelte. Verwende stattdessen die `lucide-svelte` Bibliothek aus shadcn-svelte.

Unterschiede deutlich am SquarePlus Icon:
```js
<script lang="ts">
  // import { SquarePlus } from "lucide-svelte"; // Falsch 
  import SquarePlusIcon from "@lucide/svelte/icons/square-plus"; // Richtig
</script>
<Button>
  <SquarePlusIcon class="mr-2 h-4 w-4" /> <!-- Icon links vom Text -->
  Karte hinzufügen  
</Button>
```


### C. Karten & Container (Basierend auf `<Card>` Component)

| Regel | Beschreibung | Konkrete Anweisung für AI-Agent |
| :--- | :--- | :--- |
| **8. Gruppierung** | Verwende `<Card.Root>` als primäres Mittel zur Gruppierung verwandter Inhalte, Aktionen oder Formularfelder. | Jeder logisch zusammenhängende Bereich (z.B. "Einstellungen", "Profilinformationen") muss in einer `Card.Root` gekapselt werden. |
| **9. Struktur-Standard** | Jede Card soll eine klare hierarchische Struktur aufweisen. | **Verwende immer** `<Card.Header>`, `<Card.Title>` und `<Card.Description>` zur Einführung des Inhalts. Platziere Aktionen (Buttons) immer im `<Card.Footer>`. |
| **10. Card vs. Page** | Cards werden zur Strukturierung innerhalb einer Seite verwendet. | **Vermeide** es, die gesamte Seite in eine einzige Card zu verpacken. Die Card soll ein *Modul* der Seite sein, nicht die Seite selbst. |

### D. Formulare & Eingaben (Basierend auf `<Form>`, `<Field>`, `<Input>`, `<Label>` Components)

| Regel | Beschreibung | Konkrete Anweisung für AI-Agent |
| :--- | :--- | :--- |
| **11. Field-Container-Struktur** | Jedes Formularfeld muss in einer `<Field>`-Komponente gekapselt werden. | **Verwende immer** die Struktur: `<Field>` → `<FieldLabel>` → `<FieldContent>` → `<FieldError>`. Dies gewährleistet konsistente Abstände und Zugänglichkeit. |
| **12. Eindeutige Labels** | Jedes Eingabefeld muss ein eindeutiges und sichtbares Label haben. | **Verwende immer `<FieldLabel>`** mit dem `for`-Attribut, das mit der `id` des Input-Elements übereinstimmt. |
| **13. Platzhalter vs. Label** | Platzhalter (Placeholder) dürfen niemals das Label ersetzen. | Verwende `placeholder` nur für *Beispiele* oder *Formatvorgaben*, nicht zur Beschreibung des Feldes (da das Label verschwindet, sobald der Benutzer tippt). |
| **14. Fehlervisualisierung** | Validierungsfehler müssen klar und nahe am betroffenen Eingabefeld dargestellt werden. | Verwende **`<FieldError>`** direkt unter dem Input-Element. Setze zusätzlich `aria-invalid="true"` am Input-Element bei Fehlern. |
| **15. Formular-Validierung** | Alle Formulare müssen eine clientseitige Validierung mit `zod` implementieren. | **Definiere ein Zod-Schema** für jedes Formular. Verwende `safeParse()` zur Validierung und zeige Fehler über `<FieldError>` an. |
| **16. Submit-Button-Zustand** | Der Submit-Button muss während der Verarbeitung deaktiviert sein. | **Verwende einen `isSubmitting` $state**. Setze `disabled={isSubmitting}` am Button und zeige einen alternativen Text (z.B. "Speichern..." statt "Speichern"). |
| **17. Formular-Layout** | Formularfelder sollen vertikal gestapelt werden mit konsistenten Abständen. | **Verwende Tailwind-Klasse `space-y-4`** am Form-Container für einheitliche vertikale Abstände zwischen Feldern. |

**Beispiel: Vollständiges Formular-Pattern**

```svelte
<script lang="ts">
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { z } from "zod";

  // Zod-Schema für Validierung
  const formSchema = z.object({
    title: z.string().min(1, "Titel ist erforderlich").max(100, "Titel zu lang"),
    content: z.string().min(1, "Inhalt ist erforderlich")
  });

  // Form State mit Svelte 5 Runes
  let formData = $state({ title: "", content: "" });
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    // Validierung
    const result = formSchema.safeParse(formData);
    if (!result.success) {
      errors = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      return;
    }

    errors = {};
    isSubmitting = true;
    
    try {
      // Submit-Logik hier
      await submitData(formData);
      formData = { title: "", content: "" }; // Reset
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <Field.Root>
    <Field.Label for="title">Titel</Field.Label>
    <Field.Content>
      <Input 
        id="title" 
        bind:value={formData.title}
        aria-invalid={!!errors.title}
        disabled={isSubmitting}
      />
    </Field.Content>
    <Field.Error errors={errors.title ? [{ message: errors.title }] : undefined} />
  </Field.Root>

  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? "Wird gespeichert..." : "Speichern"}
  </Button>
</form>
```

### E. Modal Windows / Dialoge (Basierend auf `<Dialog>` Component)

| Regel | Beschreibung | Konkrete Anweisung für AI-Agent |
| :--- | :--- | :--- |
| **18. Dialog-Struktur** | Jeder Dialog muss die vollständige Komponentenhierarchie verwenden. | **Verwende immer**: `<Dialog.Root>` → `<Dialog.Trigger>` → `<Dialog.Content>` → `<Dialog.Header>`, `<Dialog.Title>`, `<Dialog.Description>` → Content → `<Dialog.Footer>`. |
| **19. Trigger-Button-Variante** | Der Button, der den Dialog öffnet, sollte die Wichtigkeit der Aktion widerspiegeln. | **Verwende `variant="outline"`** für sekundäre Dialoge (z.B. "Bearbeiten"), **`variant="default"`** für primäre Dialoge (z.B. "Erstellen"). |
| **20. Dialog-Breite** | Dialoge müssen responsive Maximalbreiten haben. | **Verwende Tailwind-Klasse `sm:max-w-[425px]`** für Standard-Dialoge, `sm:max-w-[600px]` für größere Formulare. |
| **21. Dialog-Titel & Beschreibung** | Jeder Dialog muss einen aussagekräftigen Titel und eine optionale Beschreibung haben. | **`<Dialog.Title>`** ist obligatorisch (Accessibility). **`<Dialog.Description>`** sollte den Zweck des Dialogs erklären. |
| **22. Dialog-Aktionen** | Aktions-Buttons müssen im `<Dialog.Footer>` platziert werden. | **Primäre Aktion rechts** (z.B. "Speichern"), **sekundäre Aktion links** (z.B. "Abbrechen"). Verwende `type="submit"` für den primären Button bei Formularen. |
| **23. Dialog-Formulare** | Formulare in Dialogen folgen denselben Regeln wie standalone Formulare. | **Implementiere Validierung**, **deaktiviere Submit während Verarbeitung**, **zeige Fehler inline** (siehe Abschnitt D). |
| **24. Dialog-Schließung** | Dialoge müssen programmatisch und via ESC-Taste schließbar sein. | Die `<Dialog.Root>`-Komponente bietet dies automatisch. Bei Formularen: Schließe Dialog **nur nach erfolgreichem Submit**, nicht bei Fehlern. |

**Beispiel: Dialog mit Formular**

```svelte
<script lang="ts">
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { z } from "zod";

  let open = $state(false);
  let formData = $state({ name: "", email: "" });
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);

  const schema = z.object({
    name: z.string().min(1, "Name erforderlich"),
    email: z.string().email("Ungültige E-Mail")
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    const result = schema.safeParse(formData);
    
    if (!result.success) {
      errors = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      return;
    }

    errors = {};
    isSubmitting = true;
    
    try {
      await saveData(formData);
      open = false; // Schließe Dialog nach Erfolg
      formData = { name: "", email: "" }; // Reset
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger class={buttonVariants({ variant: "outline" })}>
    Profil bearbeiten
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Profil bearbeiten</Dialog.Title>
      <Dialog.Description>
        Nehmen Sie Änderungen an Ihrem Profil vor. Klicken Sie auf Speichern, wenn Sie fertig sind.
      </Dialog.Description>
    </Dialog.Header>
    
    <form onsubmit={handleSubmit}>
      <div class="grid gap-4 py-4">
        <Field.Root>
          <Field.Label for="name">Name</Field.Label>
          <Field.Content>
            <Input 
              id="name" 
              bind:value={formData.name}
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
            />
          </Field.Content>
          <Field.Error errors={errors.name ? [{ message: errors.name }] : undefined} />
        </Field.Root>

        <Field.Root>
          <Field.Label for="email">E-Mail</Field.Label>
          <Field.Content>
            <Input 
              id="email" 
              type="email"
              bind:value={formData.email}
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
            />
          </Field.Content>
          <Field.Error errors={errors.email ? [{ message: errors.email }] : undefined} />
        </Field.Root>
      </div>

      <Dialog.Footer>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Speichern..." : "Änderungen speichern"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
```

### F. Tabs (Basierend auf `<Tabs>` Component)

| Regel | Beschreibung | Konkrete Anweisung für AI-Agent |
| :--- | :--- | :--- |
| **25. Tabs-Struktur** | Tabs müssen die vollständige Komponentenhierarchie verwenden. | **Verwende immer**: `<Tabs.Root>` → `<Tabs.List>` → `<Tabs.Trigger>` (pro Tab) → `<Tabs.Content>` (pro Tab-Panel). |
| **26. Default-Tab** | Ein Tab muss standardmäßig aktiv sein. | **Setze `value` auf `<Tabs.Root>`** mit dem Identifier des ersten/wichtigsten Tabs (z.B. `value="account"`). |
| **27. Tab-Identifier** | Jeder Tab benötigt einen eindeutigen String-Identifier. | **Verwende aussagekräftige, URL-freundliche Identifier** (z.B. `"account"`, `"password"`, `"notifications"`), keine Indizes. |
| **28. Tab-Anzahl** | Die Anzahl der Tabs sollte übersichtlich bleiben. | **Maximum 5-6 Tabs** pro Tabs-Komponente. Bei mehr Kategorien: Verwende eine andere Navigation (z.B. Sidebar, Dropdown). |
| **29. Tab-Content-Organisation** | Jeder Tab-Inhalt sollte in sich geschlossen und logisch gruppiert sein. | **Verwende `<Card>`-Komponenten** innerhalb von `<Tabs.Content>`, um verwandte Informationen zu strukturieren. |
| **30. Responsive Tabs** | Tabs müssen auf kleinen Bildschirmen bedienbar sein. | Die `<Tabs.List>` scrollt automatisch horizontal bei Overflow. **Vermeide zu lange Tab-Labels** (max. 2-3 Wörter). |
| **31. Tab-Content-Laden** | Tab-Inhalte können lazy geladen werden bei aufwändigen Daten. | **Implementiere Conditional Rendering** in `<Tabs.Content>`: Lade Daten erst, wenn der Tab aktiv wird. |

**Beispiel: Tabs mit Formularen**

```svelte
<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Card from "$lib/components/ui/card";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";

  let activeTab = $state("account");
  
  let accountData = $state({ username: "", email: "" });
  let passwordData = $state({ current: "", new: "" });
</script>

<div class="flex w-full max-w-2xl flex-col gap-6">
  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="grid w-full grid-cols-2">
      <Tabs.Trigger value="account">Konto</Tabs.Trigger>
      <Tabs.Trigger value="password">Passwort</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="account">
      <Card.Root>
        <Card.Header>
          <Card.Title>Konto</Card.Title>
          <Card.Description>
            Nehmen Sie Änderungen an Ihrem Konto vor.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <Field.Root>
            <Field.Label for="username">Benutzername</Field.Label>
            <Field.Content>
              <Input id="username" bind:value={accountData.username} />
            </Field.Content>
          </Field.Root>
          
          <Field.Root>
            <Field.Label for="email">E-Mail</Field.Label>
            <Field.Content>
              <Input id="email" type="email" bind:value={accountData.email} />
            </Field.Content>
          </Field.Root>
        </Card.Content>
        <Card.Footer>
          <Button>Änderungen speichern</Button>
        </Card.Footer>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="password">
      <Card.Root>
        <Card.Header>
          <Card.Title>Passwort</Card.Title>
          <Card.Description>
            Ändern Sie Ihr Passwort hier.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <Field.Root>
            <Field.Label for="current">Aktuelles Passwort</Field.Label>
            <Field.Content>
              <Input id="current" type="password" bind:value={passwordData.current} />
            </Field.Content>
          </Field.Root>
          
          <Field.Root>
            <Field.Label for="new">Neues Passwort</Field.Label>
            <Field.Content>
              <Input id="new" type="password" bind:value={passwordData.new} />
            </Field.Content>
          </Field.Root>
        </Card.Content>
        <Card.Footer>
          <Button>Passwort ändern</Button>
        </Card.Footer>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>
```

**Beispiel: Tabs mit bedingtem Content-Laden**

```svelte
<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";

  let activeTab = $state("overview");
  let detailsLoaded = $state(false);
  
  $effect(() => {
    // Lade Details nur, wenn der Details-Tab aktiv wird
    if (activeTab === "details" && !detailsLoaded) {
      loadDetails();
      detailsLoaded = true;
    }
  });

  async function loadDetails() {
    // Daten laden...
  }
</script>

<Tabs.Root bind:value={activeTab}>
  <Tabs.List>
    <Tabs.Trigger value="overview">Übersicht</Tabs.Trigger>
    <Tabs.Trigger value="details">Details</Tabs.Trigger>
    <Tabs.Trigger value="settings">Einstellungen</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="overview">
    <!-- Immer geladener Content -->
  </Tabs.Content>

  <Tabs.Content value="details">
    {#if detailsLoaded}
      <!-- Geladene Details -->
    {:else}
      <p>Lade Details...</p>
    {/if}
  </Tabs.Content>

  <Tabs.Content value="settings">
    <!-- Settings Content -->
  </Tabs.Content>
</Tabs.Root>
```

## III. Technische Konventionen (Technical Rules)

1.  **Tailwind-Merge (`cn()`):** Verwende die Utility-Funktion `cn()` (`$lib/utils`) für alle Class-Zuweisungen, um konsistente Overrides zu gewährleisten und die Lesbarkeit zu verbessern.
2.  **Varianten-Verwendung:** Nutze die in `shadcn-svelte` vordefinierten Variants (z.B. `variant="outline"`, `size="lg"`) und vermeide es, diese Styles manuell mit Utility-Klassen neu zu implementieren.
3.  **Svelte 5 Runes:** Nutze moderne Svelte-Features (`$state`, `$derived`, `$props`, `$effect`) für das lokale State-Management und die Logik innerhalb der Komponenten.
4.  **Code-Qualität:** Der generierte Code muss sauber, gut kommentiert und leicht lesbar sein, den Best Practices von Svelte/SvelteKit entsprechen und die Alias-Pfade aus `components.json` verwenden (z.B. `$lib/components/ui/button`).
5.  **Zwei-Wege-Datenbindung:** Verwende `bind:value` für Formulareingaben und `bind:open` für Dialoge/Modals, um den State synchron zu halten.
6.  **Event-Handler:** Verwende die Svelte 5 Syntax `onclick`, `onsubmit` etc. (lowercase) statt `on:click`, `on:submit`.

# UI der Gesamtanwendung

## Topbar
- Logo (links oben)
- Einstellungen (rechts oben) → öffnet **Sheet**
    - Relays verwalten (local für draft / public für publish)
    - default n8n webhook URL
- Hilfe (rechts oben) → öffnet **Drawer**
- Profile (rechts oben) → öffnet **Dropdown Menu**
    - Nostr Profile
    - Login/Logout
    - User Settings verwalten (npub, nip05, url etc.)
- Theme Switcher (rechts oben) → toggelt zwischen Light/Dark/Auto

## Linke Sidebar (Board Liste Bereich)
- Liste meiner Boards (Ähnlich wie ChatGPT Chat Liste) hinter jedem Board ein Button zum Menü (Rename, Delete, Share in nostr, Export, Import)
- Button "Neues Board" → öffnet **Dialog** zur Board-Erstellung
- Button "Import Board" → öffnet **Dialog** zum JSON-Import

## Rechte Sidebar (KI-Agent Bereich)
- Status des aktuellen Boards (Aktuelle Spalte, Aktuelle Karte, etc)
- KI-Agent (recherchiert, organisiert Inhalte des Boards, schlägt Verbesserungen vor)
- Button "KI-Agent aktivieren/deaktivieren"

## Hauptbereich
Board Kopfbereich (Titel, Beschreibung, Tags, Autoren) mit Spalten und Karten (Drag & Drop fähig)
+ **Drawer** für inhaltliche Zusammenfassung des Boards (KI-gestützt)

### Spalten im Board
- Jede Spalte hat oben rechts Button mit drei Punkten untereinander → öffnet **Popover** mit Spalten-Aktionen:
  - Rename (Input)
  - Color (Fieldset Radio Buttons)
  - Delete
- Rechts unten Button "Karte hinzufügen" → öffnet **Dialog** zum Erstellen einer neuen Karte

### Karten in der Spalte
- Jede Karte hat oben rechts Button mit drei Punkten untereinander → öffnet **Popover** mit Karten-Aktionen:
  - Rename (Input)
  - Color (Fieldset Radio Buttons)
  - Edit → öffnet **Dialog** zum Bearbeiten
  - Delete
- Eine Karte (Card Component) besteht aus:
  - **Header**: Titel, Label, publish toggle
  - **Content**: Beschreibung, Links
  - **Footer**: Anzahl der Kommentare, Anzahl der Beteiligten, Actions (View, Edit)

### Karten-Modal (View & Edit)
- Verwendet **`<Dialog>`-Komponente** mit **`<Tabs>`** für verschiedene Ansichten:
  - **Tab "Details"**: Titel, Label, publish toggle, Beschreibung, Links
  - **Tab "Kommentare"**: Liste der Kommentare, Input für neuen Kommentar
  - **Tab "Verlauf"**: Änderungshistorie (optional)
- **Dialog.Header**: Karten-Titel und Status-Indicator
- **Dialog.Content**: Tabs mit Content
- **Dialog.Footer**: Aktions-Buttons (Speichern, Abbrechen, Löschen)

# Svelte Runes & State Management

- **Angeklickte Karte**: `$selectedCard` (State)
- **Angeklickte Spalte**: `$selectedColumn` (State)
- **Aktuelles Board**: `$currentBoard` (State)
- **Board-Statistiken**: `$stats` (Derived State) - wird in der Rechten Sidebar (Debug Section) angezeigt
- **Hervorhebung**: Ausgewählte Spalten und Karten verwenden `class="border-2 border-primary"` zur visuellen Hervorhebung

**Beispiel State-Management:**

```typescript
// kanbanStore.ts
import { writable, derived } from 'svelte/store';

export const selectedCard = writable<Card | null>(null);
export const selectedColumn = writable<Column | null>(null);
export const currentBoard = writable<Board | null>(null);

export const stats = derived(
  [currentBoard, selectedCard, selectedColumn],
  ([$board, $card, $column]) => ({
    totalCards: $board?.columns.reduce((sum, col) => sum + col.cards.length, 0) ?? 0,
    totalColumns: $board?.columns.length ?? 0,
    selectedCardId: $card?.id,
    selectedColumnId: $column?.id
  })
);
```