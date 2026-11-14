import { useSyncExternalStore } from 'react'

/** localStorage key of the "show next-step hints" switch (default on). */
export const HINTS_KEY = 'agentra-next-step-hints'

const listeners = new Set<() => void>()
let memory: boolean | null = null

/** Whether next-step toasts are shown; storage failures fall back to on. */
export function hintsEnabled(): boolean {
  if (memory !== null) return memory
  try {
    return localStorage.getItem(HINTS_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setHintsEnabled(enabled: boolean): void {
  memory = enabled
  try {
    localStorage.setItem(HINTS_KEY, enabled ? 'on' : 'off')
    memory = null
  } catch {
    // Keep the choice for this tab only.
  }
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React view of the hint switch. */
export function useHintsEnabled(): boolean {
  return useSyncExternalStore(subscribe, hintsEnabled, () => true)
}

/** Test helper. */
export function resetHintsForTests(): void {
  memory = null
}
