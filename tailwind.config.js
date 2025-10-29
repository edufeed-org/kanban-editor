/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background-rgb) / <alpha-value>)',
        foreground: 'hsl(var(--foreground-rgb) / <alpha-value>)',
        card: 'hsl(var(--card-rgb) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground-rgb) / <alpha-value>)',
        popover: 'hsl(var(--popover-rgb) / <alpha-value>)',
        'popover-foreground': 'hsl(var(--popover-foreground-rgb) / <alpha-value>)',
        primary: 'hsl(var(--primary-rgb) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground-rgb) / <alpha-value>)',
        secondary: 'hsl(var(--secondary-rgb) / <alpha-value>)',
        'secondary-foreground': 'hsl(var(--secondary-foreground-rgb) / <alpha-value>)',
        muted: 'hsl(var(--muted-rgb) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground-rgb) / <alpha-value>)',
        accent: 'hsl(var(--accent-rgb) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground-rgb) / <alpha-value>)',
        destructive: 'hsl(var(--destructive-rgb) / <alpha-value>)',
        'destructive-foreground': 'hsl(var(--destructive-foreground-rgb) / <alpha-value>)',
        border: 'hsl(var(--border-rgb) / <alpha-value>)',
        input: 'hsl(var(--input-rgb) / <alpha-value>)',
        ring: 'hsl(var(--ring-rgb) / <alpha-value>)',
      },
    },
  },
}