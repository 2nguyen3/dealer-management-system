import { useEffect, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../authentication/useAuth'
import { month as validMonth, vietnamMonth } from '../reports/contracts'
import {
  dashboardAdmission,
  parseDashboard,
  sectionGrants,
  type Dashboard,
} from './contracts'

export function DashboardPage() {
  const { user, allowedFunctions } = useAuth()
  const grantKey = [...allowedFunctions].sort().join(',')
  const grants = new Set<string>(allowedFunctions)
  const admitted =
    !!user && dashboardAdmission.some((grant) => grants.has(grant))
  const [draftMonth, setDraftMonth] = useState(vietnamMonth)
  const [selectedMonth, setSelectedMonth] = useState(draftMonth)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<{ key: string; data: Dashboard } | null>(
    null,
  )
  const [failure, setFailure] = useState<{
    key: string
    message: string
  } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const key = JSON.stringify([user?.id, grantKey, selectedMonth, reload])
  const data = result?.key === key && admitted ? result.data : null
  const error = failure?.key === key ? failure.message : null
  const loading = admitted && !data && !error

  useEffect(() => {
    const controller = new AbortController()
    if (admitted) {
      apiFetch<unknown>(
        `/dashboard?month=${encodeURIComponent(selectedMonth)}`,
        { signal: controller.signal },
      )
        .then(({ data: value }) => {
          if (!controller.signal.aborted)
            setResult({ key, data: parseDashboard(value, selectedMonth) })
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted)
            setFailure({
              key,
              message:
                err instanceof Error
                  ? err.message
                  : 'Không thể tải bảng điều khiển.',
            })
        })
    }
    return () => controller.abort()
  }, [key, admitted, selectedMonth])

  function apply(event: FormEvent) {
    event.preventDefault()
    if (!validMonth(draftMonth)) {
      setFormError('Chọn tháng hợp lệ theo YYYY-MM.')
      return
    }
    setFormError(null)
    setSelectedMonth(draftMonth)
    setReload((n) => n + 1)
  }

  const can = (section: keyof typeof sectionGrants) =>
    sectionGrants[section].some((grant) => grants.has(grant))
  const agencies = can('agencies') ? data?.agencies : undefined
  const inventory = can('inventory') ? data?.inventory : undefined
  const sales = can('sales') ? data?.sales : undefined
  const receivables = can('receivables') ? data?.receivables : undefined

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">AGENTRA / OVERVIEW</p>
          <h1 className="page-title">Bảng điều khiển tổng quan</h1>
          <p className="page-desc">
            Chỉ số được máy chủ tổng hợp theo quyền truy cập và tháng nghiệp vụ
            Việt Nam.
          </p>
        </div>
      </div>
      {!admitted ? (
        <Alert type="info">
          Bạn không có quyền truy cập bảng điều khiển. Quyền chuẩn bị phiếu xuất
          hoặc ghi phiếu thu đơn lẻ không cấp quyền truy cập.
        </Alert>
      ) : (
        <>
          <form className="card" onSubmit={apply}>
            <div className="page-actions">
              <Input
                id="dashboard-month"
                label="Tháng nghiệp vụ (Việt Nam)"
                type="month"
                required
                value={draftMonth}
                onChange={(e) => setDraftMonth(e.target.value)}
              />
              <Button type="submit">Xem tháng</Button>
            </div>
            <p className="text-muted">
              Chỉ tải một bản tổng hợp khi mở màn hình hoặc áp dụng tháng. Không
              tải trước danh sách đại lý, mặt hàng hay chứng từ.
            </p>
          </form>
          {formError && <Alert type="error">{formError}</Alert>}
          {loading && <Spinner label="Đang tải bảng điều khiển..." />}
          {error && (
            <Alert type="error">
              {error}{' '}
              <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
                Thử lại
              </Button>
            </Alert>
          )}
          {data && (
            <>
              <p role="status">
                Tháng {data.month}. Thời điểm chụp dữ liệu:{' '}
                <time dateTime={data.asOf}>{data.asOf}</time>
              </p>
              <p className="text-muted">
                Nợ, dư có, tồn kho và hàng chờ là hiện tại tại thời điểm chụp.
                Doanh số, nhập hàng, thu tiền, hoàn tiền và tiền xác minh chưa
                ghi phiếu thu thuộc tháng đã chọn.
              </p>
              {Object.keys(sectionGrants)
                .filter(
                  (section) =>
                    can(section as keyof typeof sectionGrants) &&
                    !(section in data),
                )
                .map((section) => (
                  <Alert type="info" key={section}>
                    Máy chủ không cung cấp mục {section} trong bản tổng hợp này;
                    không thay thế bằng số 0.
                  </Alert>
                ))}
              <div className="stats-grid">
                {agencies && (
                  <section className="card">
                    <h2>Đại lý hiện tại</h2>
                    <dl>
                      <dt>Đang hoạt động</dt>
                      <dd>{agencies.active}</dd>
                      <dt>Tổng đại lý</dt>
                      <dd>{agencies.total}</dd>
                    </dl>
                  </section>
                )}
                {inventory && (
                  <section className="card">
                    <h2>Tồn kho hiện tại</h2>
                    <dl>
                      <dt>Số mặt hàng</dt>
                      <dd>{inventory.productCount}</dd>
                      <dt>Mặt hàng tồn thấp</dt>
                      <dd>{inventory.lowStockProductCount}</dd>
                      <dt>Giá trị nhập trong tháng (VND)</dt>
                      <dd className="font-mono">{inventory.receivedAmount}</dd>
                    </dl>
                  </section>
                )}
                {sales && (
                  <section className="card">
                    <h2>Doanh số trong tháng (VND)</h2>
                    <dl>
                      <dt>Doanh số gộp</dt>
                      <dd className="font-mono">{sales.gross}</dd>
                      <dt>Trả hàng</dt>
                      <dd className="font-mono">{sales.returns}</dd>
                      <dt>Doanh số thuần</dt>
                      <dd className="font-mono">{sales.net}</dd>
                    </dl>
                  </section>
                )}
                {receivables && (
                  <section className="card">
                    <h2>Công nợ và tiền (VND)</h2>
                    <dl>
                      <dt>Nợ hiện tại</dt>
                      <dd className="font-mono">{receivables.currentDebt}</dd>
                      <dt>Dư có hiện tại</dt>
                      <dd className="font-mono">{receivables.currentCredit}</dd>
                      <dt>Tiền thực thu trong tháng</dt>
                      <dd className="font-mono">{receivables.cashReceived}</dd>
                      <dt>Tiền thực hoàn trong tháng</dt>
                      <dd className="font-mono">{receivables.cashRefunded}</dd>
                    </dl>
                  </section>
                )}
                {can('pendingIssueCount') &&
                  data.pendingIssueCount !== undefined && (
                    <section className="card">
                      <h2>Phiếu xuất đang chờ hiện tại</h2>
                      <p className="font-mono">{data.pendingIssueCount}</p>
                    </section>
                  )}
                {can('verifiedUnreceiptedAmount') &&
                  data.verifiedUnreceiptedAmount !== undefined && (
                    <section className="card">
                      <h2>
                        Tiền đã xác minh chưa ghi phiếu thu trong tháng (VND)
                      </h2>
                      <p className="font-mono">
                        {data.verifiedUnreceiptedAmount}
                      </p>
                      <p>
                        Chưa cộng vào tiền thực thu, không phải phiếu thu đã ghi
                        sổ.
                      </p>
                    </section>
                  )}
              </div>
              {sales && (
                <section className="card">
                  <h2>Xu hướng doanh số tối đa 12 tháng (VND)</h2>
                  {!sales.monthlyTrend.length ? (
                    <p>Không có dữ liệu xu hướng.</p>
                  ) : (
                    <Table caption="Xu hướng doanh số">
                      <thead>
                        <tr>
                          <th scope="col">Tháng</th>
                          <th scope="col">Gộp</th>
                          <th scope="col">Trả</th>
                          <th scope="col">Thuần</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.monthlyTrend.map((point) => (
                          <tr key={point.month}>
                            <td>{point.month}</td>
                            <td className="font-mono">{point.gross}</td>
                            <td className="font-mono">{point.returns}</td>
                            <td className="font-mono">{point.net}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                  <h2>Top 10 mặt hàng theo máy chủ</h2>
                  {!sales.topProducts.length ? (
                    <p>Không có mặt hàng bán trong kỳ.</p>
                  ) : (
                    <Table caption="Top mặt hàng">
                      <thead>
                        <tr>
                          {[
                            'Mã',
                            'Tên',
                            'Đơn vị',
                            'Đã bán',
                            'Đã trả',
                            'Gộp (VND)',
                            'Trả (VND)',
                            'Thuần (VND)',
                          ].map((label) => (
                            <th scope="col" key={label}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sales.topProducts.map((row) => (
                          <tr key={row.productId}>
                            {[
                              'productCode',
                              'productName',
                              'unitName',
                              'soldQuantity',
                              'returnedQuantity',
                              'salesAmount',
                              'returnAmount',
                              'netSalesAmount',
                            ].map((name) => (
                              <td key={name} className="font-mono">
                                {row[name]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </section>
              )}
              {receivables && (
                <section className="card">
                  <h2>Top 10 đại lý theo dư nợ hiện tại</h2>
                  {!receivables.topAgencies.length ? (
                    <p>Không có đại lý trong danh sách dư nợ.</p>
                  ) : (
                    <Table caption="Top đại lý có dư nợ">
                      <thead>
                        <tr>
                          <th scope="col">Mã đại lý</th>
                          <th scope="col">Tên đại lý</th>
                          <th scope="col">Dư nợ hiện tại (VND)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivables.topAgencies.map((row) => (
                          <tr key={row.agencyId}>
                            <td>{row.agencyCode}</td>
                            <td>{row.agencyName}</td>
                            <td className="font-mono">{row.currentDebt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
