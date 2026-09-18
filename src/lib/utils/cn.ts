import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The type scale from `globals.css`, spelled out for tailwind-merge.
 *
 * `text-*` is two utilities wearing one prefix: a font size and a colour.
 * tailwind-merge only knows Tailwind's stock sizes, so it filed every custom
 * one — `text-label`, `text-body-sm` — under *colour*, put it in the same
 * conflict group as `text-surface`, and dropped whichever came first. That is
 * how the primary button ended up charcoal-on-charcoal with its label
 * invisible. Registering the scale here splits the groups again.
 */
const FONT_SIZES = [
  'display-xl',
  'display-l',
  'display-m',
  'display-s',
  'title-l',
  'title-m',
  'title-s',
  'body',
  'body-sm',
  'label',
  'eyebrow',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      // Same trick, one class: without it `shadow-fab` reads as a shadow
      // *colour* rather than a shadow.
      shadow: [{ shadow: ['fab'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
