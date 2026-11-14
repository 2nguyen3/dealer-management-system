import { Package, PackageX } from 'lucide-react'
import { RoundedBarChart } from '@/components/charts/MebiusCharts'
import { formatQuantity } from '@/lib/formatters'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { product } from '../master_data/masterContracts'
import { countWhere, num, ratioOf } from '../master_data/summaryData'
import {
  ChartTile,
  MeterTile,
  MiniTable,
  StatTile,
} from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

/** Low stock as the server defines it: current stock below the threshold. */
function isLow(item: Row): boolean {
  if (typeof item.isLowStock === 'boolean') return item.isLowStock
  return num(item.currentStock) < num(item.lowStockThreshold)
}

const STOCK_BARS = 12

function productSummary(items: Row[]) {
  const low = countWhere(items, isLow)
  const bars = items.slice(0, STOCK_BARS).map((item) => ({
    name: String(item.code),
    stock: num(item.currentStock),
    threshold: num(item.lowStockThreshold),
  }))
  return (
    <>
      <StatTile label={t('Mặt hàng')} value={items.length} icon={<Package />} />
      <StatTile
        label={t('Dưới ngưỡng tồn')}
        value={low}
        icon={<PackageX />}
        hint={low ? t('Cần nhập thêm') : t('Đủ hàng')}
      />
      <MeterTile
        title={t('Mặt hàng đủ tồn')}
        ratio={ratioOf(items.length - low, items.length)}
        caption={t('{value}/{count} mặt hàng', {
          value: items.length - low,
          count: items.length,
        })}
        color="var(--success)"
        legend={[
          { key: 'ok', label: t('Đủ hàng'), value: items.length - low },
          { key: 'low', label: t('Dưới ngưỡng'), value: low },
        ]}
      />
      <ChartTile
        title={t('Tồn kho so với ngưỡng')}
        className="lg:col-span-4"
        table={
          <MiniTable
            caption={t('Tồn kho so với ngưỡng')}
            head={[t('Mã hàng'), t('Tồn / ngưỡng')]}
            rows={items
              .slice(0, STOCK_BARS)
              .map((item) => [
                String(item.code),
                `${formatQuantity(String(item.currentStock))} / ${formatQuantity(String(item.lowStockThreshold))}`,
              ])}
          />
        }
      >
        <RoundedBarChart
          data={bars}
          xKey="name"
          height={190}
          series={[
            { key: 'stock', label: t('Tồn hiện tại') },
            { key: 'threshold', label: t('Ngưỡng tồn thấp') },
          ]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/products',
  title: t('Danh mục mặt hàng'),
  description: t('Quản lý mặt hàng, đơn vị tính, giá và mức cảnh báo tồn kho.'),
  manage: 'product.manage',
  decode: product,
  statuses: ['ACTIVE', 'INACTIVE'],
  filters: [
    ['unitId', t('Đơn vị tính'), { options: '/units' }],
    ['isLowStock', t('Tồn kho'), { boolean: [t('Dưới ngưỡng'), t('Đủ hàng')] }],
  ],
  sorts: [
    { field: 'name', label: t('Tên mặt hàng') },
    {
      field: 'currentStock',
      label: t('Tồn hiện tại'),
      firstDirection: 'desc',
    },
    {
      field: 'currentSellingPrice',
      label: t('Giá bán'),
      firstDirection: 'desc',
    },
    { field: 'id', label: t('Thứ tự tạo') },
  ],
  summary: productSummary,
  fields: [
    { key: 'name', label: t('Tên mặt hàng') },
    {
      key: 'unitId',
      label: t('Đơn vị tính'),
      type: 'catalog',
      lookup: { options: '/units' },
    },
    { key: 'lowStockThreshold', label: t('Ngưỡng tồn thấp'), type: 'quantity' },
    { key: 'status', label: t('Trạng thái'), type: 'status' },
  ],
  columns: [
    ['code', t('Mã hàng')],
    ['name', t('Tên mặt hàng')],
    ['unitName', t('Đơn vị')],
    ['currentStock', t('Tồn hiện tại'), 'quantity'],
    ['lowStockThreshold', t('Ngưỡng tồn thấp'), 'quantity'],
    ['currentPurchasePrice', t('Giá nhập'), 'money'],
    ['currentSellingPrice', t('Giá bán'), 'money'],
    ['status', t('Trạng thái'), 'status'],
  ],
}
export function ProductsPage() {
  return <MasterPage config={config} />
}
