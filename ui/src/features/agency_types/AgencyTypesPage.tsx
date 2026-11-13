import { Store, Tags } from 'lucide-react'
import { RoundedBarChart } from '@/components/charts/MebiusCharts'
import { formatCompactVND } from '@/lib/chart'
import { formatVND } from '@/lib/formatters'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { master } from '../master_data/masterContracts'
import { num, partsBy, sumBy } from '../master_data/summaryData'
import {
  ChartTile,
  DonutTile,
  MiniTable,
  StatTile,
} from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'

function agencyTypeSummary(items: Row[]) {
  const limits = items.map((item) => ({
    name: String(item.name),
    maxDebt: num(item.maxDebt),
  }))
  return (
    <>
      <StatTile label="Loại đại lý" value={items.length} icon={<Tags />} />
      <StatTile
        label="Tổng đại lý"
        value={sumBy(items, (item) => num(item.agencyCount))}
        icon={<Store />}
      />
      <DonutTile
        title="Đại lý theo loại"
        centerLabel="đại lý"
        head={['Loại', 'Số đại lý']}
        data={partsBy(
          items,
          (item) => num(item.id),
          (item) => String(item.name),
          (item) => num(item.agencyCount),
        )}
      />
      <ChartTile
        title="Giới hạn nợ theo loại"
        className="lg:col-span-4"
        table={
          <MiniTable
            caption="Giới hạn nợ theo loại"
            head={['Loại', 'Giới hạn nợ']}
            rows={items.map((item) => [
              String(item.name),
              formatVND(String(item.maxDebt)),
            ])}
          />
        }
      >
        <RoundedBarChart
          data={limits}
          xKey="name"
          height={170}
          valueFormatter={formatCompactVND}
          series={[{ key: 'maxDebt', label: 'Giới hạn nợ' }]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/agency-types',
  title: 'Loại đại lý',
  description: 'Phân loại đại lý và giới hạn nợ tối đa của từng loại.',
  manage: 'agency_type.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  sorts: [
    { field: 'name', label: 'Tên loại' },
    { field: 'maxDebt', label: 'Giới hạn nợ', firstDirection: 'desc' },
    { field: 'id', label: 'Thứ tự tạo' },
  ],
  summary: agencyTypeSummary,
  fields: [
    { key: 'code', label: 'Mã loại' },
    { key: 'name', label: 'Tên loại đại lý' },
    { key: 'maxDebt', label: 'Giới hạn nợ (VND)', type: 'money' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên loại'],
    ['maxDebt', 'Giới hạn nợ', 'money'],
    ['agencyCount', 'Tổng đại lý', 'count'],
    ['activeAgencyCount', 'Đại lý hoạt động', 'count'],
    ['status', 'Trạng thái', 'status'],
  ],
}
export function AgencyTypesPage() {
  return <MasterPage config={config} />
}
