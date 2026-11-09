import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { master } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/agency-types',
  title: 'Loại đại lý',
  manage: 'agency_type.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  fields: [
    { key: 'code', label: 'Mã loại' },
    { key: 'name', label: 'Tên loại đại lý' },
    { key: 'maxDebt', label: 'Giới hạn nợ (VND nguyên)', type: 'money' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên'],
    ['maxDebt', 'Giới hạn nợ'],
    ['agencyCount', 'Tổng đại lý'],
    ['activeAgencyCount', 'Đại lý hoạt động'],
    ['status', 'Trạng thái'],
  ],
}
export function AgencyTypesPage() {
  return <MasterPage config={config} />
}
