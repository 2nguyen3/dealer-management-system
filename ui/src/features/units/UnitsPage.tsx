import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { master } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/units',
  title: 'Đơn vị tính',
  description: 'Đơn vị dùng cho mặt hàng và cho phép nhập số lẻ hay không.',
  manage: 'unit.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
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
