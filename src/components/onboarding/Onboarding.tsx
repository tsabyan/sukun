'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Share, SquarePlus, Timer } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { Logomark } from '@/components/brand/Logomark'

/**
 * The form is the heaviest thing onboarding can reach — thirty-two icons, the
 * template set, the tag editor — and card two is the earliest it can be
 * needed. Loading it with the overlay would put all of that in front of the
 * first paint of a screen whose whole job is to appear instantly.
 */
const TaskFormSheet = dynamic(
  () => import('@/components/tasks/TaskFormSheet').then((m) => m.TaskFormSheet),
  { ssr: false },
)
import { db, getMeta, META_KEYS, setMeta } from '@/lib/db/schema'
import {
  isIOS,
  isStandalone,
  promptInstall,
  useInstallStore,
  watchInstallPrompt,
} from '@/lib/pwa/install'
import { ease, dur } from '@/lib/motion/tokens'
import { cn } from '@/lib/utils/cn'

/**
 * First run — docs/05-screens.md S10.
 *
 * Three cards, skippable from the first one. Notification permission is
 * deliberately NOT requested here: a cold prompt gets denied, and a denial is
 * permanent. It is asked for after the first completed session instead.
 */
export function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)
  const [taskSheet, setTaskSheet] = useState(false)
  const deferred = useInstallStore((s) => s.deferred)

  useEffect(() => {
    let cancelled = false

    const decide = async () => {
      // Skip for anyone with history — a returning user on a new browser
      // should not be introduced to an app they already use.
      const [onboarded, taskCount, sessionCount] = await Promise.all([
        getMeta<string>(META_KEYS.onboardedAt),
        db.tasks.count(),
        db.sessions.count(),
      ])
      if (cancelled) return
      if (!onboarded && taskCount === 0 && sessionCount === 0) setVisible(true)
    }

    void decide()
    // Chromium fires beforeinstallprompt once, early — capture it here or the
    // Install button on card three has nothing to call.
    const stopWatching = watchInstallPrompt()

    return () => {
      cancelled = true
      stopWatching()
    }
  }, [])

  const finish = async () => {
    setVisible(false)
    await setMeta(META_KEYS.onboardedAt, new Date().toISOString())
  }

  const showInstallCard = !isStandalone()
  const cards = [0, 1, ...(showInstallCard ? [2] : [])]
  const last = index === cards.length - 1

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.base }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/95 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to Sukun"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: dur.slow, ease: ease.ios }}
              className="flex w-full max-w-md flex-col gap-8 px-6 pb-10 pt-12 sm:pb-12"
            >
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
                    icon={isIOS() ? <Share size={28} strokeWidth={1.5} /> : <SquarePlus size={28} strokeWidth={1.5} />}
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
                    onClick={() => void promptInstall().then(() => void finish())}
                  >
                    Install Sukun
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => (last ? void finish() : setIndex((i) => i + 1))}
                  >
                    {last ? 'Start focusing' : 'Next'}
                  </Button>
                )}

                <Button variant="ghost" fullWidth onClick={() => void finish()}>
                  {last ? 'Not now' : 'Skip'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TaskFormSheet
        open={taskSheet}
        onClose={() => setTaskSheet(false)}
        onSaved={() => {
          setTaskSheet(false)
          if (showInstallCard) setIndex(2)
          else void finish()
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
