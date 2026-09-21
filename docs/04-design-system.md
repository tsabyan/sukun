# 04 — Design System

## 0. Direction: "Still green"

*v2. Supersedes the "Blue Hour" pass — indigo canvas, sea-glass accent,
Archivo + Instrument Sans. Nothing of it survives but the daylight layer and
the logomark.*

Paper-grey canvas, charcoal ink, and one brand green that carries every
positive state in the app. Four colours do the whole job:

| | | |
|---|---|---|
| `#F0F0F1` | canvas | the page, and every inset well |
| `#FFFFFF` | surface | cards, sheets, the active tab |
| `#292A2C` | ink | text, the tab capsule, the "done" step of a scale |
| `#9CD237` | green | the hero of every screen, and the one floating action |

The move that makes it feel like a product rather than a theme: **one green
hero card at the top of every screen**, carrying the single number that screen
is about — today's progress on Home, open tasks on Tasks, hours focused on
Insights, the streak on a habit. Everything on it is charcoal. Below it,
white cards on grey, and nothing saturated at all.

Flat green, not a gradient. A gradient hero was tried and read as decoration;
a flat field reads as a surface with information on it.

Red appears in exactly one place: destructive confirmation.

**Light only.** Dark mode is a mechanical derivation of these tokens so the
Theme setting that already shipped keeps working; it is not a designed pass.

---

## 0.1 Brand: Sukun

**Sukun** · سكون — Arabic for *stillness, quiet*. It's also the name of the diacritic ( ـْ ) placed above a letter to mark that it carries no vowel: a stop. In Quranic recitation it's the sign to hold.

So the name means both halves of the product at once — the stillness you're trying to reach, and the mark that says *pause here*.

### Logomark

**The sukun diacritic is a small circle.** So is the focus ring. They are the same mark at two scales, and that is the entire identity — nothing else needs inventing.

```
       ╭───╮            the mark: a stroked circle,
      │     │           open at the top-right by ~40°
      │     │           
       ╰───╯            = the diacritic
                        = a progress ring mid-session
                        = a day that isn't finished
```

Spec:

- Circle, 2px stroke at 24px, scaling to 8% of the total size.
- **Open at the top-right, 40° gap**, starting at 12 o'clock. The gap is what distinguishes it from a plain circle and what makes it read as a ring in progress.
- `stroke-linecap: round`.
- Stroke uses `currentColor`, so the logomark re-tints with whatever it sits in — brand green on the charcoal home tile, charcoal on a green card.
- One SVG, used at every size. No separate simplified mark; it's already the simplest thing it can be.

### Wordmark

`sukun` set in **Outfit, wght 600**, all lowercase, tracking `-0.02em`. Lowercase because the word means quiet and small caps would be shouting.

The mark sits to the left of the wordmark at 1.2× the cap height, with a gap of 0.4× the cap height. In the app header, the mark can also float above the *u* as the diacritic actually would — a nice detail for the marketing site, too clever for the product UI. Use the side-by-side lockup in-app.

### App icon

**The icon is the mascot, not the mark.** A charcoal blob with a green sprout, peering over a green hill on cream — a home screen full of glyphs, and this one is a face. Source art: `public/images/app.jpeg`.

- The icon does not follow the system theme; a home screen icon that changes is a home screen icon nobody finds.
- Generated from the source square: `src/app/apple-icon.png` 180, `public/icons/192.png`, `public/icons/512.png`.
- Maskable variant: full bleed at 512. The art already carries its own margin — the sprout tip sits ~13% from the top, inside the 80% safe circle — so insetting it only opens cream gutters where the hill should reach the edge.
- Favicon (`src/app/icon.png`, 48px): cropped to the head with the hill bled to the edges. At tab-strip size the full icon's cream margin eats the character.
- There is no `icon.svg`. Next prefers an SVG over the PNG for the tab icon, and the one that shipped was the v1 teal mark — keeping it would have kept the old logo on tabs.
- The logomark ring still owns the in-app brand: header wordmark, error and phase placeholders, progress rings. Icon and mark are allowed to be different things.

### Tagline

**"Stillness, on a timer."**

Backups, in order: "Quiet work, counted." · "A calmer way to focus." Pick one and use it everywhere — app store copy, OG description, Reddit post, manifest. A tagline that changes per channel isn't a tagline.

