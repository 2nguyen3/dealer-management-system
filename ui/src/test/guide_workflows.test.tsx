import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  correctionSteps,
  dirtyRules,
  financialNext,
  financialNotice,
  goodsPostEffects,
  goodsWorkflow,
  issuePostEffects,
  masterNotice,
  positiveMoney,
  reconcileNotice,
  reportSteps,
  ruleSteps,
  stockIssueWorkflow,
  subtractMoney,
  upfrontLink,
  type UpfrontState,
} from '../features/guide/workflows'
import { useUpfrontState } from '../features/guide/useUpfrontState'
import * as api from '../lib/api'
import { detail, revision } from './goodsFixtures'

const all = { prepare: true, post: true, verify: true }
const none = { prepare: false, post: false, verify: false }

function issue(
  status: 'DRAFT' | 'PENDING' | 'POSTED' | 'CANCELLED',
  immediatePayment: string,
  upfrontConfirmationId: string | null = null,
  lines = true,
) {
  const state =
    status === 'DRAFT' ? 'DRAFT' : status === 'PENDING' ? 'READY' : 'POSTED'
  return detail('STOCK_ISSUE', {
    id: '778',
    code: 'PX-9',
    status,
    upfrontConfirmationId,
    currentRevision: revision({
      state,
      totalAmount: '5000000',
      immediatePayment,
      ...(lines ? {} : { lines: [] }),
    }),
  })
}
const states = (steps: { state: string }[]) => steps.map((step) => step.state)

afterEach(() => vi.restoreAllMocks())

describe('money helpers', () => {
  it('accepts only exact positive integer money strings', () => {
    expect(positiveMoney('1')).toBe(true)
    expect(positiveMoney('900719925474099301')).toBe(true)
    expect(positiveMoney('0')).toBe(false)
    expect(positiveMoney('-5')).toBe(false)
    expect(positiveMoney('01')).toBe(false)
    expect(positiveMoney('1.5')).toBe(false)
    expect(positiveMoney(null)).toBe(false)
    expect(positiveMoney(undefined)).toBe(false)
  })

  it('subtracts exactly beyond Number precision and rejects non-integers', () => {
    expect(subtractMoney('900719925474099301', '1')).toBe('900719925474099300')
    expect(subtractMoney('5', '7')).toBe('-2')
    expect(subtractMoney('1.5', '1')).toBeNull()
    expect(subtractMoney('', '1')).toBeNull()
  })

  it('builds the upfront deep link with an encoded issue id', () => {
    expect(upfrontLink('778')).toBe('/upfront-payments?issue=778&new=1')
    expect(upfrontLink('a&b')).toBe('/upfront-payments?issue=a%26b&new=1')
  })
})

