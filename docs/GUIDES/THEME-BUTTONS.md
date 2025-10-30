# Theme-Vorgaben für Buttons und Hover-Effekte

Diese Dokumentation erklärt, wie die Hintergrundfarben und Hover-Effekte für Buttons im Kanban-Board konfiguriert werden.

## 📋 Übersicht

Das Theme-System verwendet CSS-Variablen in Kombination mit Tailwind CSS, um konsistente Button-Stile und Hover-Effekte zu gewährleisten. Die shadcn-svelte Button-Komponente wird durchgehend verwendet.

## 🎨 CSS-Variablen (Definiert in `src/app.css`)

Die folgenden CSS-Variablen steuern die Button-Farben:

### Grundfarben (Light Mode)
```css
:root {
  --primary: oklch(0.606 0.25 292.717);          /* Primärfarbe für Haupt-Buttons */
  --primary-foreground: oklch(0.969 0.016 293.756); /* Textfarbe auf Primär-Buttons */

  --secondary: oklch(0.967 0.001 286.375);      /* Sekundärfarbe */
  --secondary-foreground: oklch(0.21 0.006 285.885);

  --accent: oklch(57.646% 0.26532 315.837);     /* Akzentfarbe für Hover-Effekte */
  --accent-foreground: oklch(0.21 0.006 285.885);

  --destructive: oklch(0.577 0.245 27.325);     /* Destruktive Aktionen */
  --destructive-foreground: oklch(0.969 0.016 293.756);

  --muted: oklch(0.967 0.001 286.375);          /* Gedämpfte Farben */
  --muted-foreground: oklch(0.552 0.016 285.938);
  
  --border: oklch(0.92 0.004 286.32);           /* Rahmenfarben */
  --ring: oklch(0.606 0.25 292.717);            /* Focus-Ring Farbe */
}
```

### Dark Mode Varianten
```css
:root.dark,
.dark {
  --primary: oklch(0.541 0.281 293.009);
  --primary-foreground: oklch(0.969 0.016 293.756);
  
  --secondary: oklch(36.011% 0.06726 297.06);
  --secondary-foreground: oklch(0.985 0 0);
  
  --accent: oklch(57.646% 0.26532 315.837);
  --accent-foreground: oklch(0.985 0 0);
  
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.969 0.016 293.756);
  
  --muted: oklch(48.845% 0.05425 284.209);
  --muted-foreground: oklch(0.705 0.015 286.067);
  
  --border: oklch(51.929% 0.00756 16.972 / 0.781);
  --ring: oklch(0.541 0.281 293.009);
}
```

### Card Colors (für Color Picker)
```css
/* Light Mode */
--color-slate: oklch(88.734% 0.02327 285.861 / 0.945);
--color-blue: oklch(36.012% 0.24863 264.466);
--color-green: #5bd337;
--color-orange: oklch(76.57% 0.15684 77.795);
--color-red: oklch(0.704 0.191 22.216);
--color-purple: oklch(0.541 0.281 293.009);

/* Dark Mode */
--color-slate: oklch(32.579% 0.00353 286.054 / 0.945);
--color-green: #0ef347;
```

## 🎯 Tailwind-Konfiguration

Die CSS-Variablen werden in Tailwind über die shadcn-svelte Konfiguration verfügbar gemacht. Die Button-Komponente verwendet diese Variablen automatisch.

## 🖱️ Hover-Effekte (Definiert in `src/app.css`)

### Allgemeine Button-Transitions
```css
button:hover {
  transition: background-color 0.2s ease, color 0.2s ease;
}
```

### Standard Button Hover
```css
button.btn:hover {
  border: 2px solid var(--border);
  border-color: var(--ring);
}
```

### Primär-Button Hover
```css
button.bg-primary:hover {
  background-color: var(--primary) !important;
  color: var(--primary-foreground) !important;
}
```

### Sekundär-Button Hover  
```css
button.bg-secondary:hover {
  background-color: var(--secondary) !important;
  color: var(--secondary-foreground) !important;
}
```

### Outline-Button Hover
```css
button.border-border:hover {
  background-color: var(--accent) !important;
  color: var(--accent-foreground) !important;
  border-color: var(--accent) !important;
}
```

### Ghost-Button Hover
```css
button.bg-transparent:hover:not(.bg-primary):not(.bg-secondary) {
  background-color: var(--accent) !important;
  color: var(--accent-foreground) !important;
}
```

### Destruktiver Button Hover
```css
button.bg-destructive:hover {
  background-color: var(--destructive) !important;
  color: var(--destructive-foreground) !important;
}
```

### Menu Item Hover
```css
.menu-item:hover {
  background-color: var(--accent) !important;
  color: var(--accent-foreground) !important;
  border-color: var(--accent) !important;
}
```

