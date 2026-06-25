# Project Design Instructions

Use this guide whenever changing UI in this project. It complements
`templates/context/ui-context.md` and should be followed across the
internal software app, public website, and mobile app.

## Core Principles

- Use existing design tokens and components before adding custom styles.
- Keep UI dense, practical, and predictable for school operations.
- Prefer neutral system colors for content states and layout hierarchy.
- Use the punch/red brand color for primary actions and public branding.
- Support light and dark mode for every new internal web UI state.
- Avoid one-off colors unless the feature already has an established
  domain color pattern.

## Internal Software App

The internal app lives in `frontend/software`.

### Layout

- Use `TopBar` for page headers.
- Page title should be clear and action-oriented.
- Subtitle should briefly explain the page purpose.
- Primary page action belongs on the right side of `TopBar`.
- Use dense spacing suitable for admin work: compact controls, tables,
  dialogs, cards, and filters.
- Do not create unrelated page shells when the existing layout already
  supports the page.

### Components

Use existing shadcn-style components from:

```text
frontend/software/src/components/ui
```

Prefer these for normal UI:

- `Button`
- `Dialog`
- `Sheet`
- `Alert`
- `AlertDialog`
- `Input`
- `Label`
- `Tabs`
- `DataTable`
- cards and badges where already used

Do not edit generated/shared UI primitives unless the change is truly
design-system-wide.

### Buttons

- Default primary actions should use the default `Button` variant.
- The default button is the punch/red primary design-system button.
- Use `outline` for secondary/non-primary actions.
- Use `secondary` only where existing screens use it for low-emphasis
  neutral actions.
- Use `destructive` only for delete/remove/danger actions.
- Do not manually apply punch classes to individual buttons unless the
  shared button variants cannot express the required state.

Examples:

```jsx
<Button>Assign Subjects</Button>
<Button variant="outline">Cancel</Button>
<Button variant="destructive">Delete</Button>
```

### Colors

Use existing Tailwind/theme tokens:

- `bg-background`
- `text-foreground`
- `text-muted-foreground`
- `bg-muted`
- `bg-muted/40`
- `bg-accent`
- `text-accent-foreground`
- `border-border`
- `border-input`
- `ring-ring`
- `bg-punch-50`
- `bg-punch-600`
- `border-punch-600`

Use punch/red for:

- primary buttons
- public website brand emphasis
- important brand accents

Use neutral colors for:

- selected rows inside dialogs
- table rows
- secondary controls
- non-critical highlights
- hover states
- disabled/empty/helper states

Do not use green as a generic selected state unless the state means
success, approval, paid, present, or another positive semantic state.

### Dark Mode

Every new internal web UI state must include dark-mode-safe styling.

Good examples:

```jsx
"bg-background text-foreground dark:bg-input/30"
"bg-muted/70 dark:bg-muted/30"
"hover:bg-muted/40 dark:hover:bg-muted/20"
"border-border dark:border-border"
```

Avoid hardcoded light-only colors such as:

```text
bg-green-50
bg-red-50
text-gray-700
border-gray-200
```

unless paired with appropriate dark-mode classes and the semantic color
is intentional.

### Dialogs

- Dialogs must include a `DialogTitle`.
- Dialogs should include a `DialogDescription` unless the content is
  already described by accessible text.
- Dialog content should use neutral backgrounds and borders.
- Selected items inside dialogs should use neutral highlight states,
  not brand colors unless the selection is the primary brand action.
- Footer actions should put the main action on the right.
- Dialogs with long content should use:

```jsx
<DialogContent className="max-h-[85vh] overflow-y-auto">
```

### Forms and Select Controls

Native `select` elements should visually match input controls:

```jsx
className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
```

Use neutral colors for select variants unless the value has semantic
meaning. If a select option controls a type or category, use muted,
background, and accent tokens rather than arbitrary colors.

### Checkboxes

Native checkboxes should be styled consistently:

```jsx
className="size-4 rounded border-border accent-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:accent-stone-300 dark:focus-visible:ring-offset-background"
```

Use neutral checkbox accents for normal selection.
Use semantic colors only for true semantic states.

### Tables

- Use `DataTable` for tabular internal app data unless a page already
  has a specialized table.
- Table data should be readable, compact, and horizontally safe.
- Use clear columns and avoid hiding operationally important values.
- Empty states should be short and practical.
- Status badges should use semantic colors through existing table
  conventions where possible.

### Navigation

- Sidebar headings should be uppercase, small, muted, and clearly
  separate from child tabs.
- Child tabs should be indented to show hierarchy.
- Only the active route should be highlighted.
- Do not point two sidebar tabs to the same route unless they represent
  the same destination intentionally.
- Prefer adding a dedicated page route when two tabs represent distinct
  workflows.

### Alerts and Toast-Like Notices

- Use existing `Alert` variants.
- Use destructive alerts only for real errors.
- Success notices should be concise and auto-dismiss where current page
  patterns already do that.

## Public Website

The public website lives in `frontend/website`.

- Keep public pages visually aligned with the existing punch/red brand.
- Use existing section layouts and config-driven page structure.
- Do not import internal LMS components into the public website.
- Keep website pages more spacious and presentation-focused than the
  internal software app.
- Public content should remain visitor-friendly and responsive.

## Mobile App

The mobile app lives in `frontend/mobile`.

- Use React Native `StyleSheet`, not Tailwind web classes.
- Use `useAppTheme` and values from the mobile theme.
- Use existing `AppShellScreen`, safe-area header, floating tab nav,
  and module patterns.
- Keep touch targets comfortable and lists readable.
- Do not share web UI components with mobile.
- Preserve dark-mode behavior for every new mobile screen or component.

## Accessibility

- Dialogs need title and description.
- Buttons need accessible text or an `aria-label` when icon-only.
- Inputs and selects should have visible labels.
- Focus states should remain visible.
- Do not remove outlines without replacing them with accessible focus
  rings.

## Implementation Checklist

Before finishing a UI change:

1. Reuse existing components and tokens.
2. Verify the primary action uses the correct button variant.
3. Confirm selected, hover, focus, and disabled states work in dark mode.
4. Ensure dialogs have title and description.
5. Check sidebar active states if navigation changed.
6. Run the relevant validation:
   - Internal software: `npm.cmd run lint` and usually `npm.cmd run build`
   - Public website: `npm.cmd run lint` and `npm.cmd run build`
   - Mobile: `npm run typecheck`
