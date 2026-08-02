# 04 — Design System

## 0. Direction: "Blue Hour"

The reference app is pure black with alarm red. It reads like a countdown to a launch. This one reads like the quiet part of the day when you actually get work done.

The palette is drawn from twilight — deep indigo-graphite, cool paper, and a sea-glass accent. Nothing is pure black or pure white. Red appears in exactly one place: destructive confirmation.

**Signature element — the Daylight canvas.** The app background carries a near-imperceptible tint that shifts across the day: cool indigo before dawn, neutral at midday, warm at dusk, deep blue at night. It's under 8% opacity — you never consciously see it, but the app at 9am and the app at 11pm do not feel the same. It ties the timer to the planner's Morning / Afternoon / Evening buckets and to the one thing this product is actually about: the passage of a day.

That's the one risk. Everything else stays disciplined and quiet.

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
- Stroke uses `--accent`, so the logomark re-tints with the timer phase — sea-glass during focus, apricot during a break. The app icon stays locked to the focus sea-glass.
- One SVG, used at every size. No separate simplified mark; it's already the simplest thing it can be.

### Wordmark

`sukun` set in **Archivo, wght 600, wdth 112**, all lowercase, tracking `-0.02em`. Lowercase because the word means quiet and small caps would be shouting.

The mark sits to the left of the wordmark at 1.2× the cap height, with a gap of 0.4× the cap height. In the app header, the mark can also float above the *u* as the diacritic actually would — a nice detail for the marketing site, too clever for the product UI. Use the side-by-side lockup in-app.

### App icon

- Background: `--canvas` dark (`#0F1216`) in both themes. The icon does not follow the system theme; a home screen icon that changes is a home screen icon nobody finds.
- Mark centered at 44% of the icon width, in focus sea-glass `#63C9B6`.
- Maskable variant: same, with the mark at 34% to survive the safe-area crop.
- Favicon: the mark alone, 2.5px stroke at 32px so it doesn't disappear in a tab strip.

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

Blue-leaning graphite, never neutral-grey and never pure black. Warm creams are deliberately avoided — they fight the twilight accent.

```css
/* Dark (default) */
--canvas:          #0F1216;   /* page background */
--surface:         #171B21;   /* cards, list rows */
--surface-raised:  #1E242B;   /* sheets, popovers, pressed states */
--surface-sunken:  #0B0E12;   /* wells, inset tracks */
--hairline:        rgb(255 255 255 / 0.07);
--hairline-strong: rgb(255 255 255 / 0.12);
--text-primary:    #EDF0F3;
--text-secondary:  #98A2AE;
--text-tertiary:   #67717D;

/* Light */
--canvas:          #F4F6F8;   /* cool paper */
--surface:         #FFFFFF;
--surface-raised:  #FFFFFF;
--surface-sunken:  #EAEEF2;
--hairline:        rgb(15 18 22 / 0.08);
--hairline-strong: rgb(15 18 22 / 0.14);
--text-primary:    #12161B;
--text-secondary:  #5A6572;
--text-tertiary:   #8B95A1;
```

### Accents

One accent per timer phase. The accent is the *only* saturated color on screen at any moment.

| Role | Name | Light | Dark |
|------|------|-------|------|
| Focus phase | **Seaglass** | `#3FA694` | `#63C9B6` |
| Short break | **Apricot** | `#D98E5F` | `#EFA97A` |
| Long break | **Iris** | `#7A80D0` | `#9AA0E8` |
| Destructive only | **Ember** | `#D4503C` | `#E5624F` |

```css
--accent:        /* set per phase, swapped on the root */
--accent-muted:  color-mix(in oklch, var(--accent) 18%, transparent);
--accent-quiet:  color-mix(in oklch, var(--accent) 9%,  transparent);
```

Swapping `--accent` on `<html>` when the phase changes re-tints the ring, the play button, the active tab, and focus outlines in one shot. Transition it over 480ms so the phase change reads as a mood shift, not a repaint.

### Priority dots

Small dots and left rails only. Never a filled row, never a background.

```css
--priority-high:   #E0685A;
--priority-medium: #E3A857;
--priority-low:    #6FA8A0;
```

### Task colors

Eight muted options for the task icon tile. All are desaturated on purpose — a list of twelve tasks should look like a list, not a paint chart.

