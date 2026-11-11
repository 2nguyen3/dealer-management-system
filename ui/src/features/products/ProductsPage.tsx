import { Package, PackageX } from 'lucide-react'
import { RoundedBarChart } from '@/components/charts/MebiusCharts'
import { formatQuantity } from '@/lib/formatters'
import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { product } from '../districts/masterContracts'
import { countWhere, num, ratioOf } from '../districts/summaryData'
import {
  ChartTile,
  MeterTile,
  MiniTable,
  StatTile,
} from '../districts/summaryParts'
import type { Row } from '../payment_receipts/contracts'

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
      <StatTile label="Mặt hàng" value={items.length} icon={<Package />} />
      <StatTile
        label="Dưới ngưỡng tồn"
        value={low}
        icon={<PackageX />}
        hint={low ? 'Cần nhập thêm' : 'Đủ hàng'}
      />
      <MeterTile
        title="Mặt hàng đủ tồn"
        ratio={ratioOf(items.length - low, items.length)}
        caption={`${items.length - low}/${items.length} mặt hàng`}
        color="var(--success)"
        legend={[
          { key: 'ok', label: 'Đủ hàng', value: items.length - low },
          { key: 'low', label: 'Dưới ngưỡng', value: low },
        ]}
      />
      <ChartTile
        title="Tồn kho so với ngưỡng"
        className="lg:col-span-4"
        table={
          <MiniTable
            caption="Tồn kho so với ngưỡng"
            head={['Mã hàng', 'Tồn / ngưỡng']}
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
            { key: 'stock', label: 'Tồn hiện tại' },
            { key: 'threshold', label: 'Ngưỡng tồn thấp' },
          ]}
        />
      </ChartTile>
    </>
  )
}

const config: MasterConfig = {
  path: '/products',
  title: 'Danh mục mặt hàng',
  description: 'Quản lý mặt hàng, đơn vị tính, giá và mức cảnh báo tồn kho.',
  manage: 'product.manage',
  decode: product,
  statuses: ['ACTIVE', 'INACTIVE'],
  filters: [
    ['unitId', 'Đơn vị tính', { options: '/units' }],
    ['isLowStock', 'Tồn kho', { boolean: ['Dưới ngưỡng', 'Đủ hàng'] }],
  ],
  sorts: [
    { field: 'name', label: 'Tên mặt hàng' },
    {
      field: 'currentStock',
      label: 'Tồn hiện tại',
      firstDirection: 'desc',
    },
    {
      field: 'currentSellingPrice',
      label: 'Giá bán',
      firstDirection: 'desc',
    },
    { field: 'id', label: 'Thứ tự tạo' },
  ],
  summary: productSummary,
  fields: [
    { key: 'name', label: 'Tên mặt hàng' },
    {
      key: 'unitId',
      label: 'Đơn vị tính',
      type: 'catalog',
      lookup: { options: '/units' },
    },
    { key: 'lowStockThreshold', label: 'Ngưỡng tồn thấp', type: 'quantity' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã hàng'],
    ['name', 'Tên mặt hàng'],
    ['unitName', 'Đơn vị'],
    ['currentStock', 'Tồn hiện tại', 'quantity'],
    ['lowStockThreshold', 'Ngưỡng tồn thấp', 'quantity'],
    ['currentPurchasePrice', 'Giá nhập', 'money'],
    ['currentSellingPrice', 'Giá bán', 'money'],
    ['status', 'Trạng thái', 'status'],
  ],
}
export function ProductsPage() {
  return <MasterPage config={config} />
}