### Voice

The name sets the register. Plain, unhurried, never exclamatory. The app does not celebrate at you, does not warn you, does not use the word "crush." Empty states invite; errors explain. See [05-screens.md](05-screens.md) for the exact copy — it's written this way already.

### Naming risk, noted

In Indonesian, *buah sukun* is breadfruit. In an Indonesian-facing launch, always pair the name with the tagline or the Arabic on first mention so the reading lands on stillness. In English-language channels the collision doesn't exist.

Before the domain purchase: check `sukun.app`, `sukun.so`, `getsukun.com`, and run a trademark search in the classes for software. This is unverified.

---

## 1. Color

### Neutrals

Warm-neutral paper and charcoal. Nothing is pure black; the canvas and the
inset "field" are deliberately the same grey, so a well reads as a hole in the
card rather than a second surface.

```css
--canvas:          #F0F0F1;   /* page background */
--surface:         #FFFFFF;   /* cards, sheets, active tab */
--surface-sunken:  #F0F0F1;   /* wells */
--field:           #F0F0F1;   /* inputs, icon tiles, inset lists */
--track:           #E2E3E6;   /* progress tracks, the empty heat cell */
--hairline:        rgb(41 42 44 / 0.09);
--hairline-strong: rgb(41 42 44 / 0.16);
--text-primary:    #292A2C;
--text-secondary:  #6F7176;
--text-tertiary:   #A4A6AB;
```

### Brand green

One hue, four steps. They are a *scale*, not four accents: the heat grid, the
focus bubbles and the badge states all read along it.

```css
--lime:       #E3F786;   /* the lightest step — chips on green */
--green:      #9CD237;   /* the brand. Heroes, the FAB, "done" */
--green-mid:  #C8E691;   /* the middle of the heat scale */
--green-deep: #5E8F12;   /* green text and glyphs on a pale green fill */
--green-soft: #F1FAD6;   /* the palest wash — unlocked badges, streak pills */
```

The heat scale, in order: `--track` → `--green-soft` → `--green-mid` →
`--green` → `--text-primary`. The top step is charcoal on purpose. Five steps
of one green cannot be told apart on a phone in daylight, and the heaviest day
of a quarter deserves to be legible.

### Phase accents

The phase is carried by the *surface* — a green focus screen, a charcoal break
screen — so the accent only shifts a shade underneath.

| Role | Token | Value |
|------|-------|-------|
| Focus | `--accent-focus` | `#9CD237` |
| Short break | `--accent-short-break` | `#E3F786` |
| Long break | `--accent-long-break` | `#5E8F12` |
| Destructive only | `--accent-ember` | `#E5484D` |

`--accent` is registered with `@property` so swapping it on `<html>` cross-fades
over 480ms instead of snapping.

**`--on-accent` is charcoal (`#292A2C`) and never follows the theme.** The
brand greens are light: charcoal measures **7.6:1** on `--green` and
**12.4:1** on `--lime`. Near-white on either fails at any size.

### Priority dots

Small dots and left rails only. Never a filled row, never a background.

```css
--priority-high:   #E5484D;
--priority-medium: #E8A33D;
--priority-low:    #9CD237;
```

### Task colors

Eight options for the task icon tile. The *names* are persisted in Postgres (a
CHECK constraint on `sukun.tasks.color`), so the set is fixed; v2 only retunes
the values. `sage` is the brand green and the default, `moss` its lime sibling.

```
sage    #9CD237    slate   #7C8B9E    iris   #8E93D9    apricot #DDA077
clay    #C08370    moss    #C7E35E    fog    #9AA3AD    plum    #A085B0
```

### Daylight tint (the signature)

A fixed, non-interactive layer behind all content. One CSS variable, recomputed on the hour.

```css
.daylight {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(120% 80% at 50% 0%, var(--daylight-tint), transparent 70%);
  transition: background 4s linear;
}
```

| Local hours | `--daylight-tint` | Feel |
|-------------|-------------------|------|
| 05:00–08:59 | `rgb(74 92 138 / 0.07)` | cool dawn |
| 09:00–15:59 | `rgb(120 140 160 / 0.03)` | flat daylight |
| 16:00–19:59 | `rgb(150 108 92 / 0.07)` | warm dusk |
| 20:00–04:59 | `rgb(38 54 96 / 0.09)` | deep night |

