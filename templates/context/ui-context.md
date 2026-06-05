# UI Context

## Theme

The project has three UI surfaces with related but distinct needs:

- Internal software: dense, practical LMS operations UI with sidebar
  navigation, data tables, dialogs, forms, cards, charts, and
  permission-aware route visibility.
- Public website: branded informational site for school, college, and
  computer sections using the punch/red palette and public section
  layouts.
- Mobile app: compact role-aware portal with top header, floating tab
  navigation, light/dark theme support, and module tabs.

## Colors

Use the existing theme variables first. Do not introduce unrelated
one-off color systems for normal UI work.

| Role | CSS Variable / Token | Value |
| ---- | -------------------- | ----- |
| Web background | `--background` | `oklch(1 0 0)` light, `oklch(0.145 0 0)` dark |
| Web foreground | `--foreground` | `oklch(0.145 0 0)` light, `oklch(0.985 0 0)` dark |
| Web card | `--card` | `oklch(1 0 0)` light, `oklch(0.205 0 0)` dark |
| Web muted text | `--muted-foreground` | `oklch(0.556 0 0)` light, `oklch(0.708 0 0)` dark |
| Web border | `--border` | `oklch(0.922 0 0)` light, `oklch(1 0 0 / 10%)` dark |
| Brand primary | `--color-punch-600` | `hsl(3, 75%, 49%)` |
| Brand dark | `--color-punch-900` | `hsl(2, 65%, 31%)` |
| Brand light | `--color-punch-50` | `hsl(5, 86%, 97%)` |
| Mobile background | `theme.bg` | `#f8fafc` light, `#0f172a` dark |
| Mobile card | `theme.card` | `#ffffff` light, `#111827` dark |
| Mobile text | `theme.text` | `#0f172a` light, `#f8fafc` dark |
| Mobile border | `theme.border` | `#e2e8f0` light, `#334155` dark |

## Typography

| Role | Font | Variable / Source |
| ---- | ---- | ----------------- |
| Public website UI | Inter | `--font-inter` |
| Public website headings | Inter via Lato alias | `--font-lato` |
| Internal web UI | Tailwind/shadcn defaults plus project font tokens | `frontend/software/src/index.css` |
| Mobile UI | System | `mobileTheme.ts` typography |

## Border Radius

| Context | Class / Token |
| ------- | ------------- |
| Base web radius | `--radius: 0.625rem` |
| Small web UI | `rounded-sm`, `rounded-md` |
| Cards / panels | `rounded-lg`, `rounded-xl` as used by existing components |
| Modals / overlays | Existing `Dialog`, `Sheet`, and `AlertDialog` component radius |
| Mobile icon buttons | Existing fixed radii in StyleSheet, commonly `12` |
| Mobile floating nav / sheet | Existing larger radii, commonly `34` |

## Component Library

Internal software uses shadcn-style components on Tailwind in
`frontend/software/src/components/ui`. Reuse these components for
buttons, dialogs, dropdowns, cards, tables, tabs, sheets, tooltips,
badges, alerts, and form primitives.

The public website has its own component folders under
`frontend/website/src/components`; keep public-facing components
consistent with those layouts instead of importing internal LMS UI.

Mobile uses React Native `StyleSheet`, Ionicons, and the app theme
provider. Do not try to share Tailwind web components with mobile.

## Layout Patterns

- Internal software: protected `Layout` shell, sidebar navigation,
  top bar, route pages, data tables, cards, filters, and dialogs.
- Internal route gating: `ProtectedRoute`, `PublicRoute`,
  `PermissionRoute`, and role-aware route config.
- Public website: root home plus section layouts for `/college`,
  `/school`, and `/computer`.
- Public pages: use section config and page/layout components rather
  than duplicating navigation.
- Mobile: `AppShellScreen` with safe-area header, visible tabs,
  floating bottom nav, and More sheet for secondary modules.
- Mobile modules: tab content should stay independently renderable and
  avoid changing global navigation structure unnecessarily.

## Icons

Internal software uses `lucide-react` for route icons and action
icons. Public website may use existing local components/icons where
already established. Mobile uses `@expo/vector-icons/Ionicons`.
