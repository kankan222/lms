# LMS UI Redesign Instructions for Codex

## Goal
Redesign the existing school/LMS admin UI so it feels like a polished SaaS product while keeping the current functionality, routing, data structure, and shadcn component usage intact.

This is not a full redesign from scratch. Improve the existing screens through better spacing, hierarchy, components, colors, cards, tables, empty states, and page-level consistency.

The product should feel:

- Clean
- Trustworthy
- Fast
- School-operations focused
- Modern SaaS, not old Bootstrap admin panel
- Light, calm, and professional

Use the existing accent color `punch` for primary actions and brand highlights. Do not replace the brand color unless technically necessary.

---

# Global Design Direction

## Visual Style
Use a modern shadcn-style admin interface inspired by Linear, Stripe Dashboard, Notion, and Attio.

Avoid:

- Overly colorful gradients
- Heavy shadows
- Loud borders
- Too many red buttons
- Dense Bootstrap-like cards
- Generic CRUD layout
- Every screen looking like a plain database table

Prefer:

- Soft gray app background
- White cards
- Subtle borders
- Soft shadows
- Clear section hierarchy
- Better spacing
- Better empty states
- Consistent buttons
- Better table row styling
- Badges/status pills
- Icon + text combinations

---

# Design Tokens

## Backgrounds
Use these semantic variables where possible. If variables already exist, map them to these values instead of hardcoding everywhere.

```css
--app-bg: #f8fafc;
--surface: #ffffff;
--surface-muted: #f1f5f9;
--border-soft: #e5e7eb;
--text-primary: #0f172a;
--text-secondary: #64748b;
--text-muted: #94a3b8;
```

The main content area should use `--app-bg`, not pure white.

Cards, tables, forms, and panels should use `--surface`.

## Accent Color
Keep the current brand accent `punch`.

Use `punch` only for:

- Primary CTA buttons
- Active nav indicator
- Important icons
- Selected states
- Small highlights

Do not use punch for delete/destructive actions unless the brand color itself is red and already configured as such. If punch is red, still separate destructive actions visually using shadcn `destructive` variant.

## Destructive Color
Delete actions must use destructive styling only.

```tsx
<Button variant="destructive" size="icon" />
```

Do not use the primary button style for delete buttons.

## Border Radius
Use consistent radius:

```css
--radius-card: 1rem;
--radius-control: 0.75rem;
--radius-badge: 999px;
```

Recommended:

- Cards: `rounded-2xl`
- Inputs/selects/buttons: `rounded-xl`
- Badges: `rounded-full`

## Shadows
Use subtle shadows only.

```tsx
className="shadow-sm border border-border/60"
```

Avoid large shadows.

---

# Layout Rules

## Main App Shell
The app should have three clear layers:

1. Sidebar
2. Topbar
3. Content area

Main content should have:

```tsx
className="min-h-screen bg-slate-50"
```

Page container:

```tsx
className="px-6 py-6 lg:px-8 space-y-6"
```

Do not let page sections touch the browser edge.

## Page Header Pattern
Every page should use the same header component.

Structure:

```tsx
<PageHeader
  title="Students"
  description="Manage student records, academic details, and contact information."
  actions={...}
/>
```

Visual rules:

- Title: `text-3xl font-semibold tracking-tight text-slate-950`
- Description: `text-sm text-muted-foreground mt-1`
- Actions aligned right
- Use consistent gap between action buttons

Do not use vague descriptions like `Find all students here`.

Replace with useful descriptions.

Examples:

- Classes: `Manage class levels, sections, streams, and assigned subjects.`
- Subjects: `Create subjects and assign them to classes and student groups.`
- Attendance: `Record student attendance and review teacher/device logs.`
- Fees: `Manage fee structures, installments, and admission pricing.`
- Payments: `Record, filter, export, and print student fee payments.`

---

# Sidebar Redesign

## Current Problem
The sidebar works, but it feels old and compressed.

## Required Improvements

- Increase nav item height to around `44px` or `48px`
- Use softer active background
- Use punch as active left indicator or icon color
- Improve section label spacing
- Keep icons aligned to a fixed width
- Make text slightly darker for active item
- Keep inactive text muted

## Suggested Classes

```tsx
const navItemClass = cn(
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
  active
    ? "bg-primary/10 text-primary shadow-sm"
    : "text-muted-foreground hover:bg-muted hover:text-foreground"
)
```

Section labels:

```tsx
className="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
```

Sidebar background:

```tsx
className="border-r bg-white"
```

Bottom user block:

- Use avatar/initial circle
- Show email smaller
- Keep it visually separated with border top

---