describe('stockIssueWorkflow', () => {
  it('draft without upfront skips the upfront step and asks to submit', () => {
    const flow = stockIssueWorkflow(issue('DRAFT', '0'), 'NONE', all)
    expect(states(flow.steps)).toEqual(['current', 'todo', 'skipped', 'todo'])
    expect(flow.upfront).toBe('')
    expect(flow.next?.title).toBe('Nộp phiếu để chốt giá')
    expect(flow.next?.description).toBe('Sau khi nộp, Kho ghi sổ để xuất hàng.')
    expect(flow.postLock).toMatch(/phải được nộp/)
    expect(flow.submitLock).toBeNull()
    expect(flow.replaceLock).toBeNull()
  })

  it('draft without lines cannot be submitted; without rights it names the role', () => {
    const flow = stockIssueWorkflow(
      issue('DRAFT', '0', null, false),
      'NONE',
      none,
    )
    expect(flow.submitLock).toMatch(/chưa có dòng hàng/)
    expect(flow.next).toEqual({
      title: 'Phiếu đang là nháp',
      waitingFor: 'Kinh doanh',
    })
  })

  it('ready issue with unverified upfront blocks posting and deep-links accounting', () => {
    const flow = stockIssueWorkflow(issue('PENDING', '1250000'), 'NONE', all)
    expect(states(flow.steps)).toEqual(['done', 'done', 'current', 'blocked'])
    expect(flow.upfront).toBe('1250000')
    expect(flow.postLock).toBe(
      'Chưa có xác nhận trả ngay 1.250.000 ₫. Kế toán cần xác nhận tiền thực nhận trước khi ghi sổ.',
    )
    expect(flow.next).toMatchObject({
      title: 'Xác nhận khoản trả ngay 1.250.000 ₫',
      to: '/upfront-payments?issue=778&new=1',
      tone: 'warning',
    })
    // Warehouse without verify rights waits for accounting instead.
    const waiting = stockIssueWorkflow(issue('PENDING', '1250000'), 'NONE', {
      ...all,
      verify: false,
    })
    expect(waiting.next?.waitingFor).toBe('Kế toán')
    expect(waiting.next?.to).toBeUndefined()
  })

  it('verified upfront unlocks posting and refuses replacing the pending content', () => {
    const flow = stockIssueWorkflow(
      issue('PENDING', '1250000', '31'),
      'VERIFIED',
      all,
    )
    expect(states(flow.steps)).toEqual(['done', 'done', 'done', 'current'])
    expect(flow.postLock).toBeNull()
    expect(flow.replaceLock).toMatch(/Ghi nhận tiền riêng/)
    expect(flow.next?.title).toBe('Sẵn sàng ghi sổ')
    const noPost = stockIssueWorkflow(
      issue('PENDING', '1250000', '31'),
      'VERIFIED',
      { ...all, post: false },
    )
    expect(noPost.next?.waitingFor).toBe('Kho')
  })

  it('while the confirmation loads, predicts nothing that blocks the server', () => {
    const flow = stockIssueWorkflow(
      issue('PENDING', '1250000', '31'),
      'UNKNOWN',
      all,
    )
    expect(flow.postLock).toBeNull()
    expect(flow.replaceLock).toBeNull()
  })

  it('separately received money blocks posting until a new revision', () => {
    const flow = stockIssueWorkflow(
      issue('PENDING', '1250000', '31'),
      'RECEIVED_SEPARATELY',
      all,
    )
    expect(states(flow.steps)).toEqual(['done', 'done', 'blocked', 'blocked'])
    expect(flow.postLock).toMatch(/ghi nhận riêng thành phiếu thu/)
    expect(flow.replaceLock).toBeNull()
    expect(flow.next).toMatchObject({
      title: 'Cần lập lại phiên bản phiếu',
      tone: 'warning',
    })
    expect(flow.next?.description).toMatch(/chỉ nhập trả ngay nếu/)
  })

  it.each<[string, UpfrontState, string[]]>([
    ['POSTED', 'CONSUMED', ['done', 'done', 'done', 'done']],
    ['CANCELLED', 'NONE', ['done', 'skipped', 'skipped', 'skipped']],
  ])('%s issues have no next action', (status, upfront, expected) => {
    const flow = stockIssueWorkflow(
      issue(status as 'POSTED' | 'CANCELLED', '1250000', '31'),
      upfront,
      all,
    )
    expect(states(flow.steps)).toEqual(expected)
    expect(flow.next).toBeNull()
  })

  it('lists posting consequences with exact remaining debt', () => {
    const doc = issue('PENDING', '1250000')
    const effects = issuePostEffects(doc)
    expect(effects[0]).toBe('Tồn kho Historical product: −1,001 Hộp')
    expect(effects).toContain(
      'Công nợ đại lý tăng 5.000.000 ₫ (giá đã chốt khi nộp).',
    )
    expect(effects.at(-1)).toBe(
      'Tự lập phiếu thu 1.250.000 ₫ từ khoản trả ngay đã xác nhận; công nợ còn tăng thêm 3.750.000 ₫.',
    )
    expect(issuePostEffects(issue('PENDING', '0'))).toHaveLength(2)
  })
})

