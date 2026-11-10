import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { master } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/agency-types',
  title: 'Loại đại lý',
  description: 'Phân loại đại lý và giới hạn nợ tối đa của từng loại.',
  manage: 'agency_type.manage',
  decode: master,
  statuses: ['ACTIVE', 'INACTIVE'],
  fields: [
    { key: 'code', label: 'Mã loại' },
    { key: 'name', label: 'Tên loại đại lý' },
    { key: 'maxDebt', label: 'Giới hạn nợ (VND)', type: 'money' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên loại'],
    ['maxDebt', 'Giới hạn nợ', 'money'],
    ['agencyCount', 'Tổng đại lý', 'count'],
    ['activeAgencyCount', 'Đại lý hoạt động', 'count'],
    ['status', 'Trạng thái', 'status'],
  ],
}
export function AgencyTypesPage() {
  return <MasterPage config={config} />
}
