/**
 * Theme token helper - maps semantic color names to CSS variable references.
 * Import `t` in any component and use instead of hardcoded hex values.
 *
 * Usage: style={{ color: t.fg, background: t.cardBg, borderColor: t.cardBorder }}
 */
export const t = {
  // Backgrounds
  bg: 'var(--background)',
  cardBg: 'var(--card-bg)',
  cardBgHover: 'var(--card-bg-hover)',
  sidebarBg: 'var(--sidebar-bg)',
  hoverBg: 'var(--hover-bg)',
  activeBg: 'var(--active-bg)',
  inputBg: 'var(--input-bg)',

  // Text
  fg: 'var(--foreground)',
  muted: 'var(--muted)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',
  statValue: 'var(--stat-value)',

  // Borders
  cardBorder: 'var(--card-border)',

  // Accent / semantic
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  success: 'var(--success)',
} as const;