Same four values tint the Morning / Afternoon / Evening headers in the planner, so the two screens speak the same language.

---

## 2. Typography

One family. **Outfit Variable**, self-hosted through `next/font/google` as
`--font-outfit`.

Two families were tried — a condensed instrument face for numbers, a humanist
face for prose — and the seam between them showed on every card that had both.
Outfit does both jobs because its weight axis is wide enough to carry the
distinction on its own: big numbers are *light*, anything read as a sentence is
regular, anything read as a label is medium. Weight, not family, is the voice.

Its lining figures are already even-width; `tabular-nums` is declared anyway so
a fallback family locks its digits too.

### Scale

```
display-xl   96px / 1.0  / -0.04em   300   the focus countdown
display-l    64px / 1.0  / -0.03em   300
display-m    44px / 1.0  / -0.025em  300   hero numbers
display-s    34px / 1.0  / -0.02em   300   stat tiles
title-l      24px / 1.15 / -0.02em   500   screen titles
title-m      20px / 1.25 / -0.015em  500   sheet titles, detail names
title-s      15px / 1.3  /  0        500   card heads
body         14px / 1.5  /  0        400
body-sm      12px / 1.45 /  0        400   row meta, chip labels
label        13px / 1.2  /  0        500   buttons, tabs
eyebrow      11px / 1.0  / +0.10em   500   uppercase field labels
```

**Rules**
- Every number that changes over time is `tabular-nums`. Non-negotiable — a
  countdown that shifts width is the single most amateur thing a timer app can
  do.
- Never more than three type sizes visible in one card.
- Sentence case everywhere except eyebrows.

---

## 3. Space, radius, depth

### Spacing — 4pt base

`2 · 4 · 6 · 8 · 12 · 14 · 16 · 18 · 20 · 24 · 32 · 40 · 56`

Screen gutter: **16px, at every width** — there is one layout. Card padding 16px,
hero padding 18px. Vertical rhythm between the blocks of a screen: 14px.

### Radius

iOS continuous corners. Larger than feels right at first.

```
--r-sm:   12px   chips, small tiles, inset lists
--r-md:   16px   inputs, buttons, icon tiles
--r-lg:   22px   cards, list cards
--r-xl:   28px   sheets, hero cards, the add menu
--r-full: 999px  pills, the tab capsule, the floating action
```

Task icon tiles use a squircle SVG path, not `border-radius` — that's the
detail that reads as iOS rather than "div with a border radius".

### Depth

Charcoal-tinted, shallow, and few. Cards lift; they do not float. There is no
border *and* a shadow — on a grey canvas that reads as two edges.

```css
--shadow-sm:  0 1px 2px  rgb(41 42 44 / 0.04);
--shadow-md:  0 2px 12px rgb(41 42 44 / 0.05);   /* every card */
--shadow-lg:  0 8px 28px rgb(41 42 44 / 0.12);   /* sheets, the tab capsule */
--shadow-fab: 0 8px 24px rgb(156 210 55 / 0.35); /* the one green action */
```

The floating action is the only element with a *coloured* shadow. It is the
only element that is allowed to look like it is above the page.

### Translucency

Sheet headers and control rails use iOS-style material. The tab capsule does
not — it is opaque charcoal, because a blurred bar over a green hero reads as
smudged rather than as glass:

```css
.material {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}
```

Provide an opaque fallback with `@supports not (backdrop-filter: blur(1px))`.

---

## 4. Motion

iOS motion is spring-based. Nothing in this app uses a linear ease except the progress ring, which is genuinely linear time.

```ts
export const spring = {
  snappy: { type: 'spring', stiffness: 400, damping: 34, mass: 0.9 },  // buttons, toggles, chips
  smooth: { type: 'spring', stiffness: 260, damping: 30 },             // sheets, layout shifts
  gentle: { type: 'spring', stiffness: 160, damping: 26 },             // ring, ambient, phase change
}
export const ease = {
  ios:  [0.32, 0.72, 0, 1],   // sheet presentation curve
  out:  [0.16, 1, 0.3, 1],
}
export const dur = { fast: 0.15, base: 0.22, slow: 0.32, ambient: 0.48 }
```

