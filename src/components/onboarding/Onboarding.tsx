'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle2, Share, SquarePlus, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
 * First run — docs/05-screens.md S10.
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
 * Notification permission is deliberately NOT requested here. A cold prompt
 * gets denied, and a denial is permanent.
 */

/**
 * The heaviest thing onboarding can reach — thirty-two icons, the template
 * set, the tag editor — and card two is the earliest it can be needed.
 */
const TaskFormSheet = dynamic(
  () => import('@/components/tasks/TaskFormSheet').then((m) => m.TaskFormSheet),
  { ssr: false },
)

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
  const [taskSheet, setTaskSheet] = useState(false)
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
    <>
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
        className="fixed inset-0 z-50 items-end justify-center bg-canvas/95 backdrop-blur-sm sm:items-center"
      >
        <div className="flex w-full max-w-md flex-col gap-8 px-6 pb-10 pt-12 sm:pb-12">
          <div className="flex flex-col items-center gap-8 text-center">
            {index === 0 && (
              <Card
                icon={<Timer size={28} strokeWidth={1.5} />}
                title="Work in focused blocks"
                body="Twenty-five minutes on, five off. The timer keeps running when you switch tabs, lock the phone, or close the laptop."
              />
            )}
            {index === 1 && (
              <Card
                icon={<CheckCircle2 size={28} strokeWidth={1.5} />}
                title="Attach a session to real work"
                body="A timer with nothing behind it is a stopwatch. Give a session a task and the whole week adds up to something you can look at."
              />
            )}
            {index === 2 && (
              <Card
                icon={
                  isIOS() ? <Share size={28} strokeWidth={1.5} /> : <SquarePlus size={28} strokeWidth={1.5} />
                }
                title="Add it to your home screen"
                body={
                  isIOS()
                    ? 'Tap Share, then Add to Home Screen. On iPhone that is also the only way alerts can reach you when the session ends.'
                    : 'Install Sukun to open it like an app, keep it offline, and get an alert when a session ends.'
                }
              />
            )}
          </div>

          <div className="flex items-center justify-center gap-2" aria-hidden>
            {cards.map((card) => (
              <span
                key={card}
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-200',
                  card === index ? 'w-6 bg-accent' : 'w-1.5 bg-hairline-strong',
                )}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {index === 1 ? (
              <Button variant="primary" fullWidth onClick={() => setTaskSheet(true)}>
                Add your first task
              </Button>
            ) : index === 2 && deferred ? (
              <Button
                variant="primary"
                fullWidth
                onClick={() => void promptInstall().then(finish)}
              >
                Install Sukun
              </Button>
            ) : (
              <Button
                variant="primary"
                fullWidth
                onClick={() => (last ? finish() : setIndex((i) => i + 1))}
              >
                {last ? 'Start focusing' : 'Next'}
              </Button>
            )}

            <Button variant="ghost" fullWidth onClick={finish}>
              {last ? 'Not now' : 'Skip'}
            </Button>
          </div>
        </div>
      </div>

      <TaskFormSheet
        open={taskSheet}
        onClose={() => setTaskSheet(false)}
        onSaved={() => {
          setTaskSheet(false)
          if (showInstallCard) setIndex(2)
          else finish()
        }}
      />
    </>
  )
}

function Card({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <>
      <span className="accent-muted inline-flex size-16 items-center justify-center rounded-full text-accent">
        {icon}
      </span>
      <div className="flex flex-col gap-3">
        <Logomark size={20} className="mx-auto text-accent" />
        <h2 className="text-title-l font-display text-ink">{title}</h2>
        <p className="text-body text-ink-2">{body}</p>
      </div>
    </>
  )
}
