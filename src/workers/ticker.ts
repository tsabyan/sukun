/**
 * The tick source — docs/02-architecture.md §3.
 *
 * A dedicated worker, because browsers throttle main-thread timers hard once a
 * tab is backgrounded but are far gentler on workers.
 *
 * It holds no state and carries no payload. The message means "recompute", and
 * the main thread derives everything from `endsAt`. A dropped tick therefore
 * costs nothing — the next one produces exactly the same answer.
 */

const INTERVAL_MS = 250

let handle: ReturnType<typeof setInterval> | null = null

function start() {
  if (handle !== null) return
  handle = setInterval(() => {
    postMessage('tick')
  }, INTERVAL_MS)
}

function stop() {
  if (handle === null) return
  clearInterval(handle)
  handle = null
}

self.onmessage = (event: MessageEvent<'start' | 'stop'>) => {
  if (event.data === 'start') start()
  else if (event.data === 'stop') stop()
}
