import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { master } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/units',
  title: 'Đơn vị tính',
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
    ['name', 'Tên'],
    ['allowsFraction', 'Cho phép số lẻ'],
    ['productCount', 'Số mặt hàng'],
    ['status', 'Trạng thái'],
  ],
}
export function UnitsPage() {
  return <MasterPage config={config} />
}
