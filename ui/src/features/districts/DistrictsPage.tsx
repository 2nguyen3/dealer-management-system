import { MapPin, Store } from 'lucide-react'
import { RoundedBarChart } from '@/components/charts/MebiusCharts'
import { formatPlain } from '@/lib/chart'
import type { Row } from '../payment_receipts/contracts'
import { MasterPage, type MasterConfig } from './MasterPage'
import { master } from './masterContracts'
import { num, ratioOf, sumBy } from './summaryData'
import { ChartTile, MeterTile, MiniTable, StatTile } from './summaryParts'

function districtSummary(items: Row[]) {
  const active = sumBy(items, (item) => num(item.activeAgencyCount))
  const capacity = sumBy(items, (item) => num(item.maxAgencies))
  const bars = items.map((item) => ({
    name: String(item.code ?? item.name),
    active: num(item.activeAgencyCount),
    remaining: num(item.remainingSlots),
  }))
  return (
    <>
      <StatTile label="Quận" value={items.length} icon={<MapPin />} />
      <StatTile label="Đại lý hoạt động" value={active} icon={<Store />} />
      <MeterTile
        title="Công suất đã dùng"
        ratio={ratioOf(active, capacity)}
        caption={`${formatPlain(active)}/${formatPlain(capacity)} chỗ`}
        legend={[
          { key: 'used', label: 'Đang dùng', value: formatPlain(active) },
          {
            key: 'free',
            label: 'Còn nhận',
            value: formatPlain(Math.max(capacity - active, 0)),
          },
        ]}
      />
      <ChartTile
        title="Đại lý theo quận"
        className="lg:col-span-4"
        table={
          <MiniTable
            caption="Đại lý theo quận"
            head={['Quận', 'Hoạt động / còn nhận']}
            rows={bars.map((bar) => [
              bar.name,
              `${formatPlain(bar.active)} / ${formatPlain(bar.remaining)}`,
            ])}
          />
        }
      >
        <RoundedBarChart
          data={bars}
          xKey="name"
          stacked
          height={180}
          valueFormatter={formatPlain}
          series={[
            { key: 'active', label: 'Đang hoạt động' },
            { key: 'remaining', label: 'Còn nhận' },
          ]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/districts',
  title: 'Danh sách quận',
  description: 'Quận và số đại lý còn có thể tiếp nhận trong từng quận.',
  manage: 'district.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  sorts: [
    { field: 'code', label: 'Mã quận' },
    { field: 'name', label: 'Tên quận' },
    { field: 'id', label: 'Thứ tự tạo' },
  ],
  summary: districtSummary,
  fields: [
    { key: 'code', label: 'Mã quận' },
    { key: 'name', label: 'Tên quận' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên quận'],
    ['activeAgencyCount', 'Đại lý hoạt động', 'count'],
    ['maxAgencies', 'Tối đa', 'count'],
    ['remainingSlots', 'Còn nhận', 'count'],
    ['status', 'Trạng thái', 'status'],
  ],
}
export function DistrictsPage() {
  return <MasterPage config={config} />
}
