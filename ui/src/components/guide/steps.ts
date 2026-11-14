import { msg } from '@/lib/i18n/core'

/** State of one step, always derived from server data. */
export type StepState = 'done' | 'current' | 'blocked' | 'todo' | 'skipped'

export interface WorkflowStep {
  key: string
  /** Translated step name. */
  label: string
  /** Translated role that performs the step, e.g. "Kế toán". */
  role?: string
  state: StepState
  /** Translated explanation shown in the tooltip (why blocked, what happens). */
  hint?: string
}

/** Written state of a step (message IDs); status is never colour only. */
export const STEP_STATE_TEXT: Record<StepState, string> = {
  done: msg('Đã xong'),
  current: msg('Bước hiện tại'),
  blocked: msg('Đang bị chặn'),
  todo: msg('Chưa tới'),
  skipped: msg('Không áp dụng'),
}
