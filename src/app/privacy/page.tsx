'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { IconButton } from '@/components/ui/Button'

/**
 * The privacy page — docs/08-deployment.md §8.
 *
 * Written to be true rather than to be safe. A local-first app has an unusual
 * and genuinely good story here, and the only way that story is worth anything
 * is if every sentence on this page matches what the code does. If the code
 * changes, this changes with it.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title-s text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-body text-ink-2">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Privacy"
        leading={
          <IconButton label="Back" onClick={() => router.back()}>
            <ChevronLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
      />

      <p className="text-body text-ink-2">
        Ajeg runs on your device. Tasks, sessions, habits and settings are written to
        your browser&rsquo;s own storage and stay there unless you sign in.
      </p>

      <Section title="What stays on your device">
        <p>
          Everything you type. Task titles, descriptions, subtasks, tag names, notes,
          habit names, every completed session and every setting. None of it is sent
          anywhere while you are signed out.
        </p>
      </Section>

      <Section title="What is sent, and when">
        <p>
          <strong className="text-ink">If you sign in</strong> with Google or an email
          link, your data syncs to our database so it can reach your other devices. It is
          readable only by your account — enforced by the database itself, not by the app.
        </p>
        <p>
          <strong className="text-ink">Whether or not you sign in</strong>, the app sends a
          small anonymous count: a random id generated on your device, the calendar date,
          and the name of what happened — that the app was opened, that a session was
          completed, that the planner was run. That is the whole list.
        </p>
        <p>
          The random id is not derived from anything. It is not your IP address, not a
          fingerprint, not an advertising id, and it cannot be linked back to you. It
          identifies an installation so we can tell whether people keep using the app,
          which is the only thing it is for.
        </p>
        <p>
          <strong className="text-ink">Nothing you write is ever included.</strong> No task
          titles, no notes, no tag names, no habit names — not in a count, not in an error
          report, not anywhere.
        </p>
      </Section>

      <Section title="Your email">
        <p>
          We store an email address in exactly two cases: you signed in with one, or you
          joined the waitlist for the paid tier. In the second case it is used to email you
          about that, once, and nothing else.
        </p>
      </Section>

      <Section title="Third parties">
        <p>
          There are none. No analytics service, no advertising, no tracking pixels, no
          embedded scripts from anyone. The app talks to our database and to nothing else.
        </p>
        <p>
          Hosting is Vercel; the database is Supabase. Sign-in with Google goes through
          Google, which sees that you signed in to Ajeg.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>
          Settings &rarr; Data &rarr; Delete all data removes everything on the device
          immediately. If you have an account, email us and the account and its rows are
          deleted — no form, no retention period.
        </p>
        <p>
          You can also export everything as a JSON file first, from the same place.
        </p>
      </Section>

      <Section title="Children">
        <p>Ajeg is not directed at children under 13 and collects nothing knowingly from them.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this changes, the page changes, and the change appears in the app&rsquo;s
          changelog rather than quietly.
        </p>
      </Section>
    </div>
  )
}
