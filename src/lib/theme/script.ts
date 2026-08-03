/**
 * Blocking script injected into <head> — docs/02-architecture.md §6.
 * Runs before first paint so the app never flashes the wrong theme.
 * Keep it small, dependency-free, and defensive: if anything throws, the page
 * must still render.
 */
export const THEME_STORAGE_KEY = 'sukun.theme'
export const PHASE_STORAGE_KEY = 'sukun.phase'
export const ONBOARDED_STORAGE_KEY = 'sukun.onboarded'

export const themeScript = `
(function () {
  try {
    var d = document.documentElement;
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var pref = stored === 'light' || stored === 'dark' ? stored : null;
    var resolved = pref || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    d.setAttribute('data-theme', resolved);

    var phase = localStorage.getItem('${PHASE_STORAGE_KEY}');
    d.setAttribute('data-phase', phase === 'short_break' || phase === 'long_break' ? phase : 'focus');

    /* Onboarding is the largest element on a first visit, so deciding whether
       to show it must not wait for hydration and an IndexedDB read — that put
       LCP at six seconds. localStorage is synchronous and available here. The
       component corrects itself after mount if IndexedDB disagrees. */
    if (!localStorage.getItem('${ONBOARDED_STORAGE_KEY}')) {
      d.setAttribute('data-onboarding', 'pending');
    }

    var h = new Date().getHours();
    var tint = h >= 5 && h < 9   ? 'rgb(74 92 138 / 0.07)'
             : h >= 9 && h < 16  ? 'rgb(120 140 160 / 0.03)'
             : h >= 16 && h < 20 ? 'rgb(150 108 92 / 0.07)'
             :                     'rgb(38 54 96 / 0.09)';
    d.style.setProperty('--daylight-tint', tint);
  } catch (e) {}
})();
`
