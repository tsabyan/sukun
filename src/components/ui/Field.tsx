'use client'

import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const CONTROL = cn(
  'w-full rounded-md border border-hairline bg-surface-sunken px-3.5 py-3',
  'text-body text-ink placeholder:text-ink-3',
  'transition-colors duration-150',
  'hover:border-hairline-strong focus:border-accent focus:outline-none',
  'disabled:pointer-events-none disabled:opacity-[0.38]',
)

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  /**
   * Hide the eyebrow, keeping it for screen readers. For the one-field forms
   * where the placeholder and the button already say what the field is and a
   * label above it only adds a line — the waitlist, the sign-in link.
   */
  labelHidden?: boolean
  children: (id: string, describedBy: string | undefined) => React.ReactNode
  className?: string
}

function FieldShell({
  label,
  hint,
  error,
  optional,
  labelHidden,
  children,
  className,
}: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={id}
        className={cn(
          'eyebrow flex items-center gap-2 text-ink-3',
          labelHidden && 'sr-only',
        )}
      >
        {label}
        {optional && <span className="normal-case tracking-normal">(optional)</span>}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={errorId} className="text-body-sm text-ember">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-body-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  labelHidden?: boolean
  /** a quiet glyph inside the control, on the leading edge */
  icon?: LucideIcon
  wrapperClassName?: string
  /** React 19 takes ref as an ordinary prop — no forwardRef needed */
  ref?: React.Ref<HTMLInputElement>
}

export function Field({
  label,
  hint,
  error,
  optional,
  labelHidden,
  icon: Icon,
  wrapperClassName,
  className,
  ...props
}: InputProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      labelHidden={labelHidden}
      className={wrapperClassName}
    >
      {(id, describedBy) => (
        <div className="relative">
          {Icon && (
            <Icon
              size={17}
              strokeWidth={1.75}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
            />
          )}
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn(CONTROL, Icon && 'pl-11', error && 'border-ember', className)}
            {...props}
          />
        </div>
      )}
    </FieldShell>
  )
}

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  wrapperClassName?: string
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  wrapperClassName,
  className,
  rows = 3,
  ...props
}: TextAreaProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={wrapperClassName}
    >
      {(id, describedBy) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, 'resize-none', error && 'border-ember', className)}
          {...props}
        />
      )}
    </FieldShell>
  )
}
