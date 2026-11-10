import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Intent } from '../features/payment_receipts/contracts'
import * as api from '../lib/api'

describe('payment Intent recovery', () => {
  const options = { method: 'POST' as const, body: { amount: '10000' } }

  beforeEach(() => vi.restoreAllMocks())

  it.each([
    new api.ApiError(409, 'COMMAND_OUTCOME_UNKNOWN', 'Outcome unknown'),
    new api.ApiError(408, 'HTTP_408', 'Timeout'),
    new api.ApiError(503, 'HTTP_503', 'Unavailable'),
    new TypeError('Network failure'),
  ])(
    'retains identical body and key after uncertain failure: %s',
    async (failure) => {
      const send = vi
        .spyOn(api, 'apiFetch')
        .mockRejectedValueOnce(failure)
        .mockResolvedValue({ status: 200, data: {}, etag: null })
      const intent = new Intent()
      await expect(intent.send('/online-payments', options)).rejects.toBe(
        failure,
      )
      await expect(
        intent.send('/online-payments', {
          ...options,
          body: { amount: '20000' },
        }),
      ).rejects.toThrow('Giữ nguyên nội dung')
      expect(send).toHaveBeenCalledTimes(1)
      await intent.send('/online-payments', options)
      expect(send.mock.calls[1]).toEqual(send.mock.calls[0])
      expect(send.mock.calls[0]?.[1]?.idempotencyKey).toBeTruthy()
    },
  )

  it.each([200, 201, 204])(
    'clears a terminal %s response so the next write has a new key',
    async (status) => {
      const send = vi
        .spyOn(api, 'apiFetch')
        .mockResolvedValue({ status, data: {}, etag: null })
      const intent = new Intent()
      await intent.send('/online-payments', {
        ...options,
        retainAccepted: true,
      })
      await intent.send('/online-payments', {
        ...options,
        retainAccepted: true,
      })
      expect(send.mock.calls[1]?.[1]?.idempotencyKey).not.toBe(
        send.mock.calls[0]?.[1]?.idempotencyKey,
      )
      expect(send.mock.calls[0]?.[1]).not.toHaveProperty('retainAccepted')
    },
  )

  it('retains accepted checkout creation across repeated 202, then clears on 200', async () => {
    const send = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValueOnce({ status: 202, data: {}, etag: null })
      .mockResolvedValueOnce({ status: 202, data: {}, etag: null })
      .mockResolvedValue({ status: 200, data: {}, etag: null })
    const intent = new Intent()
    const resumable = { ...options, retainAccepted: true }
    await intent.send('/online-payments', resumable)
    await intent.send('/online-payments', resumable)
    await intent.send('/online-payments', resumable)
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0])
    expect(send.mock.calls[2]).toEqual(send.mock.calls[0])
    await intent.send('/online-payments', resumable)
    expect(send.mock.calls[3]?.[1]?.idempotencyKey).not.toBe(
      send.mock.calls[0]?.[1]?.idempotencyKey,
    )
  })

  it('does not retain 202 for other operations without explicit opt-in', async () => {
    const send = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValue({ status: 202, data: {}, etag: null })
    const intent = new Intent()
    await intent.send('/other-write', options)
    await intent.send('/other-write', options)
    expect(send.mock.calls[1]?.[1]?.idempotencyKey).not.toBe(
      send.mock.calls[0]?.[1]?.idempotencyKey,
    )
  })

  it('clears a confirmed ordinary 409 rejection, allowing a corrected body', async () => {
    const send = vi
      .spyOn(api, 'apiFetch')
      .mockRejectedValueOnce(new api.ApiError(409, 'DEBT_EXCEEDED', 'Rejected'))
      .mockResolvedValue({ status: 201, data: {}, etag: null })
    const intent = new Intent()
    await expect(intent.send('/online-payments', options)).rejects.toThrow(
      'Rejected',
    )
    await intent.send('/online-payments', {
      ...options,
      body: { amount: '5000' },
    })
    expect(send.mock.calls[1]?.[1]?.idempotencyKey).not.toBe(
      send.mock.calls[0]?.[1]?.idempotencyKey,
    )
  })

  it('still blocks overlapping writes and unkeyed uncertain replay', async () => {
    let reject!: (failure: Error) => void
    const send = vi.spyOn(api, 'apiFetch').mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    const intent = new Intent()
    const pending = intent.send('/unkeyed', options, false)
    await expect(intent.send('/online-payments', options)).rejects.toThrow(
      'đang được xử lý',
    )
    reject(new Error('Unknown'))
    await expect(pending).rejects.toThrow('Unknown')
    await expect(intent.send('/unkeyed', options, false)).rejects.toThrow(
      'không có idempotency',
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1]).not.toHaveProperty('idempotencyKey')
  })
})