# Topbar Redesign

## Required Improvements

- Keep topbar sticky
- Use white background with subtle border bottom
- Improve search field width and visual polish
- Icon buttons should use shadcn `Button variant="ghost" size="icon"`
- Logo/avatar should be consistent size

Topbar class:

```tsx
className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/90 px-6 backdrop-blur"
```

Search:

```tsx
className="h-10 w-[320px] rounded-xl bg-slate-50"
```

Icon buttons:

```tsx
<Button variant="ghost" size="icon" className="rounded-xl" />
```

---

# Reusable Components To Create/Update

Create or standardize these components:

## 1. PageHeader
Used on every page.

Props:

```ts
title: string
description?: string
actions?: React.ReactNode
```

## 2. StatCard
Used for dashboard and fees page.

Props:

```ts
title: string
value: string | number
description?: string
icon?: React.ReactNode
tone?: "blue" | "green" | "purple" | "amber" | "rose" | "slate"
trend?: string
```

Style:

- `rounded-2xl`
- `border`
- `bg-white`
- `p-5`
- subtle top gradient based on tone
- value large and dominant

## 3. DataTableWrapper
Used for Students, Payments, device mapping, attendance lists.

Style:

```tsx
<Card className="overflow-hidden rounded-2xl border border-border/60 shadow-sm">
```

Table header:

```tsx
className="bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
```

Rows:

```tsx
className="hover:bg-slate-50/80 transition-colors"
```

## 4. EmptyState
Used when no records or when user must select filters first.

Props:

```ts
icon?: React.ReactNode
title: string
description?: string
action?: React.ReactNode
```

Example:

```tsx
<EmptyState
  icon={<ClipboardList />}
  title="Select a class and section"
  description="Load a roster to begin recording attendance."
  action={<Button>Choose Class</Button>}
/>
```

## 5. ActionMenu
For repeated edit/delete actions.

Replace repeated visible `Edit` + `Delete` buttons in table rows with a dropdown menu where appropriate.

Use visible buttons only when there are very few cards. In dense tables, use dropdown action menu.

---

# Button Rules

## Primary Actions
Use punch/primary:

- Add Student
- Add Subject
- Add Fee
- Record Payment
- Save Mapping
- Submit Attendance
- Assign Subjects

```tsx
<Button className="rounded-xl shadow-sm">Add Student</Button>
```

## Secondary Actions
Use outline or secondary:

- Filters
- Refresh
- Download CSV
- Bulk Upload CSV
- Choose Student Subjects

```tsx
<Button variant="outline" className="rounded-xl">Filters</Button>
```

## Delete Actions
Use destructive variant:

```tsx
<Button variant="destructive" size="icon" className="rounded-xl">
  <Trash2 className="size-4" />
</Button>
```

Do not use the primary brand color for delete actions unless destructive is intentionally mapped.

---

# Dashboard Page Instructions

## Current Problem
Dashboard is the best-looking page, but the cards still feel generic and the page lacks school identity.

## Required Changes

### 1. Add Dashboard Hero
At the top, under the page header, add a compact hero card.

Content example:

```txt
Good Morning
Kalong Kapili Vidyapith
Daily operational summary for the active academic session.

Quick metrics:
- 750 Students
- 2 Teachers
- 0% Attendance Marked
- ₹97,000 Outstanding
```

Style:

- White card
- Soft punch accent border or gradient
- School logo/crest on right if available
- Quick actions row: `Take Attendance`, `Record Payment`, `Add Student`

### 2. Redesign Stat Cards
Use `StatCard` component.

Cards:

- Student Base
- Teaching Staff
- Monthly Collection
- Outstanding Fees
- Upcoming Exams
- New Admissions

Number should be visually dominant.

Bad current pattern:

```txt
STUDENT BASE
750
0% marked present today
```

Better:

```txt
750
Students
0% attendance marked today
```

### 3. Charts
Wrap charts in polished cards.

Chart cards should have:

- Title
- Short useful description
- Optional mini legend
- Empty state if no meaningful data

---

# Classes Page Instructions

## Current Problem
Class cards feel like raw database records.

## Required Changes

### Class Card Structure
Each class card should show:

- Class name as main title without `Class :`
- Scope badge: `School` / `Higher Secondary`
- Sections count
- Subjects count
- Optional streams count
- Primary action: `Manage`
- Secondary actions in dropdown: `Edit`, `Delete`

Example layout:

```txt
Nursery                         School
2 Sections
1 Subject
Medium: English, Assamese

[Manage]                       [...]
```

Do not show long bullet lists as the primary layout.

### Visual Style

```tsx
<Card className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
```

