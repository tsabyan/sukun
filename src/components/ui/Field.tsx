'use client'

import { useId } from 'react'
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
  children: (id: string, describedBy: string | undefined) => React.ReactNode
  className?: string
}

function FieldShell({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="eyebrow flex items-center gap-2 text-ink-3">
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
  wrapperClassName?: string
}

export function Field({
  label,
  hint,
  error,
  optional,
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
      className={wrapperClassName}
    >
      {(id, describedBy) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, error && 'border-ember', className)}
          {...props}
        />
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
