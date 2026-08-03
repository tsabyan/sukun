import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * Renders every icon from the Sukun mark — docs/04-design-system.md §0.1.
 *
 * The mark is a stroked circle with a 40° gap at the top-right, so it is
 * cheaper to draw it here than to keep binaries in the repo and hope they stay
 * in step with the component. Run with `npm run icons`.
 */

// App icons lock to the focus sea-glass on the dark canvas in every theme. A
// home screen icon that follows the OS theme is one nobody can find.
const CANVAS = '#0F1216'
const ACCENT_DARK_BG = '#63C9B6'
// The favicon has no canvas behind it, so it needs the darker light-mode
// accent to stay legible against a white tab strip.
const ACCENT_ON_LIGHT = '#3FA694'

const R = 9
const CIRCUMFERENCE = 2 * Math.PI * R
const GAP_DEGREES = 40
const GAP = (CIRCUMFERENCE * GAP_DEGREES) / 360
const ARC = CIRCUMFERENCE - GAP
const ROTATION = -90 + GAP_DEGREES

/**
 * @param {object} o
 * @param {number} o.size      canvas size in px
 * @param {number} o.scale     fraction of the canvas the mark occupies
 * @param {string} [o.background]
 * @param {string} [o.stroke]  colour
 * @param {number} [o.weight]  stroke width in viewBox units (24 wide)
 * @param {boolean} [o.adaptive] add a dark-scheme colour override
 */
function markSvg({ size, scale, background, stroke = ACCENT_DARK_BG, weight = 2, adaptive = false }) {
  const inner = size * scale
  const offset = (size - inner) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${
  adaptive
    ? `  <style>
    .mark { stroke: ${ACCENT_ON_LIGHT}; }
    @media (prefers-color-scheme: dark) { .mark { stroke: ${ACCENT_DARK_BG}; } }
  </style>
`
    : ''
}${background ? `  <rect width="${size}" height="${size}" fill="${background}"/>\n` : ''}  <g transform="translate(${offset} ${offset}) scale(${inner / 24})">
    <circle class="mark" cx="12" cy="12" r="${R}"
      fill="none"${adaptive ? '' : ` stroke="${stroke}"`} stroke-width="${weight}"
      stroke-linecap="round"
      stroke-dasharray="${ARC} ${GAP}"
      transform="rotate(${ROTATION} 12 12)"/>
  </g>
</svg>`
}

const OUT = 'public/icons'
await mkdir(OUT, { recursive: true })

/* ------------------------------------------------------------- app icons */

// Referenced by the web manifest, so these stay in public/.
const appIcons = [
  { file: '192.png', size: 192, scale: 0.44 },
  { file: '512.png', size: 512, scale: 0.44 },
  // Maskable icons are cropped to a safe circle; the mark shrinks to survive.
  { file: 'maskable.png', size: 512, scale: 0.34 },
]

for (const { file, size, scale } of appIcons) {
  const svg = markSvg({ size, scale, background: CANVAS })
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${file}`)
  console.log(`wrote ${OUT}/${file} (${size}px)`)
}

// Next's file convention picks this up as rel="apple-touch-icon" on its own.
// A Home Screen icon is composited on the user's wallpaper, so it keeps the
// dark canvas rather than going transparent.
await sharp(Buffer.from(markSvg({ size: 180, scale: 0.44, background: CANVAS })))
  .png()
  .toFile('src/app/apple-icon.png')
console.log('wrote src/app/apple-icon.png (180px)')

/* --------------------------------------------------------------- favicon */

/**
 * Browsers render the tab icon at 16px. A 2-unit stroke survives 32px and
 * disappears at 16, so the favicon is drawn heavier and larger than the app
 * icons, and downscaled from 96px so there is real detail to resample.
 */
const FAVICON = { scale: 0.84, weight: 3, adaptive: true }

await writeFile(
  'src/app/icon.svg',
  markSvg({ size: 32, ...FAVICON }),
)
console.log('wrote src/app/icon.svg (scalable, adapts to tab strip)')

await sharp(Buffer.from(markSvg({ size: 96, scale: FAVICON.scale, weight: FAVICON.weight, stroke: ACCENT_ON_LIGHT })))
  .resize(48, 48, { kernel: 'lanczos3' })
  .png()
  .toFile('src/app/icon.png')
console.log('wrote src/app/icon.png (48px fallback)')

// Kept for the docs and anywhere the raw mark is useful.
await writeFile(`${OUT}/mark.svg`, markSvg({ size: 32, scale: 0.84, weight: 2.4 }))
console.log(`wrote ${OUT}/mark.svg`)
