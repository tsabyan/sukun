import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * Renders the app icons from the Sukun mark — docs/04-design-system.md §0.1.
 *
 * The mark is a stroked circle with a 40° gap at the top-right, so it is
 * cheaper to draw it here than to keep a binary in the repo and hope it stays
 * in step with the component. Run with `npm run icons`.
 */

// Locked to the focus sea-glass on the dark canvas in every theme. A home
// screen icon that changes with the OS theme is an icon nobody can find.
const CANVAS = '#0F1216'
const ACCENT = '#63C9B6'

const R = 9
const CIRCUMFERENCE = 2 * Math.PI * R
const GAP_DEGREES = 40
const GAP = (CIRCUMFERENCE * GAP_DEGREES) / 360
const ARC = CIRCUMFERENCE - GAP
const ROTATION = -90 + GAP_DEGREES

/** @param {number} scale fraction of the canvas the mark occupies */
function markSvg(size, scale, background) {
  const inner = size * scale
  const offset = (size - inner) / 2
  const strokeWidth = 2 * (inner / 24)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
  <g transform="translate(${offset} ${offset}) scale(${inner / 24})">
    <circle cx="12" cy="12" r="${R}"
      fill="none" stroke="${ACCENT}" stroke-width="${strokeWidth / (inner / 24)}"
      stroke-linecap="round"
      stroke-dasharray="${ARC} ${GAP}"
      transform="rotate(${ROTATION} 12 12)"/>
  </g>
</svg>`
}

const OUT = 'public/icons'

const targets = [
  { file: '192.png', size: 192, scale: 0.44 },
  { file: '512.png', size: 512, scale: 0.44 },
  // Maskable icons are cropped to a safe circle; the mark shrinks to survive it.
  { file: 'maskable.png', size: 512, scale: 0.34 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.44 },
]

await mkdir(OUT, { recursive: true })

for (const { file, size, scale } of targets) {
  const svg = markSvg(size, scale, CANVAS)
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${file}`)
  console.log(`wrote ${OUT}/${file} (${size}px)`)
}

// Favicon: transparent, heavier stroke so it survives a tab strip.
await writeFile(`${OUT}/mark.svg`, markSvg(32, 0.78, null))
await sharp(Buffer.from(markSvg(32, 0.78, null))).png().toFile('src/app/icon.png')
console.log('wrote src/app/icon.png (32px)')
