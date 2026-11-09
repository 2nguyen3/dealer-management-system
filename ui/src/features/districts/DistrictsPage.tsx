import { MasterPage, type MasterConfig } from './MasterPage'
import { master } from './masterContracts'

const config: MasterConfig = {
  path: '/districts',
  title: 'Danh sách quận',
  manage: 'district.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  fields: [
    { key: 'code', label: 'Mã quận' },
    { key: 'name', label: 'Tên quận' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên quận'],
    ['activeAgencyCount', 'Đại lý hoạt động'],
    ['maxAgencies', 'Sức chứa'],
    ['remainingSlots', 'Chỗ còn lại'],
    ['status', 'Trạng thái'],
  ],
}
export function DistrictsPage() {
  return <MasterPage config={config} />
}
