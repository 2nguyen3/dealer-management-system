import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { product } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/products',
  title: 'Danh mục mặt hàng',
  manage: 'product.manage',
  decode: product,
  statuses: ['ACTIVE', 'INACTIVE'],
  filters: [
    ['unitId', 'ID đơn vị'],
    ['isLowStock', 'Tồn thấp (true/false)'],
  ],
  fields: [
    { key: 'name', label: 'Tên mặt hàng' },
    { key: 'unitId', label: 'ID đơn vị tính', type: 'catalog' },
    { key: 'lowStockThreshold', label: 'Ngưỡng tồn thấp', type: 'quantity' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã sinh tự động'],
    ['name', 'Tên'],
    ['unitName', 'Đơn vị'],
    ['currentStock', 'Tồn hiện tại'],
    ['lowStockThreshold', 'Ngưỡng tồn thấp'],
    ['currentPurchasePrice', 'Giá nhập'],
    ['currentSellingPrice', 'Giá bán máy chủ'],
    ['status', 'Trạng thái'],
  ],
}
export function ProductsPage() {
  return <MasterPage config={config} />
}
