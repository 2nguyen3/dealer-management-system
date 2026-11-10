import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { master } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/user-groups',
  title: 'Nhóm người dùng',
  description: 'Các nhóm tài khoản dùng để phân quyền chức năng.',
  manage: 'groups.manage',
  deletePermission: 'permissions.manage',
  decode: master,
  fields: [
    { key: 'code', label: 'Mã nhóm' },
    { key: 'name', label: 'Tên nhóm' },
  ],
  columns: [
    ['code', 'Mã nhóm'],
    ['name', 'Tên nhóm'],
    ['userCount', 'Số người dùng', 'count'],
  ],
}
export function UserGroupsPage() {
  return <MasterPage config={config} />
}
