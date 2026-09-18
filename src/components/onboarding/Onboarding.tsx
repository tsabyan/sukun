'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Check, Code2, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { HeroCard, HeroWeekBars } from '@/components/ui/HeroCard'
import { IconTile } from '@/components/ui/IconTile'
import { Pill } from '@/components/ui/Pill'
import { Logomark } from '@/components/brand/Logomark'
import { db, setMeta, META_KEYS } from '@/lib/db/schema'
import { ONBOARDED_STORAGE_KEY } from '@/lib/theme/script'
import {
  isIOS,
  promptInstall,
  useInstallStore,
  useIsStandalone,
  watchInstallPrompt,
} from '@/lib/pwa/install'
import { cn } from '@/lib/utils/cn'

/**
 * A1–A3 — first run. docs/05-screens.md.
 *
 * Rendered server-side and shown by CSS, not by React state. The overlay is
 * the largest element on a first visit, so gating it on hydration plus an
 * IndexedDB read made it the LCP at six seconds. The blocking script in <head>
 * sets data-onboarding="pending" from localStorage before first paint; this
 * markup is already in the HTML waiting for it.
 *
 * localStorage can lie — cleared storage, a restored profile — so after mount
 * the component checks IndexedDB and dismisses itself if there is history. An
 * optimistic show that corrects in one frame beats a correct show that costs
 * five seconds.
 *
 * Each card previews the thing it is describing rather than illustrating it:
 * the first screen of an app should look like the app.
 *
 * Notification permission is deliberately NOT requested here. A cold prompt
 * gets denied, and a denial is permanent.
 */

function dismiss() {
  document.documentElement.removeAttribute('data-onboarding')
  try {
    localStorage.setItem(ONBOARDED_STORAGE_KEY, '1')
  } catch {
    // Private mode with storage denied. The IndexedDB flag still carries it.
  }
}

export function Onboarding() {
  const [index, setIndex] = useState(0)
  const showInstallCard = !useIsStandalone()
  const deferred = useInstallStore((s) => s.deferred)

  useEffect(() => {
    let cancelled = false
    const verify = async () => {
      // A returning user on cleared localStorage should not be introduced to
      // an app they already use.
      const [tasks, sessions] = await Promise.all([db.tasks.count(), db.sessions.count()])
      if (cancelled) return
      if (tasks > 0 || sessions > 0) {
        dismiss()
        void setMeta(META_KEYS.onboardedAt, new Date().toISOString())
      }
    }

    void verify()
    const stopWatching = watchInstallPrompt()

    return () => {
      cancelled = true
      stopWatching()
    }
  }, [])

  const finish = () => {
    dismiss()
    void setMeta(META_KEYS.onboardedAt, new Date().toISOString())
  }

  const cards = showInstallCard ? [0, 1, 2] : [0, 1]
  const last = index === cards.length - 1

  return (
    <div
      // Visibility is CSS, driven by the <html> attribute — see globals.css.
      data-onboarding-overlay
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Sukun"
      // No `flex` utility here on purpose: Tailwind's utilities layer wins
      // over the components layer, so a `flex` class would override the
      // `display: none` that hides this and leave the overlay permanently on
      // top of the app. globals.css owns `display` for this element.
      className="fixed inset-0 z-50 justify-center overflow-y-auto bg-canvas"
    >
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pt-3"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={finish}
            className="-mr-2 px-2 py-1.5 text-label text-ink-2 hover:text-ink"
          >
            Skip
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-7 py-6">
          {index === 0 && <TimerPreview />}
          {index === 1 && <TasksPreview />}
          {index === 2 && <InstallPreview />}

          <div className="flex flex-col gap-2.5 text-center">
            <h2 className="text-title-l text-ink">{COPY[index].title}</h2>
            <p className="text-body text-ink-2">
              {index === 2 && isIOS() ? IOS_INSTALL_BODY : COPY[index].body}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2" aria-hidden>
            {cards.map((card) => (
              <span
                key={card}
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-200',
                  card === index ? 'w-6 bg-ink' : 'w-1.5 bg-track',
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {last && deferred ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => void promptInstall().then(finish)}
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Install Sukun
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => (last ? finish() : setIndex((i) => i + 1))}
            >
              {last ? 'Start focusing' : 'Next'}
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </Button>
          )}

          {last && (
            <Button variant="ghost" fullWidth onClick={finish}>
              Not now
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

const COPY = [
  {
    title: 'Work in focused blocks',
    body: 'Twenty-five minutes on, five off. The timer keeps running when you switch tabs, lock the phone, or close the laptop.',
  },
  {
    title: 'Give every session a purpose',
    body: 'Attach a task to the timer. Estimates, subtasks and a plan for today keep the next block obvious.',
  },
  {
    title: 'Keep it on your home screen',
    body: 'Install Sukun for full-screen focus, offline use and session notifications. It stays this fast.',
  },
] as const

const IOS_INSTALL_BODY =
  'Tap Share, then Add to Home Screen. On iPhone that is also the only way an alert can reach you when a session ends.'

/** A1 — the hero as it looks mid-session. */
function TimerPreview() {
  return (
    <HeroCard
      className="w-full"
      title="Focusing now"
      chip={<Pill tone="dark">Session 1 of 4</Pill>}
      value="25:00"
      sub="one block at a time"
    >
      <HeroWeekBars values={[0.75, 0.31, 0.54, 0.44, 0.69, 0.23, 0.5]} />
    </HeroCard>
  )
}

/** A2 — three task rows, one of them already done. */
function TasksPreview() {
  const rows = [
    { icon: FileText, title: 'Update API docs', meta: '2 of 4 sessions', done: false },
    { icon: Code2, title: 'Review pull requests', meta: '1 of 2 sessions', done: false },
    { icon: BookOpen, title: 'Read Deep Work', meta: 'Done · 2 sessions', done: true },
  ]

  return (
    <ul className="flex w-full flex-col rounded-lg bg-surface px-4 py-1 shadow-md">
      {rows.map((row) => (
        <li key={row.title} className="flex items-center gap-3 py-3">
          <IconTile icon={row.icon} tone={row.done ? 'green' : 'field'} size={40} />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-body font-medium',
                row.done ? 'text-ink-3' : 'text-ink',
              )}
            >
              {row.title}
            </span>
            <span className="block truncate text-body-sm text-ink-2">{row.meta}</span>
          </span>
          {row.done ? (
            <Check size={16} strokeWidth={2} className="text-green-deep" aria-hidden />
          ) : (
            <ArrowUpRight size={16} strokeWidth={1.75} className="text-ink" aria-hidden />
          )}
        </li>
      ))}
    </ul>
  )
}

/** A3 — the app icon, where it is going to live. */
function InstallPreview() {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-green px-4 py-8">
      <span className="inline-flex size-21 items-center justify-center rounded-[26px] bg-ink">
        <Logomark size={32} className="text-green" />
      </span>
      <span className="text-label text-ink">Sukun</span>
      <Pill tone="dark">Add to Home Screen</Pill>
    </div>
  )
}
