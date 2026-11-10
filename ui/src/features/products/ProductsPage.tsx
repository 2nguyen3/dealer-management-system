import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { product } from '../districts/masterContracts'

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