```
sage    #7BA098    slate   #7C8B9E    iris   #8E93D9    apricot #DDA077
clay    #C08370    moss    #8AA06E    fog    #9AA3AD    plum    #A085B0
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

Two families. One is the instrument voice, one is the human voice.

| Role | Face | Setting |
|------|------|---------|
| **Timer numerals, headings** | **Archivo Variable** | `wdth 112`, `wght 500–650`, `font-variant-numeric: tabular-nums`, tracking `-0.03em` at display sizes |
| **Body, labels, buttons** | **Instrument Sans Variable** | `wght 400–600`, tracking `0` |
| **Eyebrows, data labels, axes** | **Archivo Variable** condensed | `wdth 87`, `wght 600`, `uppercase`, tracking `+0.14em`, 11px |

Why: Archivo's width axis gives you a mechanical, instrument-panel voice for numbers and data — which is exactly what a split-flap board and a heatmap axis are — while Instrument Sans keeps prose humane and quiet. One expanded face for the clock, one condensed face for the labels, one humanist face for everything a person reads as a sentence. Avoids the system-font look without importing four families.

Both are on Google Fonts, both variable. Self-host via `next/font/google` with `display: 'swap'` and preload the two axes you actually use.

### Scale

```
display-xl   72px / 0.9  / -0.04em   Archivo 600   flip-clock digits
display-l    56px / 0.95 / -0.035em  Archivo 600   ring countdown (mobile)
display-m    40px / 1.0  / -0.03em   Archivo 600   stat hero numbers
title-l      24px / 1.2  / -0.02em   Archivo 600   screen titles
title-m      18px / 1.3  / -0.01em   Instrument 600
body         15px / 1.5  /  0        Instrument 400
body-sm      13px / 1.45 /  0        Instrument 400  secondary rows
label        13px / 1.2  /  0        Instrument 500  buttons, tabs
eyebrow      11px / 1.0  / +0.14em   Archivo 600 condensed, uppercase
```

The ring countdown scales with `clamp(56px, 14vw, 88px)`. The flip-clock digits with `clamp(72px, 22vw, 180px)`.

**Rules**
- Every number that changes over time is `tabular-nums`. Non-negotiable — a countdown that shifts width is the single most amateur thing a timer app can do.
- Never more than three type sizes visible in one card.
- Sentence case everywhere except eyebrows.

---

## 3. Space, radius, depth

### Spacing — 4pt base

`2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72`

Screen gutter: 20px mobile, 32px tablet, 40px desktop. Card padding: 16px compact, 20px default. Vertical rhythm between sections: 24px.

### Radius

iOS continuous corners. Larger than feels right at first.

```
--r-sm:   10px   chips, dots, small controls
--r-md:   14px   inputs, buttons
--r-lg:   20px   cards, list rows
--r-xl:   28px   sheets, modals, hero cards
--r-full: 999px  pills, FAB, avatars
```

Icon tiles use a squircle SVG mask, not `border-radius` — that's the detail that reads as iOS rather than "rounded rectangle."

### Depth

Shadows are tinted with the canvas hue, layered, and low. In dark mode depth comes from *surface lightness*, not shadow — a dark card with a black shadow is invisible.

```css
--shadow-sm: 0 1px 2px rgb(11 14 18 / 0.06), 0 1px 1px rgb(11 14 18 / 0.04);
--shadow-md: 0 4px 12px rgb(11 14 18 / 0.08), 0 1px 3px rgb(11 14 18 / 0.06);
--shadow-lg: 0 16px 40px rgb(11 14 18 / 0.16), 0 4px 12px rgb(11 14 18 / 0.10);

