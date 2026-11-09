import { apiDownload } from '../../lib/api'
import { reportPath, type ReportQuery } from './contracts'

export const reportMedia = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function downloadReport(
  query: ReportQuery,
  format: keyof typeof reportMedia,
  signal: AbortSignal,
): Promise<void> {
  const response = await apiDownload(reportPath(query, null, true), {
    signal,
    headers: { Accept: reportMedia[format] },
  })
  if (signal.aborted) return
  if (
    response.data.type.split(';')[0] !== reportMedia[format] ||
    response.data.size === 0
  )
    throw new Error('Tệp xuất không đúng định dạng hoặc rỗng.')
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `${query.kind}-${query.fromDate}-${query.toDate}.${format}`
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Allow the browser to consume the download before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
