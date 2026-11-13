import { Ruler, SplitSquareHorizontal } from 'lucide-react'
import { RoundedBarChart } from '@/components/charts/MebiusCharts'
import { formatPlain } from '@/lib/chart'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { master } from '../master_data/masterContracts'
import { countWhere, num } from '../master_data/summaryData'
import { ChartTile, MiniTable, StatTile } from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'

function unitSummary(items: Row[]) {
  const bars = items.map((item) => ({
    name: String(item.name),
    products: num(item.productCount),
  }))
  return (
    <>
      <StatTile label="Đơn vị tính" value={items.length} icon={<Ruler />} />
      <StatTile
        label="Cho phép số lẻ"
        value={countWhere(items, (item) => item.allowsFraction === true)}
        icon={<SplitSquareHorizontal />}
      />
      <ChartTile
        title="Mặt hàng theo đơn vị"
        table={
          <MiniTable
            caption="Mặt hàng theo đơn vị"
            head={['Đơn vị', 'Số mặt hàng']}
            rows={bars.map((bar) => [bar.name, formatPlain(bar.products)])}
          />
        }
      >
        <RoundedBarChart
          data={bars}
          xKey="name"
          height={150}
          valueFormatter={formatPlain}
          series={[{ key: 'products', label: 'Số mặt hàng' }]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/units',
  title: 'Đơn vị tính',
  description: 'Đơn vị dùng cho mặt hàng và cho phép nhập số lẻ hay không.',
  manage: 'unit.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  sorts: [
    { field: 'code', label: 'Mã đơn vị' },
    { field: 'name', label: 'Tên đơn vị' },
    { field: 'id', label: 'Thứ tự tạo' },
  ],
  summary: unitSummary,
  fields: [
    { key: 'code', label: 'Mã đơn vị' },
    { key: 'name', label: 'Tên đơn vị' },
    { key: 'allowsFraction', label: 'Cho phép số lẻ', type: 'boolean' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên đơn vị'],
    ['allowsFraction', 'Cho phép số lẻ', 'boolean'],
    ['productCount', 'Số mặt hàng', 'count'],
    ['status', 'Trạng thái', 'status'],
  ],
}
export function UnitsPage() {
  return <MasterPage config={config} />
}
