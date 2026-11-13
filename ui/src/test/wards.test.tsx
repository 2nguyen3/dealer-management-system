import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession } from '../features/authentication/session'
import { WardPicker } from '../features/wards/WardPicker'
import {
  getWard,
  isWardKind,
  listAllWards,
  listWards,
  MAX_WARD_PAGES,
  ward,
  WARD_KINDS,
  wardKindLabel,
  wardListPath,
} from '../features/wards/wardsApi'
import { describeItem, type PickerItem } from '../components/ui/pickerItems'
import * as apiModule from '../lib/api'
import { ApiError, apiFetch } from '../lib/api'
import { navigationGroups, routePermissions } from '../app/navigation'
import { navigationIcons } from '../app/navigationIcons'
import { PERMISSION_AREAS } from '../features/profile/profileModel'

const wards = [
  { id: 1, code: '26734', name: 'Phường Tân Định', kind: 'WARD' },
  { id: 2, code: '26740', name: 'Phường Sài Gòn', kind: 'WARD' },
  { id: 160, code: '27673', name: 'Xã Cần Giờ', kind: 'COMMUNE' },
  { id: 168, code: '26732', name: 'Đặc khu Côn Đảo', kind: 'SPECIAL_ZONE' },
]

function pageOf(items: unknown[], nextCursor: string | null = null) {
  return {
    items,
    pagination: { limit: 25, nextCursor, hasMore: nextCursor !== null },
  }
}

function ok(data: unknown, etag: string | null = null) {
  return Promise.resolve({ data, status: 200, etag })
}

afterEach(() => vi.restoreAllMocks())

describe('ward kinds', () => {
  it('labels the three 2025 administrative kinds in Vietnamese', () => {
    expect(WARD_KINDS).toEqual(['WARD', 'COMMUNE', 'SPECIAL_ZONE'])
    expect(WARD_KINDS.map(wardKindLabel)).toEqual(['Phường', 'Xã', 'Đặc khu'])
    expect(isWardKind('COMMUNE')).toBe(true)
  })

  it('rejects unknown kinds and keeps unknown labels readable', () => {
    expect(isWardKind('DISTRICT')).toBe(false)
    expect(isWardKind('toString')).toBe(false)
    expect(isWardKind(1)).toBe(false)
    expect(wardKindLabel('DISTRICT')).toBe('DISTRICT')
    expect(wardKindLabel('')).toBe('—')
    expect(wardKindLabel(null)).toBe('—')
  })
})

describe('ward decoder', () => {
  it('accepts a read-only ward row without status', () => {
    expect(
      ward({
        ...wards[0],
        createdAt: '2026-11-13T00:00:00Z',
        updatedAt: '2026-11-13T00:00:00Z',
      }),
    ).toEqual({
      ...wards[0],
      createdAt: '2026-11-13T00:00:00Z',
      updatedAt: '2026-11-13T00:00:00Z',
    })
    expect(ward(wards[3]).kind).toBe('SPECIAL_ZONE')
  })

  it('rejects malformed rows', () => {
    expect(() => ward(null)).toThrow('Invalid server response')
    expect(() => ward([])).toThrow('Invalid server response')
    expect(() => ward({ ...wards[0], kind: 'DISTRICT' })).toThrow(
      'Invalid ward kind',
    )
    expect(() => ward({ ...wards[0], kind: undefined })).toThrow(
      'Invalid ward kind',
    )
    expect(() => ward({ ...wards[0], name: 5 })).toThrow('Invalid server text')
    expect(() => ward({ ...wards[0], code: null })).toThrow(
      'Invalid server text',
    )
    expect(() => ward({ ...wards[0], createdAt: 1 })).toThrow(
      'Invalid server text',
    )
  })

  it('enforces the integer catalogue id bounds', () => {
    expect(ward({ ...wards[0], id: 2147483647 }).id).toBe(2147483647)
    expect(ward({ ...wards[0], id: '7' }).id).toBe(7)
    for (const id of [0, -1, 1.5, 2147483648, 'x', null])
      expect(() => ward({ ...wards[0], id })).toThrow('Invalid catalogue ID')
  })
})