/* dark mode: shadows near-off, hairlines carry the separation */
[data-theme='dark'] {
  --shadow-sm: 0 1px 0 rgb(255 255 255 / 0.04) inset;
  --shadow-md: 0 8px 24px rgb(0 0 0 / 0.40);
  --shadow-lg: 0 24px 64px rgb(0 0 0 / 0.55);
}
```

### Translucency

Tab bar, sheet headers, and the flip-clock control rail use iOS-style material:

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
| Flip-clock digit | 3D `rotateX` split-flap, 380ms, with a mid-flip shadow pass |
| Heatmap load | Cells fade in with 8ms stagger by column — one pass, on mount only |
| Tab change | No transition. Instant. |

**Never:** confetti, bouncing, pulsing "streak at risk" warnings, spinning loaders longer than 400ms, anything that animates on every render.

`@media (prefers-reduced-motion: reduce)` collapses every spring to a 120ms opacity fade and disables the flip animation (digits swap instantly).

### Haptics

`navigator.vibrate()` where supported, and only here:
- Phase complete: `[18, 40, 18]`
- Task complete: `12`
- Long-press to reorder engaged: `8`

---

## 5. Component recipes

### Button

| Variant | Fill | Text | Use |
|---------|------|------|-----|
| primary | `--accent` | canvas | one per screen, max |
| secondary | `--surface-raised` | text-primary | everything else |
| ghost | transparent | text-secondary | tertiary, icon buttons |
| destructive | transparent, `--priority-high` text | Ember | delete, reset |

Height 44px (iOS touch target), radius `--r-md`, label 13px/500. Press: `scale(0.97)` + 6% overlay, `snappy`. Disabled: 38% opacity, no pointer events.

### Card

`--surface`, radius `--r-lg`, 1px `--hairline` border, `--shadow-sm`, padding 20px. Interactive cards get `--shadow-md` and a 1px `--hairline-strong` border on hover; on press, `scale(0.99)`.

### List row

Min height 60px, 16px horizontal padding, hairline separator inset 16px from the left (iOS inset separator). Swipe left reveals complete / delete on touch; hover reveals the same actions on pointer devices.

### Bottom sheet

Radius `--r-xl` top corners only, `--surface-raised`, grabber pill 36×5px at `--hairline-strong`, safe-area bottom padding. Snap points `['60%', '95%']`. Backdrop `rgb(0 0 0 / 0.4)` with 8px blur. Drag-to-dismiss below 40% of the current snap.

### Segmented control

The iOS pill: track is `--surface-sunken` with radius `--r-full` and 3px padding; the active thumb is `--surface` with `--shadow-sm`, animated with Motion's `layoutId` so it slides between segments. Labels 13px/500, inactive at `--text-secondary`.

### Progress ring

- Track: 10px stroke, `--hairline`.
- Progress: 10px stroke, `--accent`, `stroke-linecap: round`, rotated -90° so it starts at 12 o'clock.
- Drive `stroke-dashoffset` from a single `requestAnimationFrame` loop, not React state. Ring updates at 60fps; the digits update at 1Hz. They are separate render paths.
- **No glow.** The reference app's red bloom is the loudest thing on its screen. Here the ring is a 10px line and it's enough.
- Inside: eyebrow (`FOCUS · 3 OF 4`), countdown, then a quiet line of context (task title, or "No task attached").

### Flip clock digit

Two stacked halves per digit, `perspective: 800px`, top half rotates on `rotateX` from 0° to -90° while the incoming bottom half rotates 90° → 0°. A `linear-gradient` overlay darkens the flap through the middle of the animation for physical depth. A 1px hairline splits the card horizontally — that seam is what sells it.

### Heatmap cell

12px square, radius 3px, 3px gap. Intensity is opacity of `--accent` at 5 steps: `0.08 / 0.28 / 0.48 / 0.70 / 1.0`. Level 0 is `--surface-sunken`. Legend reads `Less ▢▢▢▢▢ More`. Tapping a cell opens that day's session list.

---

## 6. Iconography

Lucide, 20px default (24px for tab bar, 18px inline), `stroke-width: 1.75`. Never mix in another icon set. Task icon tiles: 36×36 squircle at 12% of the task color, icon at full task color.

---

## 7. Accessibility floor

Not optional, not a phase-9 task.

- Body text ≥ 4.5:1, large text and UI borders ≥ 3:1. `--text-tertiary` is metadata only, never load-bearing.
- Every interactive element has a visible focus ring: 2px `--accent`, 2px offset. Never `outline: none` without a replacement.
- Touch targets ≥ 44×44 including the FAB and every icon button.
- The timer announces phase changes via `aria-live="polite"`; the countdown itself is `aria-hidden` (a screen reader announcing every second is unusable) with a readable summary alongside.
- Color never carries meaning alone — priority has a dot *and* a label; heatmap cells have title text with the date and count.
- Full keyboard path on desktop: `Space` start/pause, `S` skip, `F` flip mode, `N` new task, `Esc` closes sheets.

---

## 8. Tailwind v4 wiring

Tokens live in CSS; Tailwind reads them. One source of truth.

```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-canvas:         var(--canvas);
  --color-surface:        var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-accent:         var(--accent);
  --color-ink:            var(--text-primary);
  --color-ink-2:          var(--text-secondary);
  --color-ink-3:          var(--text-tertiary);
  --radius-lg:            20px;
  --radius-xl:            28px;
  --font-display:         var(--font-archivo);
  --font-sans:            var(--font-instrument);
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
