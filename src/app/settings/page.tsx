'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { SettingsGroup, SettingsRow, SettingsButtonRow } from '@/components/settings/SettingsList'
import { AccountGroup } from '@/components/settings/AccountGroup'
import { WheelPickerSheet } from '@/components/ui/WheelPicker'
import { Sheet } from '@/components/ui/Sheet'
import { Button, IconButton } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Toggle } from '@/components/ui/Toggle'
import { ChipButton } from '@/components/ui/Pill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { toast } from '@/components/ui/Toast'
import { deleteAllData, exportAll, getSettings, importAll, updateSettings } from '@/lib/db/repo'
import { exportBundleSchema } from '@/lib/db/validators'
import { SOUNDS, previewSound } from '@/lib/timer/audio'
import {
  notificationState,
  requestNotificationPermission,
} from '@/lib/timer/notifications'
import { useTimerStore } from '@/lib/timer/store'
import { setHapticsEnabled } from '@/lib/utils/haptics'
import type { ExportBundle, Settings } from '@/lib/db/types'

const APP_VERSION = '0.1.0'

const MINUTE_CHOICES = {
  focus: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90],
  shortBreak: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20],
  longBreak: [5, 10, 15, 20, 25, 30, 40, 45, 60],
  cycle: [2, 3, 4, 5, 6, 7, 8],
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type PickerKey = 'focus' | 'shortBreak' | 'longBreak' | 'cycle' | null