**Where motion is used, and nowhere else:**

| Moment | Treatment |
|--------|-----------|
| Phase change (focus → break) | `--accent` cross-fades over 480ms; ring resets with `gentle` spring |
| Start / pause | Play↔pause icon morphs; FAB scales 0.94 on press with `snappy` |
| Sheet present | Slide from bottom with `ease.ios`, 320ms; backdrop fades to 40% |
| Task complete | Row checkbox fills with `snappy`, title strikes through over 200ms, row fades out after 400ms |
| Heatmap load | Cells fade in with 8ms stagger by column — one pass, on mount only |
| Tab change | No transition. Instant. |

**Never:** confetti, bouncing, pulsing "streak at risk" warnings, spinning loaders longer than 400ms, anything that animates on every render.

`@media (prefers-reduced-motion: reduce)` collapses every spring to a 120ms opacity fade.

### Haptics

`navigator.vibrate()` where supported, and only here:
- Phase complete: `[18, 40, 18]`
- Task complete: `12`
- Long-press to reorder engaged: `8`

---

## 5. Component recipes

### Hero card

The signature. One per screen, always the first thing under the header, always
the single number that screen is about.

`--green`, radius `--r-xl`, 18px padding, 16px gaps, everything charcoal. Title
(title-s) and an optional charcoal pill on the left/right of the head row; then
the number at `display-m` in weight 300 with a `body-sm` line beside its
baseline; then whatever the screen needs — seven bars, a progress track, mini
panels at `rgb(255 255 255 / 0.55)`.

**Week bars** — seven bars, values 0–1, `rounded-full`, white at 90% when the
day has something and 55% when it does not. A zero day still draws an 8% stub:
a gap is information, an absence is a rendering bug.

### Stat tile

White, radius `--r-lg`, `--shadow-md`, 128px tall, two per row. The number at
`display-s`/300 top-left, an `ArrowUpRight` top-right **only when the tile goes
somewhere**, and the label at the bottom in `body-sm`. The label is a phrase,
not a heading: "day streak · best is 14".

### Bottom bar

Charcoal capsule, 62px, radius `--r-full`, `--shadow-lg`, 6px inner padding,
floating in the 16px gutter 10px above the safe-area inset. Two tabs either
side of a 56px gap. Active tab: a white 50px circle behind the icon, slid
between tabs with Motion's `layoutId`. Inactive: the icon at 70% white.

### The floating action

A 56px `--green` circle in that gap, raised 15px out of the capsule, with
`--shadow-fab`. Icon only, 26px, charcoal; the label is its `aria-label`.

It belongs to the **screen**, not the shell: pages register one through
`usePageAction` and the shell renders whatever is there. The gap keeps its
width when no action is registered, so the tabs never shift between routes.

### Button

| Variant | Fill | Text | Use |
|---------|------|------|-----|
| primary | `--text-primary` | surface (glyphs `--green`) | the confirming action of a sheet |
| accent | `--green` | `--on-accent` | start / resume |
| secondary | `--surface` + hairline | text-primary | everything else |
| ghost | transparent | text-secondary | tertiary, icon buttons |
| destructive | `--surface`, `--accent-ember` text | Ember | delete, reset |

Height 44px (iOS touch target), radius `--r-full`, label 13px/500. Press:
`scale(0.97)`, `snappy`. Disabled: 38% opacity, no pointer events.

### Card

`--surface`, radius `--r-lg`, `--shadow-md`, no border, padding 16px. Card head
is a title on the left and, on the right, a quiet white chip and/or a 32px
charcoal `+` for the list the card owns — **the "+" lives beside the count it
adds to**, never in the screen header.

### List row

Min height 54–64px, no separators inside a card: the 40px icon tile and the
row's own padding do that work. Swipe left reveals complete / delete on touch.

### Chip / pill

Radius `--r-full`, 12px horizontal padding, `body-sm`/500, 29px tall.
White + hairline by default; charcoal with white text when it carries a value
the eye should land on ("Session 3 of 4", the weekday on a hero).

### Bottom sheet

