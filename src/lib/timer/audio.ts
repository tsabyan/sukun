/**
 * Phase-end alerts — docs/02-architecture.md §3.
 *
 * Tones are synthesised rather than loaded from files: nothing to precache,
 * nothing to fetch, and the alert still fires with a cold cache on a plane.
 *
 * iOS is the reason for most of this file. An AudioContext starts suspended
 * and only a real user gesture can resume it, so the context is unlocked
 * inside the first Start tap and kept warm — including across backgrounding,
 * which suspends it again.
 */

export interface SoundOption {
  id: string
  label: string
}

export const SOUNDS: SoundOption[] = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell', label: 'Bell' },
  { id: 'marimba', label: 'Marimba' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'soft', label: 'Soft' },
]

type Note = { freq: number; at: number; dur: number; gain: number; type: OscillatorType }

const VOICES: Record<string, Note[]> = {
  chime: [
    { freq: 880, at: 0, dur: 1.1, gain: 0.5, type: 'sine' },
    { freq: 1318.5, at: 0.08, dur: 1.0, gain: 0.32, type: 'sine' },
  ],
  bell: [
    { freq: 660, at: 0, dur: 1.6, gain: 0.45, type: 'sine' },
    { freq: 1980, at: 0, dur: 0.5, gain: 0.12, type: 'sine' },
  ],
  marimba: [
    { freq: 523.25, at: 0, dur: 0.35, gain: 0.5, type: 'triangle' },
    { freq: 783.99, at: 0.11, dur: 0.35, gain: 0.36, type: 'triangle' },
  ],
  pulse: [
    { freq: 720, at: 0, dur: 0.12, gain: 0.32, type: 'square' },
    { freq: 720, at: 0.2, dur: 0.12, gain: 0.32, type: 'square' },
    { freq: 960, at: 0.4, dur: 0.18, gain: 0.32, type: 'square' },
  ],
  soft: [
    { freq: 392, at: 0, dur: 1.4, gain: 0.4, type: 'triangle' },
    { freq: 587.33, at: 0.18, dur: 1.2, gain: 0.24, type: 'triangle' },
  ],
}

let context: AudioContext | null = null
let unlocked = false

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (context) return context

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  context = new Ctor()
  return context
}

/**
 * Call from inside a real user gesture — the Start button's click handler.
 * The silent buffer is what marks the context as user-activated on iOS; it is
 * not optional and it is not superstition.
 */
export function unlockAudio() {
  const ctx = ensureContext()
  if (!ctx) return

  void ctx.resume()

  if (!unlocked) {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    unlocked = true
  }
}

/** iOS suspends the context when the tab goes away. Bring it back on return. */
export function resumeAudioIfNeeded() {
  if (context && context.state === 'suspended') void context.resume()
}

export function playAlert(soundId: string, volume: number) {
  if (volume <= 0) return

  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const notes = VOICES[soundId] ?? VOICES.chime
  const start = ctx.currentTime + 0.01

  for (const note of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = note.type
    osc.frequency.setValueAtTime(note.freq, start + note.at)

    // Quick attack, exponential decay — a linear fade reads as a click.
    const peak = Math.max(0.0001, note.gain * volume)
    gain.gain.setValueAtTime(0.0001, start + note.at)
    gain.gain.exponentialRampToValueAtTime(peak, start + note.at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur)

    osc.connect(gain).connect(ctx.destination)
    osc.start(start + note.at)
    osc.stop(start + note.at + note.dur + 0.05)
  }
}

/** Settings previews the sound on tap. */
export function previewSound(soundId: string, volume: number) {
  unlockAudio()
  playAlert(soundId, volume)
}