export default function SettingsPage() {
  const router = useRouter()
  const settings = useLiveQuery(() => getSettings(), [])
  const [picker, setPicker] = useState<PickerKey>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!settings) {
    return <div className="h-[60dvh] animate-pulse rounded-lg bg-hairline" />
  }

  /** Every control writes immediately — there is no Save button by design. */
  const save = async (patch: Partial<Settings>) => {
    await updateSettings(patch)
    if (patch.hapticsEnabled !== undefined) setHapticsEnabled(patch.hapticsEnabled)
    await useTimerStore.getState().refreshSettings()
  }

  const handleExport = async () => {
    const bundle = await exportAll()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sukun-${bundle.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast('Data exported')
  }

  const handleImport = async (file: File) => {
    try {
      const parsed = exportBundleSchema.parse(JSON.parse(await file.text()))
      await importAll(parsed as unknown as ExportBundle)
      toast('Data imported')
    } catch {
      toast("That file isn't a Sukun export")
    }
  }

  const notifications = notificationState()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        leading={
          <IconButton label="Back" onClick={() => router.back()}>
            <ChevronLeft size={22} strokeWidth={1.75} />
          </IconButton>
        }
      />

      <SettingsGroup title="Timer">
        <SettingsButtonRow
          label="Focus length"
          value={`${settings.focusMinutes} min`}
          onClick={() => setPicker('focus')}
        />
        <SettingsButtonRow
          label="Short break"
          value={`${settings.shortBreakMinutes} min`}
          onClick={() => setPicker('shortBreak')}
        />
        <SettingsButtonRow
          label="Long break"
          value={`${settings.longBreakMinutes} min`}
          onClick={() => setPicker('longBreak')}
        />
        <SettingsButtonRow
          label="Sessions until long break"
          value={String(settings.sessionsUntilLongBreak)}
          onClick={() => setPicker('cycle')}
        />
        <SettingsRow label="Auto-start breaks">
          <Toggle
            label="Auto-start breaks"
            checked={settings.autoStartBreaks}
            onChange={(v) => void save({ autoStartBreaks: v })}
          />
        </SettingsRow>
        <SettingsRow label="Auto-start next session">
          <Toggle
            label="Auto-start next session"
            checked={settings.autoStartFocus}
            onChange={(v) => void save({ autoStartFocus: v })}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Sound and alerts" footnote="Tap a sound to hear it.">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {SOUNDS.map((sound) => (
            <ChipButton
              key={sound.id}
              selected={sound.id === settings.soundId}
              onClick={() => {
                previewSound(sound.id, settings.volume)
                void save({ soundId: sound.id })
              }}
            >
              {sound.label}
            </ChipButton>
          ))}
        </div>

        <SettingsRow label="Volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            aria-label="Alert volume"
            onChange={(e) => void save({ volume: Number(e.target.value) })}
            className="w-32 accent-[var(--accent)]"
          />
        </SettingsRow>

        <SettingsRow
          label="Notifications"
          description={
            notifications === 'unsupported'
              ? 'Not available in this browser'
              : notifications === 'denied'
                ? 'Blocked — turn it back on in browser settings'
                : 'An alert when a session ends'
          }
        >
          <Toggle
            label="Notifications"
            disabled={notifications === 'unsupported' || notifications === 'denied'}
            checked={settings.notificationsEnabled && notifications === 'granted'}
            onChange={async (next) => {
              if (!next) {
                await save({ notificationsEnabled: false })
                return
              }
              const result = await requestNotificationPermission()
              await save({ notificationsEnabled: result === 'granted' })
              if (result === 'denied') toast('Notifications are blocked for this site')
            }}
          />
        </SettingsRow>

        <SettingsRow label="Haptics" description="A short buzz on phase changes">
          <Toggle
            label="Haptics"
            checked={settings.hapticsEnabled}
            onChange={(v) => void save({ hapticsEnabled: v })}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-body text-ink">Theme</span>
          <SegmentedControl
            aria-label="Theme"
            segments={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={settings.theme}
            onChange={(theme) => {
              void save({ theme })
              void import('@/lib/theme/store').then((m) => m.setPreference(theme))
            }}
          />
        </div>

        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-body text-ink">Default timer view</span>
          <SegmentedControl
            aria-label="Default timer view"
            segments={[
              { value: 'ring', label: 'Ring' },
              { value: 'flip', label: 'Flip clock' },
            ]}
            value={settings.defaultTimerMode}
            onChange={(defaultTimerMode) => void save({ defaultTimerMode })}
          />
        </div>

        <SettingsRow label="Week starts on">
          <select
            value={settings.weekStartsOn}
            aria-label="Week starts on"
            onChange={(e) => void save({ weekStartsOn: Number(e.target.value) })}
            className="rounded-md border border-hairline bg-surface-sunken px-3 py-2 text-body text-ink"
          >
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsGroup>

      <AccountGroup />

      <SettingsGroup title="Data">
        <SettingsButtonRow
          label="Export"
          description="Download everything as JSON"
          onClick={() => void handleExport()}
        />
        <SettingsButtonRow
          label="Import"
          description="Merges — nothing is overwritten by an older copy"
          onClick={() => fileInput.current?.click()}
        />
        <SettingsButtonRow
          label="Delete all data"
          destructive
          onClick={() => setDeleteOpen(true)}
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow label="Version" description={`Sukun ${APP_VERSION}`} />
        <SettingsButtonRow
          label="Send feedback"
          onClick={() => {
            window.location.href = `mailto:hello@example.com?subject=Sukun%20${APP_VERSION}%20feedback`
          }}
        />
      </SettingsGroup>

      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImport(file)
          e.target.value = ''
        }}
      />

      <WheelPickerSheet
        open={picker === 'focus'}
        onClose={() => setPicker(null)}
        title="Focus length"
        suffix="min"
        values={MINUTE_CHOICES.focus}
        value={settings.focusMinutes}
        onChange={(focusMinutes) => void save({ focusMinutes })}
      />
      <WheelPickerSheet
        open={picker === 'shortBreak'}
        onClose={() => setPicker(null)}
        title="Short break"
        suffix="min"
        values={MINUTE_CHOICES.shortBreak}
        value={settings.shortBreakMinutes}
        onChange={(shortBreakMinutes) => void save({ shortBreakMinutes })}
      />
      <WheelPickerSheet
        open={picker === 'longBreak'}
        onClose={() => setPicker(null)}
        title="Long break"
        suffix="min"
        values={MINUTE_CHOICES.longBreak}
        value={settings.longBreakMinutes}
        onChange={(longBreakMinutes) => void save({ longBreakMinutes })}
      />
      <WheelPickerSheet
        open={picker === 'cycle'}
        onClose={() => setPicker(null)}
        title="Sessions until long break"
        values={MINUTE_CHOICES.cycle}
        value={settings.sessionsUntilLongBreak}
        onChange={(sessionsUntilLongBreak) => void save({ sessionsUntilLongBreak })}
      />

      <DeleteEverythingSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  )
}

/**
 * Typing the word is the point. This is the one action in the app with no
 * undo, so it should cost more than a tap.
 */
function DeleteEverythingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState('')

  const run = async () => {
    await deleteAllData()
    setConfirmation('')
    onClose()
    toast('All data deleted')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Delete all data" snapPoints={[0.45]}>
      <div className="flex flex-col gap-5">
        <p className="text-body text-ink-2">
          Every task, session and record on this device is removed. This cannot be undone,
          and there is no backup unless you exported one.
        </p>
        <Field
          label="Type DELETE to confirm"
          value={confirmation}
          autoComplete="off"
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Button
          variant="destructive"
          fullWidth
          disabled={confirmation !== 'DELETE'}
          onClick={() => void run()}
        >
          Delete everything
        </Button>
      </div>
    </Sheet>
  )
}
