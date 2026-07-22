// Server-safe theme catalog. Lives in a PLAIN module (no 'use client') so that
// both server components (e.g. the /embed route) and client components can import
// the real THEMES array — importing a runtime value from a 'use client' module
// into a server component yields a client-reference proxy, not the array, which
// crashes at render (THEMES.some is not a function).
export const THEMES = [
  { id: 'ice', name: 'Ice & Azure', swatch: '#1e88d2', bg: '#f5f9fc' },
  { id: 'sky', name: 'Sky Navy', swatch: '#53c1f0', bg: '#10527f' },
  { id: 'teal', name: 'Teal Fresh', swatch: '#109d8d', bg: '#f0faf9' },
  { id: 'sunrise', name: 'Sunrise', swatch: '#d97a06', bg: '#fdfaf3' },
  { id: 'navy', name: 'Deep Navy', swatch: '#2f86c9', bg: '#061826' },
  { id: 'aurora', name: 'Aurora', swatch: '#8b7cf6', bg: '#14123c' },
  { id: 'sand', name: 'Sand', swatch: '#c2653c', bg: '#faf6f0' },
  { id: 'pop', name: 'Pop', swatch: '#4f46e5', bg: '#ffffff' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
