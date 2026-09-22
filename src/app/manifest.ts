import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ajeg — Focus Timer',
    short_name: 'Ajeg',
    description: 'A calm Pomodoro timer and daily planner. Steady, day after day.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Not locked: the flip clock is at its best in landscape on a propped-up
    // phone, and a lock a browser cannot reliably hold is worse than none.
    orientation: 'any',
    background_color: '#F0F0F1',
    theme_color: '#F0F0F1',
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Start focus', url: '/', description: 'Open the timer' },
      { name: 'Plan today', url: '/plan', description: 'Shape the day' },
    ],
  }
}
