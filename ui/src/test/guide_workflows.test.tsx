import { describe, expect, it } from 'vitest'
import type { DocumentLine } from '../features/document_history/documentContracts'
import {
  collectLink,
  correctionSteps,
  dirtyRules,
  documentChangeNotice,
  goodsPostEffects,
  goodsWorkflow,
  issuePostEffects,
  issuePostedNotice,
  masterNotice,
  positiveMoney,
  receiptNext,
  receiptNotice,
  reconcileNotice,
  reportSteps,
  ruleSteps,
  stockIssueWorkflow,
  subtractMoney,
} from '../features/guide/workflows'

const all = { prepare: true, post: true, collect: true }
const none = { prepare: false, post: false, collect: false }

const line: DocumentLine = {
  id: '1',
  lineNo: 1,
  productId: '7',
  productCode: 'MH-7',
  productName: 'Nước mắm Phú Quốc',
  unitId: 2,
  unitName: 'Hộp',
  quantity: '1.001',
  unitPrice: '50000',
  lineAmount: '50050',
}

type Status = 'DRAFT' | 'POSTED' | 'CANCELLED'
function issue(status: Status, lines: DocumentLine[] = [line]) {
  return { code: 'PX-9', status, lines, agencyId: '101' }
}
const states = (steps: { state: string }[]) => steps.map((step) => step.state)

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

  it('builds the payment-receipt deep link with an encoded agency id', () => {
    expect(collectLink('101')).toBe('/payment-receipts?agency=101&new=1')
    expect(collectLink('a&b')).toBe('/payment-receipts?agency=a%26b&new=1')
    expect(collectLink(null)).toBe('/payment-receipts')
    expect(collectLink('')).toBe('/payment-receipts')
  })
})

describe('stockIssueWorkflow', () => {
  it('draft: no upfront step, posting is the next action', () => {
    const flow = stockIssueWorkflow(issue('DRAFT'), all)
    expect(flow.steps.map((step) => step.key)).toEqual([
      'draft',
      'post',
      'collect',
    ])
    expect(states(flow.steps)).toEqual(['current', 'todo', 'todo'])
    expect(flow.postLock).toBeNull()
    expect(flow.next?.title).toBe('Ghi sổ để xuất hàng')
    expect(flow.steps[1]?.hint).toMatch(/giá nhập gần nhất × tỷ lệ giá bán/)
  })

  it('draft without lines cannot be posted; without rights it names the role', () => {
    const flow = stockIssueWorkflow(issue('DRAFT', []), none)
    expect(flow.postLock).toMatch(/chưa có dòng hàng/)
    expect(flow.next).toEqual({
      title: 'Phiếu đang là nháp',
      waitingFor: 'Kho',
    })
  })

  it('posted: the next step is a payment receipt for the same agency', () => {
    const flow = stockIssueWorkflow(issue('POSTED'), all)
    expect(states(flow.steps)).toEqual(['done', 'done', 'current'])
    expect(flow.postLock).toMatch(/nháp/)
    expect(flow.next).toMatchObject({
      title: 'Lập phiếu thu khi đại lý trả tiền',
      to: '/payment-receipts?agency=101&new=1',
      actionLabel: 'Lập phiếu thu',
    })
    expect(flow.next?.description).toMatch(/PX-9/)
    const waiting = stockIssueWorkflow(issue('POSTED'), {
      ...all,
      collect: false,
    })
    expect(waiting.next).toEqual({
      title: 'Chờ thu tiền đại lý',
      waitingFor: 'Kế toán',
    })
  })

  it('cancelled issues skip the remaining steps and have no next action', () => {
    const flow = stockIssueWorkflow(issue('CANCELLED'), all)
    expect(states(flow.steps)).toEqual(['done', 'skipped', 'skipped'])
    expect(flow.steps[0]?.hint).toBe('Phiếu đã hủy.')
    expect(flow.next).toBeNull()
  })

  it('lists posting consequences: stock out, price fixed, debt limit', () => {
    const effects = issuePostEffects(issue('DRAFT'))
    expect(effects[0]).toBe('Tồn kho Nước mắm Phú Quốc: −1,001 Hộp')
    expect(effects).toHaveLength(3)
    expect(effects[1]).toMatch(/nợ của đại lý tăng/)
    expect(issuePostEffects(issue('DRAFT', []))).toHaveLength(2)
  })

  it('the posted toast points to a payment receipt', () => {
    expect(issuePostedNotice({ code: 'PX-9', agencyId: '101' })).toEqual({
      done: 'Đã ghi sổ PX-9.',
      next: 'Tồn kho đã giảm, nợ đại lý đã tăng. Bước tiếp: lập phiếu thu khi đại lý trả tiền.',
      to: '/payment-receipts?agency=101&new=1',
    })
    expect(issuePostedNotice({ code: '', agencyId: null }).done).toBe(
      'Đã ghi sổ chứng từ.',
    )
  })
})

