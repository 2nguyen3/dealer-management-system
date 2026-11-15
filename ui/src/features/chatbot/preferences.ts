import { useSyncExternalStore } from 'react'

/** localStorage key of the floating assistant's visibility and position. */
export const ASSISTANT_KEY = 'agentra-assistant'

/** Which inline edge the companion rests on, and its distance from the bottom. */
export interface AssistantPlacement {
  hidden: boolean
  side: 'start' | 'end'
  bottom: number
}

export const DEFAULT_PLACEMENT: AssistantPlacement = {
  hidden: false,
  side: 'end',
  bottom: 24,
}

const listeners = new Set<() => void>()
let memory: AssistantPlacement | null = null
let cachedRaw: string | null | undefined
let cachedValue: AssistantPlacement = DEFAULT_PLACEMENT

function parse(raw: string | null): AssistantPlacement {
  if (!raw) return DEFAULT_PLACEMENT
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return DEFAULT_PLACEMENT
    const record = value as Record<string, unknown>
    return {
      hidden: record.hidden === true,
      side: record.side === 'start' ? 'start' : 'end',
      bottom:
        typeof record.bottom === 'number' && Number.isFinite(record.bottom)
          ? Math.max(8, Math.min(2000, Math.round(record.bottom)))
          : DEFAULT_PLACEMENT.bottom,
    }
  } catch {
    return DEFAULT_PLACEMENT
  }
}

/** Current placement; storage failures fall back to the default (visible). */
export function assistantPlacement(): AssistantPlacement {
  if (memory) return memory
  let raw: string | null = null
  try {
    raw = localStorage.getItem(ASSISTANT_KEY)
  } catch {
    return DEFAULT_PLACEMENT
  }
  // Same snapshot object while storage is unchanged (useSyncExternalStore).
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedValue = parse(raw)
  }
  return cachedValue
}

export function setAssistantPlacement(
  change: Partial<AssistantPlacement>,
): void {
  const next = { ...assistantPlacement(), ...change }
  memory = next
  try {
    localStorage.setItem(ASSISTANT_KEY, JSON.stringify(next))
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

export function useAssistantPlacement(): AssistantPlacement {
  return useSyncExternalStore(
    subscribe,
    assistantPlacement,
    () => DEFAULT_PLACEMENT,
  )
}

/** Test helper. */
export function resetAssistantPlacementForTests(): void {
  memory = null
  cachedRaw = undefined
  cachedValue = DEFAULT_PLACEMENT
}