Radius `--r-xl` top corners only, `--surface`, grabber 40×5px at `--track`,
safe-area bottom padding. Snap points `[0.6, 0.95]` of viewport height. Backdrop
`--text-primary` at 45%. Drag-to-dismiss below 40% of the current snap.

### Action sheet

Not a Sheet: a short charcoal panel that rises out of the button that spawned
it and sits directly above the bar, so the thumb never travels. Used where one
screen's "+" has more than one meaning. Title `title-m` in surface, rows of a
44px coloured circle plus two lines.

### Segmented control

White track with a hairline, radius `--r-full`, 4px padding; the thumb is
`--text-primary` and slides with a transform (a percentage of its own width,
which lands exactly on each segment where `layoutId` snapped under Next 16).
Labels `body-sm`/500, inactive `--text-secondary`, active `--surface`.

### Progress ring

Still specified, still unused on any screen: the focus screen is a number and a
line. Kept because a ring is the obvious answer if a compact widget ever needs
one.

- Track: 10px stroke, `--hairline`. Progress: 10px, `--accent`, round cap,
  rotated -90° so it starts at 12 o'clock.
- Drive `stroke-dashoffset` from a single `requestAnimationFrame` loop, not
  React state. **No glow.**

### Heat cell

Flexible width, 14px tall, radius 4px, 6px gaps — the grid fills the card
rather than scrolling sideways on a narrow phone. Five discrete fills, never
one colour at five opacities:

```
0  --track        1  --green-soft   2  --green-mid
3  --green        4  --text-primary
```

Legend reads `Less ▢▢▢▢▢ More` on the left and the date span on the right.
Tapping a cell opens that day's session list.

---

## 6. Iconography

Lucide, 20px default (22px for tab bar, 26px for the floating action, 18px
inline), `stroke-width: 1.75`. Never mix in another icon set. Task icon tiles:
36×36 squircle at 14% of the task color, icon at full task color.

---

## 7. Accessibility floor

Not optional, not a phase-9 task.

- Body text ≥ 4.5:1, large text and UI borders ≥ 3:1. `--text-tertiary` is metadata only, never load-bearing.
- Every interactive element has a visible focus ring: 2px `--text-primary`, 2px
  offset. Ink rather than accent — the greens are too light to read as a ring on
  white, and the ring has to survive on a green hero too. Never `outline: none`
  without a replacement.
- Touch targets ≥ 44×44 including the FAB and every icon button.
- The timer announces phase changes via `aria-live="polite"`; the countdown itself is `aria-hidden` (a screen reader announcing every second is unusable) with a readable summary alongside.
- Color never carries meaning alone — priority has a dot *and* a label; heatmap cells have title text with the date and count.
- Full keyboard path: `Space` start/pause, `S` skip, `N` new task, `Esc` closes
  sheets.

---

## 8. Tailwind v4 wiring

Tokens live in CSS; Tailwind reads them. One source of truth.

```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme inline {
  --color-canvas:      var(--canvas);
  --color-surface:     var(--surface);
  --color-field:       var(--field);
  --color-track:       var(--track);
  --color-accent:      var(--accent);
  --color-green:       var(--green);
  --color-green-mid:   var(--green-mid);
  --color-green-soft:  var(--green-soft);
  --color-green-deep:  var(--green-deep);
  --color-ink:         var(--text-primary);
  --color-ink-2:       var(--text-secondary);
  --color-ink-3:       var(--text-tertiary);
  --radius-lg:         var(--r-lg);
  --radius-xl:         var(--r-xl);
  /* one family, two roles — both resolve to Outfit */
  --font-display:      var(--font-outfit);
  --font-sans:         var(--font-outfit);
}

:root { color-scheme: light; /* light tokens */ }
[data-theme='dark'] { color-scheme: dark; /* dark tokens */ }
[data-phase='focus']       { --accent: #3FA694; }
[data-phase='short_break'] { --accent: #D98E5F; }
[data-phase='long_break']  { --accent: #7A80D0; }
[data-theme='dark'][data-phase='focus']       { --accent: #63C9B6; }
[data-theme='dark'][data-phase='short_break'] { --accent: #EFA97A; }
[data-theme='dark'][data-phase='long_break']  { --accent: #9AA0E8; }
```

Theme and phase are two independent attributes on `<html>`. Setting them is the entire theming API.
