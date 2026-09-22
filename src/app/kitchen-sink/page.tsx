'use client'

import { useState } from 'react'
import { Check, Flame, Play, Plus, RotateCcw, SkipForward, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, SectionLabel } from '@/components/ui/Card'
import { Field, TextAreaField } from '@/components/ui/Field'
import { ChipButton, Pill, PriorityDot } from '@/components/ui/Pill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { Mascot, Wordmark } from '@/components/brand/Mascot'
import { useTheme, type Phase, type ThemePreference } from '@/lib/theme/use-theme'

const TASK_COLORS = [
  'sage',
  'slate',
  'iris',
  'apricot',
  'clay',
  'moss',
  'fog',
  'plum',
] as const

export default function KitchenSink() {
  const { preference, resolved, setPreference, phase, setPhase } = useTheme()

  const [segment, setSegment] = useState<'active' | 'completed'>('active')
  const [toggleOn, setToggleOn] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [chips, setChips] = useState<string[]>(['bug'])
  const [title, setTitle] = useState('')

  const toggleChip = (tag: string) =>
    setChips((c) => (c.includes(tag) ? c.filter((t) => t !== tag) : [...c, tag]))

  return (
    <div className="flex flex-col gap-10 pb-16">
      <header className="flex flex-col gap-4">
        <Wordmark size={24} />
        <p className="text-body text-ink-2">
          Every component, every state. Switch theme and phase to check both.
        </p>

        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4">
          <div className="flex flex-col gap-2">
            <SectionLabel className="mb-0">
              Theme — resolved: {resolved}
            </SectionLabel>
            <SegmentedControl<ThemePreference>
              aria-label="Theme"
              segments={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={preference}
              onChange={setPreference}
            />
          </div>

          <div className="flex flex-col gap-2">
            <SectionLabel className="mb-0">Phase accent</SectionLabel>
            <SegmentedControl<Phase>
              aria-label="Timer phase"
              segments={[
                { value: 'focus', label: 'Focus' },
                { value: 'short_break', label: 'Short' },
                { value: 'long_break', label: 'Long' },
              ]}
              value={phase}
              onChange={setPhase}
            />
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ brand */}
      <Section title="Brand">
        <div className="flex flex-wrap items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <Mascot size={64} mood="happy" />
            <span className="eyebrow text-ink-3">mascot 64 · happy</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Mascot size={32} mood="thinking" />
            <span className="eyebrow text-ink-3">32 · thinking</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Mascot size={20} mood="resting" />
            <span className="eyebrow text-ink-3">20 · resting</span>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Wordmark size={28} />
            <Wordmark size={18} />
            <span className="eyebrow text-ink-3">lockup</span>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- typography */}
      <Section title="Typography">
        <div className="flex flex-col gap-4">
          <p className="numerals text-display-xl text-ink">24:13</p>
          <p className="numerals text-display-l text-ink">24:13</p>
          <p className="numerals text-display-m text-ink">15h 25m</p>
          <p className="text-title-l font-display text-ink">Screen title</p>
          <p className="text-title-m text-ink">Card title</p>
          <p className="text-body text-ink">
            Body copy. Plain verbs, sentence case, no filler.
          </p>
          <p className="text-body-sm text-ink-2">
            Secondary row — supporting detail lives here.
          </p>
          <p className="eyebrow text-ink-3">Focus · 3 of 4</p>
        </div>
      </Section>

      {/* ----------------------------------------------------------- colors */}
      <Section title="Color">
        <div className="flex flex-col gap-5">
          <Swatches
            label="Surfaces"
            items={[
              ['canvas', 'bg-canvas'],
              ['surface', 'bg-surface'],
              ['raised', 'bg-surface-raised'],
              ['sunken', 'bg-surface-sunken'],
            ]}
          />
          <Swatches
            label="Accent & priority"
            items={[
              ['accent', 'bg-accent'],
              ['ember', 'bg-ember'],
              ['high', 'bg-priority-high'],
              ['medium', 'bg-priority-medium'],
              ['low', 'bg-priority-low'],
            ]}
          />
          <Swatches
            label="Task colors"
            items={TASK_COLORS.map((c) => [c, `bg-task-${c}`] as [string, string])}
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------- buttons */}
      <Section title="Button">
        <div className="flex flex-col gap-4">
          <Row>
            <Button variant="primary">Start focus</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
          </Row>
          <Row>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </Row>
          <Row>
            <Button variant="primary">
              <Plus size={18} strokeWidth={1.75} />
              With icon
            </Button>
          </Row>
          <Button variant="primary" fullWidth>
            Full width
          </Button>
        </div>
      </Section>

      <Section title="Icon button">
        <Row>
          <IconButton label="Reset">
            <RotateCcw size={20} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Skip">
            <SkipForward size={20} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Start" variant="primary" size={64}>
            <Play size={26} strokeWidth={1.75} fill="currentColor" />
          </IconButton>
          <IconButton label="Delete" variant="destructive">
            <Trash2 size={20} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Disabled" disabled>
            <Check size={20} strokeWidth={1.75} />
          </IconButton>
        </Row>
      </Section>

      {/* ------------------------------------------------------------ cards */}
      <Section title="Card">
        <div className="flex flex-col gap-3">
          <Card>
            <p className="text-title-m text-ink">Static card</p>
            <p className="mt-1 text-body-sm text-ink-2">
              Surface, hairline border, soft shadow.
            </p>
          </Card>
          <Card interactive>
            <p className="text-title-m text-ink">Interactive card</p>
            <p className="mt-1 text-body-sm text-ink-2">
              Hover lifts it, press settles it.
            </p>
          </Card>
          <Card padding="compact" className="flex items-center gap-3">
            <Flame size={20} strokeWidth={1.75} className="text-accent" />
            <div className="flex-1">
              <p className="text-body text-ink">6 day streak</p>
              <p className="text-body-sm text-ink-2">3 of 5 sessions · 1h 15m</p>
            </div>
            <span className="numerals text-title-m text-ink">48</span>
          </Card>
        </div>
      </Section>

      {/* ------------------------------------------------------- segmented  */}
      <Section title="Segmented control">
        <SegmentedControl
          aria-label="Task filter"
          segments={[
            { value: 'active', label: 'Active', count: 8 },
            { value: 'completed', label: 'Completed' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      {/* --------------------------------------------------------- toggles  */}
      <Section title="Toggle">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-body text-ink">Auto-start breaks</span>
            <Toggle checked={toggleOn} onChange={setToggleOn} label="Auto-start breaks" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-ink-3">Disabled, on</span>
            <Toggle checked disabled onChange={() => {}} label="Disabled on" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-ink-3">Disabled, off</span>
            <Toggle checked={false} disabled onChange={() => {}} label="Disabled off" />
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- pills   */}
      <Section title="Pill, chip, priority">
        <div className="flex flex-col gap-4">
          <Row>
            <Pill>Neutral</Pill>
            <Pill tone="accent">Pro</Pill>
            <Pill tone="high">
              <PriorityDot priority="high" />
              High
            </Pill>
            <Pill tone="medium">
              <PriorityDot priority="medium" />
              Medium
            </Pill>
            <Pill tone="low">
              <PriorityDot priority="low" />
              Low
            </Pill>
          </Row>
          <Row>
            {['bug', 'code-review', 'docs', 'health', 'learning'].map((tag) => (
              <ChipButton
                key={tag}
                selected={chips.includes(tag)}
                onClick={() => toggleChip(tag)}
              >
                {tag}
              </ChipButton>
            ))}
          </Row>
        </div>
      </Section>

      {/* ---------------------------------------------------------- fields  */}
      <Section title="Field">
        <div className="flex flex-col gap-5">
          <Field
            label="Title"
            placeholder="What do you want to do?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field label="Due date" type="date" hint="Optional. Leave empty for no deadline." />
          <Field
            label="Email"
            placeholder="you@example.com"
            error="That address doesn't look right."
          />
          <Field label="Disabled" placeholder="Not editable" disabled />
          <TextAreaField label="Notes" optional placeholder="Add details or notes…" />
        </div>
      </Section>

      {/* ---------------------------------------------------------- sheet   */}
      <Section title="Sheet">
        <Button variant="primary" onClick={() => setSheetOpen(true)}>
          Open bottom sheet
        </Button>
        <p className="mt-3 text-body-sm text-ink-2">
          Drag the grabber up to expand, down to dismiss. Esc closes it.
        </p>
      </Section>

      {/* --------------------------------------------------------- surfaces */}
      <Section title="Material & washes">
        <div className="flex flex-col gap-3">
          <div className="material rounded-lg border border-hairline p-4 text-body text-ink">
            .material — translucent, saturated, blurred
          </div>
          <div className="accent-muted rounded-lg p-4 text-body text-accent">
            .accent-muted — 18% accent
          </div>
          <div className="accent-quiet rounded-lg p-4 text-body text-accent">
            .accent-quiet — 9% accent
          </div>
        </div>
      </Section>

      <Section title="Elevation">
        <Row>
          {(['shadow-sm', 'shadow-md', 'shadow-lg'] as const).map((s) => (
            <div
              key={s}
              className={`flex size-24 items-center justify-center rounded-lg bg-surface ${s}`}
            >
              <span className="eyebrow text-ink-3">{s.replace('shadow-', '')}</span>
            </div>
          ))}
        </Row>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="New task"
        action={
          <Button variant="primary" size="sm" onClick={() => setSheetOpen(false)}>
            Save
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Title" placeholder="What do you want to do?" />
          <TextAreaField label="Notes" optional placeholder="Add details or notes…" />
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-ink-3">Priority</span>
            <SegmentedControl
              aria-label="Priority"
              segments={[
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              value="medium"
              onChange={() => {}}
            />
          </div>
          <p className="text-body-sm text-ink-3">
            Scroll and drag both work. The real create sheet lands in Phase 4.
          </p>
        </div>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ local */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel className="mb-0">{title}</SectionLabel>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

function Swatches({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-ink-3">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map(([name, cls]) => (
          <div key={name} className="flex flex-col items-center gap-1.5">
            <div className={`size-14 rounded-md border border-hairline ${cls}`} />
            <span className="text-[11px] text-ink-3">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