describe('goods workflows', () => {
  it('receipt draft → post with price consequences', () => {
    const flow = goodsWorkflow('STOCK_RECEIPT', detail(), true)
    expect(states(flow.steps)).toEqual(['current', 'todo'])
    expect(flow.next?.title).toBe('Ghi sổ khi đã kiểm tra đủ dòng hàng')
    const effects = goodsPostEffects('STOCK_RECEIPT', detail())
    expect(effects[0]).toBe('Tồn kho Historical product: +1,001 Hộp')
    expect(effects).toHaveLength(3)
  })

  it('count-generated adjustments are posted with the count, not separately', () => {
    const flow = goodsWorkflow(
      'STOCK_ADJUSTMENT',
      detail('STOCK_ADJUSTMENT', { stockCountId: '5' }),
      true,
    )
    expect(states(flow.steps)).toEqual(['done', 'blocked'])
    expect(flow.next).toBeNull()
  })

  it('posted/cancelled have no next step; without rights the role is named', () => {
    expect(
      goodsWorkflow(
        'SALES_RETURN',
        detail('SALES_RETURN', { status: 'POSTED' }),
        true,
      ).next,
    ).toBeNull()
    const cancelled = goodsWorkflow(
      'STOCK_RECEIPT',
      detail('STOCK_RECEIPT', { status: 'CANCELLED' }),
      true,
    )
    expect(states(cancelled.steps)).toEqual(['done', 'skipped'])
    expect(
      goodsWorkflow('STOCK_RECEIPT', detail(), false).next?.waitingFor,
    ).toBe('Kho')
  })

  it('adjustment effects keep the sign of the quantity', () => {
    const doc = detail('STOCK_ADJUSTMENT', {
      currentRevision: revision({
        lines: [{ ...revision().lines[0]!, quantity: '-2' }],
      }),
    })
    expect(goodsPostEffects('STOCK_ADJUSTMENT', doc)).toEqual([
      'Tồn kho Historical product: -2 Hộp',
    ])
    expect(
      goodsPostEffects('SALES_RETURN', detail('SALES_RETURN')).at(-1),
    ).toMatch(/dư có/)
  })
})

describe('financial guidance', () => {
  it('describes each receipt/credit/refund action', () => {
    expect(financialNotice('receipt', 'create', 'PT-1').done).toBe(
      'Đã tạo nháp PT-1.',
    )
    expect(financialNotice('receipt', 'post', 'PT-1').to).toBe('/receivables')
    expect(financialNotice('credit', 'post', 'BT-1').to).toBe('/agency-credit')
    expect(financialNotice('refund', 'create', '').done).toBe(
      'Đã tạo nháp chứng từ.',
    )
    expect(financialNotice('refund', 'submit', 'HT-1').next).toMatch(
      /Xác nhận đã chi tiền/,
    )
    expect(financialNotice('refund', 'confirm-paid', 'HT-1').to).toBe(
      '/agency-credit',
    )
    expect(financialNotice('refund', 'attempts', 'HT-1').next).toMatch(
      /Đối soát/,
    )
    expect(financialNotice('refund', 'reconcile', 'HT-1').done).toBe(
      'Đã đối soát với cổng thanh toán.',
    )
    expect(financialNotice('refund', 'cancel', 'HT-1').next).toBeUndefined()
    expect(financialNotice('refund', 'unknown-action', 'HT-1').done).toBe(
      'Đã thực hiện thao tác.',
    )
  })

  it('suggests the next step only for drafts the user can act on', () => {
    const can = { post: true, manual: true, reserved: false, unknown: false }
    expect(financialNext('receipt', { status: 'POSTED' }, can)).toBeNull()
    expect(
      financialNext('receipt', { status: 'DRAFT' }, { ...can, manual: false }),
    ).toBeNull()
    expect(financialNext('receipt', { status: 'DRAFT' }, can)?.title).toBe(
      'Ghi sổ để cập nhật công nợ',
    )
    expect(
      financialNext('credit', { status: 'DRAFT' }, { ...can, post: false })
        ?.waitingFor,
    ).toBe('Kế toán')
    expect(financialNext('refund', { status: 'DRAFT' }, can)?.title).toBe(
      'Giữ chỗ quỹ hoàn tiền',
    )
    expect(
      financialNext('refund', { status: 'DRAFT' }, { ...can, reserved: true })
        ?.title,
    ).toBe('Chi tiền cho đại lý')
    expect(
      financialNext('refund', { status: 'DRAFT' }, { ...can, unknown: true }),
    ).toMatchObject({ title: 'Chờ kết quả hoàn trực tuyến', tone: 'warning' })
  })

  it('reconcile toasts follow the gateway status', () => {
    expect(reconcileNotice('SUCCESS').to).toBe('/payment-receipts')
    expect(reconcileNotice('FAILED').done).toMatch(/không thành công/)
    expect(reconcileNotice('EXPIRED').done).toBe('Giao dịch đã quá hạn.')
    expect(reconcileNotice('PENDING').next).toMatch(/không tạo giao dịch mới/)
    expect(reconcileNotice(undefined).to).toBeUndefined()
  })
})

