# Theme-Vorgaben für Buttons und Hover-Effekte

Diese Dokumentation erklärt, wie die Hintergrundfarben und Hover-Effekte für Buttons im Kanban-Board konfiguriert werden.

## 📋 Übersicht

Das Theme-System verwendet CSS-Variablen in Kombination mit Tailwind CSS, um konsistente Button-Stile und Hover-Effekte zu gewährleisten.

## 🎨 CSS-Variablen (Definiert in `src/app.css`)

Die folgenden CSS-Variablen steuern die Button-Farben:

### Grundfarben
```css
--primary: oklch(0.606 0.25 292.717);          /* Primärfarbe für Haupt-Buttons */
--primary-foreground: oklch(0.969 0.016 293.756); /* Textfarbe auf Primär-Buttons */

--secondary: oklch(0.967 0.001 286.375);      /* Sekundärfarbe */
--secondary-foreground: oklch(0.21 0.006 285.885);

--accent: oklch(57.646% 0.26532 315.837);     /* Akzentfarbe für Hover-Effekte */
--accent-foreground: oklch(0.21 0.006 285.885);

--destructive: oklch(0.577 0.245 27.325);     /* Destruktive Aktionen */
--destructive-foreground: oklch(0.969 0.016 293.756);
```

### Dark Mode Varianten
```css
--primary: oklch(0.541 0.281 293.009);
--accent: oklch(57.646% 0.26532 315.837);
--destructive: oklch(0.704 0.191 22.216);
```

## 🎯 Tailwind-Konfiguration (`tailwind.config.js`)

Die CSS-Variablen werden in Tailwind verfügbar gemacht:

```javascript
colors: {
  primary: 'hsl(var(--primary) / <alpha-value>)',
  'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
  secondary: 'hsl(var(--secondary) / <alpha-value>)',
  'secondary-foreground': 'hsl(var(--secondary-foreground) / <alpha-value>)',
  accent: 'hsl(var(--accent) / <alpha-value>)',
  'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
  destructive: 'hsl(var(--destructive) / <alpha-value>)',
  'destructive-foreground': 'hsl(var(--destructive-foreground) / <alpha-value>)',
}
```

## 🖱️ Hover-Effekte (Definiert in `src/app.css`)

### Primär-Button Hover
```css
button.bg-primary:hover {
  background-color: hsl(var(--primary) / 0.9) !important;
}
```

### Sekundär-Button Hover  
```css
button.bg-secondary:hover {
  background-color: hsl(var(--secondary) / 0.9) !important;
}
```

### Outline-Button Hover
```css
button.border-border:hover {
  background-color: hsl(var(--accent) / 0.1) !important;
  border-color: hsl(var(--accent)) !important;
}
```

### Ghost-Button Hover
```css
button.bg-transparent:hover:not(.bg-primary):not(.bg-secondary) {
  background-color: hsl(var(--accent) / 0.1) !important;
}
```

### Destruktiver Button Hover
```css
button.bg-destructive:hover {
  background-color: hsl(var(--destructive) / 0.9) !important;
}
```

## 🎨 Verwendung in Svelte-Komponenten

### Primär-Button
```svelte
<Button class="bg-primary text-primary-foreground">
  Primärer Button
</Button>
```

### Sekundär-Button
```svelte  
<Button variant="secondary" class="bg-secondary text-secondary-foreground">
  Sekundärer Button
</Button>
```

### Outline-Button
```svelte
<Button variant="outline" class="border-border">
  Outline Button
</Button>
```

### Ghost-Button
```svelte
<Button variant="ghost" class="bg-transparent">
  Ghost Button
</Button>
```

### Destruktiver Button
```svelte
<Button variant="destructive" class="bg-destructive text-destructive-foreground">
  Löschen
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

### 3. Hover-Effekte anpassen
Die Hover-Opazität kann in den CSS-Regeln angepasst werden:

```css
button.bg-primary:hover {
  background-color: hsl(var(--primary) / 0.8) !important; /* 80% Opazität */
}
```

## 📱 Responsive Considerations

Die Hover-Effekte sind für Touch-Geräte optimiert und werden nur bei hover-fähigen Geräten angezeigt:

```css
@media (hover: hover) {
  button:hover {
    /* Hover-Effekte nur für Geräte mit Maus */
  }
}
```

## 🚀 Best Practices

1. **Konsistenz**: Immer die vordefinierten CSS-Variablen verwenden
2. **Accessibility**: Ausreichender Kontrast zwischen Text- und Hintergrundfarben
3. **Performance**: Transition-Dauer auf 0.2s begrenzen für flüssige Animationen
4. **Dark Mode**: Immer beide Varianten (light/dark) anpassen

## 🔍 Troubleshooting

**Problem**: Hover-Effekte funktionieren nicht
**Lösung**: 
- Tailwind-Konfiguration neu kompilieren: `npm run dev`
- CSS-Klassen überprüfen: `bg-primary` statt manueller Farbwerte

**Problem**: Farben sehen im Dark Mode falsch aus
**Lösung**: 
- Beide Varianten (`:root` und `.dark`) anpassen
- Kontrast mit Tools wie https://webaim.org/resources/contrastchecker/ prüfen