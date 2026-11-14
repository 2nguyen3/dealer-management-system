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
import { t } from '@/lib/i18n/core'

function agencyTypeSummary(items: Row[]) {
  const limits = items.map((item) => ({
    name: String(item.name),
    maxDebt: num(item.maxDebt),
  }))
  return (
    <>
      <StatTile label={t('Loại đại lý')} value={items.length} icon={<Tags />} />
      <StatTile
        label={t('Tổng đại lý')}
        value={sumBy(items, (item) => num(item.agencyCount))}
        icon={<Store />}
      />
      <DonutTile
        title={t('Đại lý theo loại')}
        centerLabel={t('đại lý')}
        head={[t('Loại'), t('Số đại lý')]}
        data={partsBy(
          items,
          (item) => num(item.id),
          (item) => String(item.name),
          (item) => num(item.agencyCount),
        )}
      />
      <ChartTile
        title={t('Giới hạn nợ theo loại')}
        className="lg:col-span-4"
        table={
          <MiniTable
            caption={t('Giới hạn nợ theo loại')}
            head={[t('Loại'), t('Giới hạn nợ')]}
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
          series={[{ key: 'maxDebt', label: t('Giới hạn nợ') }]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/agency-types',
  title: t('Loại đại lý'),
  description: t('Phân loại đại lý và giới hạn nợ tối đa của từng loại.'),
  manage: 'agency_type.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  sorts: [
    { field: 'name', label: t('Tên loại') },
    { field: 'maxDebt', label: t('Giới hạn nợ'), firstDirection: 'desc' },
    { field: 'id', label: t('Thứ tự tạo') },
  ],
  summary: agencyTypeSummary,
  fields: [
    { key: 'code', label: t('Mã loại') },
    { key: 'name', label: t('Tên loại đại lý') },
    { key: 'maxDebt', label: t('Giới hạn nợ (VND)'), type: 'money' },
    { key: 'status', label: t('Trạng thái'), type: 'status' },
  ],
  columns: [
    ['code', t('Mã')],
    ['name', t('Tên loại')],
    ['maxDebt', t('Giới hạn nợ'), 'money'],
    ['agencyCount', t('Tổng đại lý'), 'count'],
    ['activeAgencyCount', t('Đại lý hoạt động'), 'count'],
    ['status', t('Trạng thái'), 'status'],
  ],
}
export function AgencyTypesPage() {
  return <MasterPage config={config} />
}