describe('other rails', () => {
  it('correction rail differs for cancel and correct', () => {
    expect(correctionSteps(true)[1]?.label).toBe('Hủy (nhập lý do)')
    expect(correctionSteps(false)[1]?.label).toBe('Sửa (phiên bản mới)')
    expect(states(correctionSteps(false))).toEqual(['done', 'current', 'todo'])
  })

  it('business-rule rail follows dirty/saved state', () => {
    const saved = { capacity: '4', rate: '1.02' }
    expect(dirtyRules('4', '1.02', saved)).toBe(false)
    expect(dirtyRules('5', '1.02', saved)).toBe(true)
    expect(states(ruleSteps(true, true))).toEqual(['current', 'todo', 'todo'])
    expect(states(ruleSteps(false, true))).toEqual(['done', 'done', 'done'])
    expect(states(ruleSteps(false, false))).toEqual(['current', 'todo', 'todo'])
  })

  it('master toasts point to the next setup page', () => {
    expect(masterNotice('/users', true).to).toBe('/permissions')
    expect(masterNotice('/user-groups', true).to).toBe('/permissions')
    expect(masterNotice('/products', true).to).toBe('/stock-receipts')
    expect(masterNotice('/products', false)).toEqual({
      done: 'Đã lưu thay đổi.',
    })
    expect(masterNotice('/units', true)).toEqual({ done: 'Đã thêm mới.' })
  })

  it('report rail moves from filters to export', () => {
    expect(states(reportSteps(false, false, false))).toEqual([
      'current',
      'todo',
      'todo',
    ])
    expect(states(reportSteps(true, false, false))).toEqual([
      'done',
      'done',
      'current',
    ])
    expect(states(reportSteps(true, true, false))).toEqual([
      'current',
      'todo',
      'todo',
    ])
    expect(states(reportSteps(true, false, true))[2]).toBe('done')
  })
})

describe('useUpfrontState', () => {
  it('is NONE without a confirmation and reads the record state', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { state: 'VERIFIED' },
      status: 200,
      etag: null,
    })
    const none = renderHook(() => useUpfrontState(null))
    expect(none.result.current).toBe('NONE')
    expect(fetch).not.toHaveBeenCalled()
    const { result } = renderHook(() => useUpfrontState('31'))
    expect(result.current).toBe('UNKNOWN')
    await waitFor(() => expect(result.current).toBe('VERIFIED'))
    expect(fetch).toHaveBeenCalledWith(
      '/upfront-confirmations/31',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('falls back to UNKNOWN for failures and unexpected states', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValueOnce({
      data: { state: 'HACKED' },
      status: 200,
      etag: null,
    })
    const odd = renderHook(() => useUpfrontState('1'))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(1))
    expect(odd.result.current).toBe('UNKNOWN')
    vi.mocked(api.apiFetch).mockRejectedValueOnce(new Error('offline'))
    const failed = renderHook(() => useUpfrontState('2'))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(2))
    expect(failed.result.current).toBe('UNKNOWN')
  })

  it('reloads when the version changes and aborts on unmount', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { state: 'CONSUMED' },
      status: 200,
      etag: null,
    })
    const { result, rerender, unmount } = renderHook(
      ({ version }) => useUpfrontState('31', version),
      { initialProps: { version: 0 } },
    )
    await waitFor(() => expect(result.current).toBe('CONSUMED'))
    rerender({ version: 1 })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const signal = fetch.mock.calls[1]![1]!.signal!
    unmount()
    expect(signal.aborted).toBe(true)
  })
})