Use badges:

```tsx
<Badge variant="secondary">School</Badge>
```

Button rules:

- Manage = primary or outline
- Edit/Delete = DropdownMenu

---

# Subjects Page Instructions

## Current Problem
Subject cards are too plain and the red subject icon is too dominant.

## Required Changes

Each subject card should show:

- Subject name
- Code badge
- Assigned class count if available
- Subject type/status if available
- Icon in soft tinted square

Example:

```txt
[Book Icon] Assamese
Code: ASS
Assigned to 3 classes
```

Icon background:

```tsx
className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
```

Do not make the icon block full punch/red unless intentionally subtle.

Actions:

- Use dropdown menu or compact buttons
- Delete destructive only

---

# Assign Teacher / Teacher Device Mapping Page Instructions

## Current Problem
This page is functional but looks like a plain form dumped above a table.

## Required Changes

### Split Into Two Cards

1. `Create Mapping` card
2. `Existing Mappings` card

Create Mapping card:

- Title
- Short description
- Device select
- Machine User ID input
- Teacher select
- Save Mapping button

Use a clean grid:

```tsx
className="grid gap-4 md:grid-cols-4"
```

Existing Mappings card:

- Header with title and Refresh button
- Filter row
- Table

Table should use `DataTableWrapper`.

Use badges for device names if helpful.

---

# Assign Subject to Class Page Instructions

## Current Problem
Cards are too wide and empty. The right side contains lonely badges floating in whitespace.

## Required Changes

Use accordion-style class cards.

Each class card header:

```txt
Nursery                         School
1 assigned subject              [Assign/Edit]
```

Inside card:

- Subject rows
- Subject name
- Type badge: Compulsory/Elective
- Section/Stream badges

Make subject row look like a nested item:

```tsx
className="rounded-xl border bg-slate-50 p-4"
```

Avoid huge empty horizontal space.

Badges should be closer to their related subject, not floating at the far right of the card.

---

# Students Page Instructions

## Current Problem
This is one of the strongest pages. It needs polish, not redesign.

## Required Changes

### Top Actions
Group actions logically:

Left:
- Page title/description

Right:
- Refresh
- Filters
- Import/Export dropdown
- Add Student

Replace separate `Download CSV Format` and `Bulk Upload CSV` buttons with one dropdown:

```txt
Import / Export
- Download CSV Format
- Bulk Upload CSV
- Export Current List
```

### Table Improvements

Add student avatar/initials.

Student cell:

```txt
[PM] Payel Mollick
     KKV-1038
```

Academic cell:

```txt
HS 2nd Year • Roll 43
2026-2027 • Higher Secondary
```

Gender badge:

- Male: soft green/blue
- Female: soft pink
- Other/Unknown: slate

Actions:

Use dropdown action menu:

```txt
View Profile
Edit
Delete
```

Keep delete destructive inside menu.

### Table Density
Rows can stay tall, but make spacing consistent.

Use hover background.

---

# Attendance Page Instructions

## Current Problem
Attendance page is clean but feels empty and unfinished before data loads.

## Required Changes

### Tabs
Use shadcn Tabs component properly.

Tabs should look like a segmented control or clean underline tabs.

Avoid full-width labels spread too far apart.

Recommended:

```tsx
<TabsList className="grid w-full max-w-3xl grid-cols-5 rounded-xl bg-slate-100 p-1">
```

### Attendance Entry Card
Use one main card.

Inside:

1. Class/date selection section
2. Action buttons section
3. Roster table section

### Empty Roster State
Replace plain text with EmptyState:

```txt
Select a class and section
Load a roster to begin recording attendance.
```

Add icon.

### Action Buttons

- Load Students: outline
- Mark All Present: success/secondary
- Mark All Absent: destructive outline or muted red
- Submit Attendance: primary/success

Do not show disabled buttons with poor contrast. Disabled buttons should be clearly inactive.

---

# Fees Page Instructions

## Current Problem
Good structure, but the fee structure cards need stronger hierarchy.

## Required Changes

### Stat Cards
Use `StatCard` for:

- Fee Structures
- Installments
- Admission Base
- Sessions Covered

Use rupee formatting consistently:

Bad:

```txt
Rs 57000
Admission Fee Rs 10000.00
```

Better:

```txt
₹57,000
Admission Fee: ₹10,000
```

Use Indian number formatting where possible.

### Fee Structure Cards
Each card should show:

```txt
Nursery                  2026-2027
Admission Fee: ₹10,000
1 installment
[View Details]
```

Use icon in soft square.

Use accordion only if clicking expands installment details.

If the chevron exists, it must actually expand/collapse.