## 🎨 Verwendung in Svelte-Komponenten

### Import der Button-Komponente
```svelte
import { Button } from "$lib/components/ui/button/index.js";
import IconName from "@lucide/svelte/icons/icon-name";
```

### Primär-Button
```svelte
<Button variant="default">
  <IconName class="mr-2 h-4 w-4" />
  Primärer Button
</Button>
```

### Sekundär-Button
```svelte  
<Button variant="secondary">
  <IconName class="mr-2 h-4 w-4" />
  Sekundärer Button
</Button>
```

### Outline-Button
```svelte
<Button variant="outline">
  <IconName class="mr-2 h-4 w-4" />
  Outline Button
</Button>
```

### Ghost-Button
```svelte
<Button variant="ghost">
  <IconName class="mr-2 h-4 w-4" />
  Ghost Button
</Button>
```

### Destruktiver Button
```svelte
<Button variant="destructive">
  <IconName class="mr-2 h-4 w-4" />
  Löschen
</Button>
```

### Icon-Button
```svelte
<Button variant="default" size="icon">
  <IconName class="h-4 w-4" />
</Button>
```

## 🔧 Anpassung der Farben

### 1. Light Mode anpassen
Ändere die Variablen im `:root`-Block in `src/app.css`:

```css
:root {
  --primary: oklch(0.7 0.2 292.717); /* Helleres Blau */
  --accent: oklch(60% 0.3 315.837);  /* Stärkerer Akzent */
}
```

### 2. Dark Mode anpassen
Ändere die Variablen im `.dark`-Block:

```css
.dark {
  --primary: oklch(0.5 0.3 293.009);  /* Dunkleres Blau */
  --accent: oklch(50% 0.3 315.837);  /* Dunklerer Akzent */
}
```

### 3. Card Colors anpassen
Für die Kartenfarben im Color Picker:

```css
:root {
  --color-blue: oklch(40% 0.3 264.466); /* Blau anpassen */
}

.dark {
  --color-blue: oklch(50% 0.3 264.466); /* Dunkleres Blau */
}
```

## 📱 Responsive Considerations

Die Hover-Effekte sind für Touch-Geräte optimiert und verwenden CSS-Transitions für flüssige Animationen:

```css
button:hover {
  transition: background-color 0.2s ease, color 0.2s ease;
}
```

## 🚀 Best Practices

1. **Konsistenz**: Immer die shadcn-svelte `<Button>` Komponente verwenden
2. **Icons**: Lucide Icons mit korrekter Import-Syntax: `@lucide/svelte/icons/icon-name`
3. **Icon-Position**: Icons immer links vom Text mit `class="mr-2 h-4 w-4"`
4. **Accessibility**: Ausreichender Kontrast zwischen Text- und Hintergrundfarben
5. **Performance**: Transition-Dauer auf 0.2s begrenzen für flüssige Animationen
6. **Dark Mode**: Immer beide Varianten (light/dark) anpassen

## 🔍 Troubleshooting

**Problem**: Hover-Effekte funktionieren nicht
**Lösung**: 
- CSS-Klassen überprüfen: `variant="default"` statt manueller Farbwerte
- Sicherstellen, dass `src/app.css` geladen wird

**Problem**: Farben sehen im Dark Mode falsch aus
**Lösung**: 
- Beide Varianten (`:root` und `.dark`) anpassen
- Kontrast mit Tools wie https://webaim.org/resources/contrastchecker/ prüfen

**Problem**: Icons werden nicht angezeigt
**Lösung**: 
- Korrekten Import verwenden: `import IconName from "@lucide/svelte/icons/icon-name"`
- Nicht: `import { IconName } from "lucide-svelte"`

## 🎯 Aktuelle Implementierungen

### Card Footer Buttons (Card.svelte)
```svelte
<!-- Kommentare Button -->
<Button variant="ghost" size="sm">
  <MessageSquareIcon class="mr-2 h-4 w-4" />
  {localComments.length}
</Button>

<!-- Bearbeiten Button -->
<Button variant="default" size="sm">
  <EditIcon class="mr-2 h-4 w-4" />
  Bearbeiten
</Button>
```

### Column Header Buttons (Column.svelte)
```svelte
<!-- Add Card Button -->
<Button variant="default" size="sm">
  <SquarePlusIcon class="h-4 w-4" />
</Button>

<!-- Delete Column Button -->
<Button variant="destructive" size="sm">
  Spalte löschen
</Button>
```

### Board Add Column Button (Board.svelte)
```svelte
<!-- Neue Spalte hinzufügen -->
<Button variant="outline" size="lg">
  <SquarePlusIcon class="mr-2 h-5 w-5" />
  Neue Spalte hinzufügen
</Button>