describe('ward list path', () => {
  it('builds the contract query with only the provided parameters', () => {
    expect(wardListPath()).toBe('/wards?')
    expect(
      wardListPath({
        q: '  Sài Gòn ',
        code: ' 26740 ',
        kind: 'WARD',
        sort: '-name',
        limit: 50,
        cursor: 'abc',
      }),
    ).toBe(
      `/wards?q=${encodeURIComponent('Sài Gòn').replace(/%20/g, '+')}&code=26740&kind=WARD&sort=-name&limit=50&cursor=abc`,
    )
    expect(wardListPath({ q: '   ' })).toBe('/wards?')
  })

  it('accepts the limit bounds 1 and 100 and rejects anything outside', () => {
    expect(wardListPath({ limit: 1 })).toBe('/wards?limit=1')
    expect(wardListPath({ limit: 100 })).toBe('/wards?limit=100')
    for (const limit of [0, 101, 2.5, Number.NaN])
      expect(() => wardListPath({ limit })).toThrow(
        'Số dòng mỗi trang phải từ 1 đến 100.',
      )
  })

  it('rejects an out-of-contract kind', () => {
    expect(() =>
      wardListPath({ kind: 'DISTRICT' as unknown as 'WARD' }),
    ).toThrow('Loại đơn vị hành chính không hợp lệ.')
  })
})

describe('wards adapter', () => {
  it('lists one validated page and forwards the abort signal', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(pageOf(wards.slice(0, 2), 'next-1')))
    const controller = new AbortController()
    const result = await listWards(
      { kind: 'WARD', limit: 2 },
      controller.signal,
    )
    expect(spy).toHaveBeenCalledWith('/wards?kind=WARD&limit=2', {
      signal: controller.signal,
    })
    expect(result.items.map((item) => item.name)).toEqual([
      'Phường Tân Định',
      'Phường Sài Gòn',
    ])
    expect(result.pagination).toEqual({
      limit: 25,
      nextCursor: 'next-1',
      hasMore: true,
    })
  })

  it('returns an empty last page', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(() => ok(pageOf([])))
    const result = await listWards({ q: 'không tồn tại' })
    expect(result.items).toEqual([])
    expect(result.pagination.hasMore).toBe(false)
  })

  it('rejects broken pagination, bad rows and server failures', async () => {
    const spy = vi.spyOn(apiModule, 'apiFetch')
    spy.mockImplementation(() =>
      ok({
        items: wards,
        pagination: { limit: 25, nextCursor: null, hasMore: true },
      }),
    )
    await expect(listWards()).rejects.toThrow('Invalid server pagination')
    spy.mockImplementation(() =>
      ok(pageOf([{ ...wards[0], kind: 'DISTRICT' }])),
    )
    await expect(listWards()).rejects.toThrow('Invalid ward kind')
    spy.mockImplementation(() =>
      Promise.reject(new ApiError(403, 'FORBIDDEN', 'Không có quyền')),
    )
    await expect(listWards()).rejects.toMatchObject({ status: 403 })
    await expect(listWards({ limit: 0 })).rejects.toThrow(
      'Số dòng mỗi trang phải từ 1 đến 100.',
    )
  })

  it('gets one ward with its ETag', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(wards[2], 'W/"w160"'))
    const result = await getWard('160')
    expect(spy).toHaveBeenCalledWith('/wards/160', { signal: undefined })
    expect(result).toEqual({ ward: wards[2], etag: 'W/"w160"' })
  })

  it('refuses invalid ids before calling the server and bad payloads after', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok({ id: 1, code: 'X', name: 'Y' }))
    await expect(getWard(0)).rejects.toThrow('Invalid catalogue ID')
    await expect(getWard('1/../2')).rejects.toThrow('Invalid catalogue ID')
    expect(spy).not.toHaveBeenCalled()
    await expect(getWard(1)).rejects.toThrow('Invalid ward kind')
    spy.mockImplementation(() =>
      Promise.reject(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy')),
    )
    await expect(getWard(2147483647)).rejects.toMatchObject({ status: 404 })
  })
})

describe('ward capacity fields and full catalogue', () => {
  it('keeps non-negative integer capacity counts and rejects invalid ones', () => {
    expect(
      ward({
        ...wards[1],
        activeAgencyCount: 3,
        maxAgencies: 4,
        remainingSlots: 0,
      }),
    ).toMatchObject({ activeAgencyCount: 3, maxAgencies: 4, remainingSlots: 0 })
    expect(() => ward({ ...wards[1], activeAgencyCount: -1 })).toThrow(
      'Invalid ward activeAgencyCount',
    )
    expect(() => ward({ ...wards[1], remainingSlots: 1.5 })).toThrow()
    expect(() => ward({ ...wards[1], maxAgencies: '4' })).toThrow()
  })

  it('follows cursors with the maximum page size until the last page', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementationOnce(() => ok(pageOf(wards.slice(0, 2), 'c2')))
      .mockImplementationOnce(() => ok(pageOf(wards.slice(2))))
    const all = await listAllWards()
    expect(all.map((w) => w.id)).toEqual([1, 2, 160, 168])
    expect(spy.mock.calls.map((call) => call[0])).toEqual([
      '/wards?limit=100',
      '/wards?limit=100&cursor=c2',
    ])
  })

  it('refuses to page past the bound instead of looping forever', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(pageOf([wards[0]], 'again')))
    await expect(listAllWards()).rejects.toThrow('vượt quá số trang')
    expect(spy).toHaveBeenCalledTimes(MAX_WARD_PAGES)
  })
})

