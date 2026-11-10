import { MasterPage, type MasterConfig } from './MasterPage'
import { master } from './masterContracts'

const config: MasterConfig = {
  path: '/districts',
  title: 'Danh sách quận',
  description: 'Quận và số đại lý còn có thể tiếp nhận trong từng quận.',
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
    ['activeAgencyCount', 'Đại lý hoạt động', 'count'],
    ['maxAgencies', 'Tối đa', 'count'],
    ['remainingSlots', 'Còn nhận', 'count'],
    ['status', 'Trạng thái', 'status'],
  ],
}
export function DistrictsPage() {
  return <MasterPage config={config} />
}