describe('stock receipt workflow', () => {
  it('draft → post with price consequences', () => {
    const flow = goodsWorkflow({ status: 'DRAFT' }, true)
    expect(states(flow.steps)).toEqual(['current', 'todo'])
    expect(flow.next?.title).toBe('Ghi sổ khi đã kiểm tra đủ dòng hàng')
    const effects = goodsPostEffects({ lines: [line] })
    expect(effects[0]).toBe('Tồn kho Nước mắm Phú Quốc: +1,001 Hộp')
    expect(effects).toHaveLength(3)
    expect(goodsPostEffects({ lines: [] })).toHaveLength(2)
  })

  it('posted/cancelled have no next step; without rights the role is named', () => {
    expect(goodsWorkflow({ status: 'POSTED' }, true).next).toBeNull()
    const cancelled = goodsWorkflow({ status: 'CANCELLED' }, true)
    expect(states(cancelled.steps)).toEqual(['done', 'skipped'])
    expect(cancelled.next).toBeNull()
    expect(goodsWorkflow({ status: 'DRAFT' }, false).next?.waitingFor).toBe(
      'Kho',
    )
  })
})

describe('payment receipt guidance', () => {
  it('describes each receipt action without FIFO allocation', () => {
    expect(receiptNotice('create', 'PT-1').done).toBe('Đã tạo nháp PT-1.')
    const posted = receiptNotice('post', 'PT-1')
    expect(posted.to).toBe('/agencies')
    expect(posted.next).not.toMatch(/FIFO|hóa đơn/)
    expect(receiptNotice('delete', '').done).toBe('Đã xóa nháp chứng từ.')
  })

  it('suggests posting only for drafts; the amount must not exceed the debt', () => {
    expect(receiptNext({ status: 'POSTED' }, { post: true })).toBeNull()
    const next = receiptNext({ status: 'DRAFT' }, { post: true })
    expect(next?.title).toBe('Ghi sổ để giảm nợ')
    expect(next?.description).toMatch(/không vượt nợ hiện tại/)
    expect(receiptNext({ status: 'DRAFT' }, { post: false })?.waitingFor).toBe(
      'Kế toán',
    )
  })

  it('reconcile toasts follow the gateway status', () => {
    expect(reconcileNotice('SUCCESS').to).toBe('/payment-receipts')
    expect(reconcileNotice('FAILED').done).toMatch(/không thành công/)
    expect(reconcileNotice('EXPIRED').done).toBe('Giao dịch đã quá hạn.')
    expect(reconcileNotice('PENDING').next).toMatch(/không tạo giao dịch mới/)
    expect(reconcileNotice(undefined).to).toBeUndefined()
  })
})

describe('cancel and correction', () => {
  it('rail differs for cancel and correct', () => {
    expect(correctionSteps(true)[1]?.label).toBe('Hủy (nhập lý do)')
    expect(correctionSteps(false)[1]?.label).toBe(
      'Sửa (nhập lý do và nội dung mới)',
    )
    expect(states(correctionSteps(false))).toEqual(['done', 'current', 'todo'])
    expect(correctionSteps(true)[0]?.hint).toMatch(/tháng hiện tại/)
  })

  it('toasts name the old and new codes', () => {
    expect(documentChangeNotice('cancel', 'PX-9').done).toBe('Đã hủy PX-9.')
    expect(documentChangeNotice('correct', 'PX-9', 'PX-12').done).toBe(
      'Đã sửa PX-9 thành PX-12.',
    )
    expect(documentChangeNotice('correct', '', undefined).done).toBe(
      'Đã sửa chứng từ thành phiếu mới.',
    )
  })
})

describe('other rails', () => {
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
