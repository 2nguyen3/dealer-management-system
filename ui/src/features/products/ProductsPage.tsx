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

/** A product gets a selling price only after its first posted receipt. */
function isPriced(item: Row): boolean {
  return item.sellingPrice !== null && item.sellingPrice !== undefined
}

function isOutOfStock(item: Row): boolean {
  return num(item.stock) <= 0
}

const STOCK_BARS = 12

function productSummary(items: Row[]) {
  const priced = countWhere(items, isPriced)
  const empty = countWhere(items, isOutOfStock)
  const bars = items.slice(0, STOCK_BARS).map((item) => ({
    name: String(item.code),
    stock: num(item.stock),
  }))
  return (
    <>
      <StatTile label={t('Mặt hàng')} value={items.length} icon={<Package />} />
      <StatTile
        label={t('Hết hàng')}
        value={empty}
        icon={<PackageX />}
        hint={empty ? t('Cần nhập thêm') : t('Đều còn hàng')}
      />
      <MeterTile
        title={t('Mặt hàng đã có giá bán')}
        ratio={ratioOf(priced, items.length)}
        caption={t('{value}/{count} mặt hàng', {
          value: priced,
          count: items.length,
        })}
        color="var(--success)"
        legend={[
          { key: 'priced', label: t('Đã có giá bán'), value: priced },
          {
            key: 'unpriced',
            label: t('Chưa nhập lần nào'),
            value: items.length - priced,
          },
        ]}
      />
      <ChartTile
        title={t('Tồn hiện tại')}
        className="lg:col-span-4"
        table={
          <MiniTable
            caption={t('Tồn hiện tại')}
            head={[t('Mã hàng'), t('Tồn hiện tại')]}
            rows={items
              .slice(0, STOCK_BARS)
              .map((item) => [
                String(item.code),
                formatQuantity(String(item.stock)),
              ])}
          />
        }
      >
        <RoundedBarChart
          data={bars}
          xKey="name"
          height={190}
          series={[{ key: 'stock', label: t('Tồn hiện tại') }]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/products',
  title: t('Danh mục mặt hàng'),
  description: t(
    'Quản lý mặt hàng và đơn vị tính; xem tồn hiện tại, giá nhập gần nhất và giá bán (giá nhập gần nhất × tỷ lệ giá bán).',
  ),
  manage: 'product.manage',
  decode: product,
  statuses: ['ACTIVE', 'INACTIVE'],
  filters: [['unitId', t('Đơn vị tính'), { options: '/units' }]],
  sorts: [
    { field: 'name', label: t('Tên mặt hàng') },
    { field: 'stock', label: t('Tồn hiện tại'), firstDirection: 'desc' },
    { field: 'sellingPrice', label: t('Giá bán'), firstDirection: 'desc' },
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
    { key: 'status', label: t('Trạng thái'), type: 'status' },
  ],
  columns: [
    ['code', t('Mã hàng')],
    ['name', t('Tên mặt hàng')],
    ['unitName', t('Đơn vị')],
    ['stock', t('Tồn hiện tại'), 'quantity'],
    ['lastPurchasePrice', t('Giá nhập gần nhất'), 'money'],
    ['sellingPrice', t('Giá bán'), 'money'],
    ['status', t('Trạng thái'), 'status'],
  ],
}

export function ProductsPage() {
  return <MasterPage config={config} />
}