describe('ward picker items', () => {
  it('shows the ward name with its kind and code', () => {
    expect(describeItem('wards', wards[1])).toEqual({
      id: '2',
      label: 'Phường Sài Gòn',
      detail: 'Phường · Mã 26740',
    })
    expect(describeItem('wards', wards[2])?.detail).toBe('Xã · Mã 27673')
    expect(describeItem('wards', wards[3])?.detail).toBe('Đặc khu · Mã 26732')
  })

  it('degrades gracefully for partial rows and rejects rows without ids', () => {
    expect(describeItem('wards', { id: 9, name: 'Phường X' })).toEqual({
      id: '9',
      label: 'Phường X',
      detail: undefined,
    })
    expect(describeItem('wards', { id: 9, code: '1' })).toEqual({
      id: '9',
      label: '1',
      detail: 'Mã 1',
    })
    expect(describeItem('wards', { id: 9 })?.label).toBe('#9')
    expect(describeItem('wards', { name: 'Phường X' })).toBeNull()
  })
})

function PickerHarness({
  initial = '',
  onPick,
}: {
  initial?: string
  onPick?: (id: string, item: PickerItem | null) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <WardPicker
      id="ward-test"
      value={value}
      required
      onChange={(id, item) => {
        setValue(id)
        onPick?.(id, item)
      }}
    />
  )
}

describe('WardPicker', () => {
  it('searches the wards catalogue on the server and keeps the exact id', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(pageOf(wards.slice(0, 2))))
    const onPick = vi.fn()
    render(<PickerHarness onPick={onPick} />)
    const input = screen.getByRole('combobox', { name: /Phường\/xã/ })
    expect(input.getAttribute('placeholder')).toBe('Gõ tên phường/xã để tìm…')
    expect(input.getAttribute('aria-required')).toBe('true')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Sài' } })
    await screen.findByText('Phường Sài Gòn')
    expect(screen.getByText('Phường · Mã 26740')).toBeTruthy()
    const url = String(spy.mock.calls.at(-1)?.[0])
    expect(url.startsWith('/wards?')).toBe(true)
    expect(url).toContain('limit=20')
    expect(url).toContain(`q=${encodeURIComponent('Sài')}`)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({ label: 'Phường Sài Gòn' }),
    )
    expect((input as HTMLInputElement).value).toBe('Phường Sài Gòn')
  })

  it('resolves the name of an initial ward id from GET /wards/{id}', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(wards[3]))
    render(<PickerHarness initial="168" />)
    await waitFor(() =>
      expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
        'Đặc khu Côn Đảo',
      ),
    )
    expect(spy).toHaveBeenCalledWith('/wards/168', expect.anything())
  })

  it('shows empty and failure states without inventing choices', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(pageOf([])))
    render(<PickerHarness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    await screen.findByText('Không có kết quả phù hợp.')
    spy.mockImplementation(() => Promise.reject(new Error('down')))
    fireEvent.change(input, { target: { value: 'Quận 1' } })
    await screen.findByText('Không tải được danh sách.')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})

describe('ward capacity error', () => {
  beforeEach(() => clearSession())

  it('maps WARD_CAPACITY_EXCEEDED to a Vietnamese message and keeps the code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'WARD_CAPACITY_EXCEEDED',
          message: 'Ward has no remaining agency slots',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const failure = await apiFetch('/agencies', {
      method: 'POST',
      body: {},
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({
      status: 409,
      code: 'WARD_CAPACITY_EXCEEDED',
    })
    expect((failure as ApiError).message).toContain(
      'Phường/xã đã đủ số đại lý tối đa',
    )
  })

  it('keeps the server message for other conflict codes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'DEBT_LIMIT', message: 'Vượt hạn mức nợ' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await expect(apiFetch('/agencies')).rejects.toMatchObject({
      code: 'DEBT_LIMIT',
      message: 'Vượt hạn mức nợ',
    })
  })
})

describe('removed district management', () => {
  it('has no route, navigation entry, icon or permission label left', () => {
    expect(Object.keys(routePermissions)).not.toContain('/districts')
    expect(Object.keys(navigationIcons)).not.toContain('/districts')
    const items = navigationGroups.flatMap((group) => group.items)
    expect(items.map((item) => item.path)).not.toContain('/districts')
    expect(items.some((item) => /quận/i.test(item.label))).toBe(false)
    const codes = PERMISSION_AREAS.flatMap((area) =>
      area.codes.map((entry) => entry.code as string),
    )
    expect(codes).not.toContain('district.manage')
  })
})
