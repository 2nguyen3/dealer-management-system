import { Ruler, SplitSquareHorizontal } from 'lucide-react'
import { RoundedBarChart } from '@/components/charts/MebiusCharts'
import { formatPlain } from '@/lib/chart'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { master } from '../master_data/masterContracts'
import { countWhere, num } from '../master_data/summaryData'
import { ChartTile, MiniTable, StatTile } from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

function unitSummary(items: Row[]) {
  const bars = items.map((item) => ({
    name: String(item.name),
    products: num(item.productCount),
  }))
  return (
    <>
      <StatTile
        label={t('Đơn vị tính')}
        value={items.length}
        icon={<Ruler />}
      />
      <StatTile
        label={t('Cho phép số lẻ')}
        value={countWhere(items, (item) => item.allowsFraction === true)}
        icon={<SplitSquareHorizontal />}
      />
      <ChartTile
        title={t('Mặt hàng theo đơn vị')}
        table={
          <MiniTable
            caption={t('Mặt hàng theo đơn vị')}
            head={[t('Đơn vị'), t('Số mặt hàng')]}
            rows={bars.map((bar) => [bar.name, formatPlain(bar.products)])}
          />
        }
      >
        <RoundedBarChart
          data={bars}
          xKey="name"
          height={150}
          valueFormatter={formatPlain}
          series={[{ key: 'products', label: t('Số mặt hàng') }]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/units',
  title: t('Đơn vị tính'),
  description: t('Đơn vị dùng cho mặt hàng và cho phép nhập số lẻ hay không.'),
  manage: 'unit.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  sorts: [
    { field: 'code', label: t('Mã đơn vị') },
    { field: 'name', label: t('Tên đơn vị') },
    { field: 'id', label: t('Thứ tự tạo') },
  ],
  summary: unitSummary,
  fields: [
    { key: 'code', label: t('Mã đơn vị') },
    { key: 'name', label: t('Tên đơn vị') },
    { key: 'allowsFraction', label: t('Cho phép số lẻ'), type: 'boolean' },
    { key: 'status', label: t('Trạng thái'), type: 'status' },
  ],
  columns: [
    ['code', t('Mã')],
    ['name', t('Tên đơn vị')],
    ['allowsFraction', t('Cho phép số lẻ'), 'boolean'],
    ['productCount', t('Số mặt hàng'), 'count'],
    ['status', t('Trạng thái'), 'status'],
  ],
}
export function UnitsPage() {
  return <MasterPage config={config} />
}
