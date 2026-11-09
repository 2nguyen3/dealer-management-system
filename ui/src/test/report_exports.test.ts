import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadReport, reportMedia } from '../features/reports/export'
import * as api from '../lib/api'
import { reportQuery } from './reportFixtures'

describe('authenticated full-filter downloads', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:report')
        static revokeObjectURL = vi.fn()
      },
    )
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(api, 'apiDownload').mockResolvedValue({
      data: new Blob(['binary'], { type: reportMedia.pdf }),
      status: 200,
      etag: null,
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each(['pdf', 'xlsx'] as const)(
    'negotiates %s with one authenticated shared-client request and releases blob URLs',
    async (format) => {
      vi.mocked(api.apiDownload).mockResolvedValueOnce({
        data: new Blob(['binary'], { type: reportMedia[format] }),
        status: 200,
        etag: null,
      })
      const query = {
        ...reportQuery(),
        filters: { agencyId: '9223372036854775807', typeId: '1' },
      }
      const signal = new AbortController().signal
      await downloadReport(query, format, signal)
      expect(api.apiDownload).toHaveBeenCalledExactlyOnceWith(
        '/reports/sales?fromDate=2026-10-01&toDate=2026-11-01&agencyId=9223372036854775807&typeId=1',
        { signal, headers: { Accept: reportMedia[format] } },
      )
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
      expect(document.querySelector('a[download]')).toBeNull()
      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:report')
    },
  )

  it.each([
    new Blob(['error'], { type: 'application/json' }),
    new Blob([], { type: reportMedia.pdf }),
  ])('rejects unexpected or empty binary without saving', async (blob) => {
    vi.mocked(api.apiDownload).mockResolvedValueOnce({
      data: blob,
      status: 200,
      etag: null,
    })
    await expect(
      downloadReport(reportQuery(), 'pdf', new AbortController().signal),
    ).rejects.toThrow(/không đúng định dạng hoặc rỗng/)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('never saves a late download from an aborted account/filter', async () => {
    const controller = new AbortController()
    controller.abort()
    await downloadReport(reportQuery(), 'pdf', controller.signal)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('propagates 406/403/network failure without a fallback file', async () => {
    vi.mocked(api.apiDownload).mockRejectedValueOnce(new Error('HTTP 406'))
    await expect(
      downloadReport(reportQuery(), 'pdf', new AbortController().signal),
    ).rejects.toThrow('HTTP 406')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
