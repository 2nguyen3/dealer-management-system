import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { master } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/user-groups',
  title: 'Nhóm người dùng',
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
    ['userCount', 'Số người dùng'],
  ],
}
export function UserGroupsPage() {
  return <MasterPage config={config} />
}