---

# Payments Page Instructions

## Current Problem
Payments table is useful but visually too plain. Also actions are noisy.

## Required Changes

### Top Actions
Right side:

- Filters
- Export dropdown
- Record Payment

### Table Improvements

Add receipt/payment identity if available.

Amount should be visually aligned and formatted:

```txt
₹5,000
```

Status badge:

```tsx
<Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>
```

Actions:

Use dropdown menu or keep `Receipt` as visible action and move Edit/Delete inside dropdown.

Suggested:

```txt
[Receipt] [...]
```

Dropdown:

- Edit Payment
- Delete Payment

Pagination should stay inside table footer and look less cramped.

---

# Forms and Inputs

All forms should use consistent shadcn components.

Labels:

```tsx
className="text-sm font-medium text-slate-700"
```

Inputs/selects:

```tsx
className="h-11 rounded-xl bg-white"
```

Group related inputs inside cards with section headings.

Avoid long single-row forms on very wide screens unless the fields are closely related.

---

# Badges

Use badges heavily but softly.

Examples:

```tsx
<Badge variant="secondary" className="rounded-full">School</Badge>
<Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</Badge>
<Badge className="rounded-full bg-rose-50 text-rose-700 border border-rose-200">Female</Badge>
<Badge className="rounded-full bg-blue-50 text-blue-700 border border-blue-200">Male</Badge>
<Badge className="rounded-full bg-amber-50 text-amber-700 border border-amber-200">Partial</Badge>
```

Do not use harsh filled badges unless it is a critical status.

---

# Empty States

Every page/table with no records must show a polished empty state.

Required structure:

```txt
[Icon]
Title
Short explanation
Optional action button
```

Examples:

Classes:

```txt
No classes created yet
Create your first class to start setting up sections, subjects, and students.
[Add Class]
```

Subjects:

```txt
No subjects found
Add subjects such as Assamese, Mathematics, or Physics before assigning them to classes.
[Add Subject]
```

Attendance:

```txt
Select a class and section
Load a roster to begin recording attendance.
```

Payments:

```txt
No payments recorded
Record the first payment or adjust your filters.
[Record Payment]
```

---

# Motion and Interaction

Use subtle transitions only:

```tsx
transition-colors
transition-shadow
hover:shadow-md
hover:bg-slate-50
```

Avoid fancy animations.

This is school admin software. It should feel stable and serious.

---

# Responsive Rules

Ensure all pages work at:

- 1366px desktop
- 1440px desktop
- tablet width
- mobile width if supported

Grid rules:

```tsx
// Stat cards
grid gap-4 sm:grid-cols-2 xl:grid-cols-3

// Fee stats
grid gap-4 sm:grid-cols-2 xl:grid-cols-4

// Class/subject cards
grid gap-4 md:grid-cols-2 xl:grid-cols-3
```

Tables should horizontally scroll on smaller screens.

```tsx
<div className="overflow-x-auto">
  <Table />
</div>
```

---

# Final Acceptance Checklist

Codex should verify these before finishing:

- [ ] Main content background is soft gray, not pure white.
- [ ] Every page uses the same `PageHeader` pattern.
- [ ] Primary actions use punch/primary.
- [ ] Delete actions use destructive styling only.
- [ ] Tables have polished headers, hover states, and consistent spacing.
- [ ] Cards use consistent radius, border, shadow, and padding.
- [ ] Empty states are designed, not plain text.
- [ ] Student and payment tables have cleaner actions.
- [ ] Class and subject cards no longer look like raw database records.
- [ ] Sidebar spacing and active state are improved.
- [ ] Topbar looks modern and consistent.
- [ ] Rupee values use `₹` and proper formatting.
- [ ] No functionality, API behavior, routes, or database logic is broken.

---

# Implementation Priority

Do the redesign in this order:

1. Create/update shared design components: `PageHeader`, `StatCard`, `EmptyState`, `DataTableWrapper`, `ActionMenu`.
2. Update global layout, sidebar, and topbar.
3. Update Dashboard.
4. Update Students and Payments tables.
5. Update Classes and Subjects cards.
6. Update Attendance and Teacher Device Mapping forms.
7. Update Fees and Assign Subject to Class.
8. Review responsive behavior.
9. Remove duplicated page-specific styling where shared components can be used.

---

# Important Constraint

Do not rebuild the application logic. This task is UI polish only.

Preserve:

- Routes
- Existing API calls
- Existing data fetching
- Existing forms and validation
- Existing permissions
- Existing database logic
- Existing shadcn setup
- Existing `punch` accent color

Only improve the design layer and component structure.
