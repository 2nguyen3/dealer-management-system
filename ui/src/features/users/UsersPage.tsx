import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { user } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/users',
  title: 'Quản lý tài khoản',
  manage: 'users.manage',
  decode: user,
  noDelete: true,
  passwordReset: true,
  statuses: ['ACTIVE', 'LOCKED'],
  filters: [['groupId', 'ID nhóm']],
  fields: [
    { key: 'fullName', label: 'Họ tên' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'groupId', label: 'ID nhóm', type: 'catalog' },
    { key: 'password', label: 'Mật khẩu', type: 'password', createOnly: true },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'status',
      choices: ['ACTIVE', 'LOCKED'],
    },
  ],
  columns: [
    ['fullName', 'Họ tên'],
    ['email', 'Email'],
    ['groupName', 'Nhóm'],
    ['status', 'Trạng thái'],
  ],
}
export function UsersPage() {
  return <MasterPage config={config} />
}
