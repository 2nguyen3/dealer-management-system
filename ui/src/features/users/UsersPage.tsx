import { MasterPage, type MasterConfig } from '../districts/MasterPage'
import { user } from '../districts/masterContracts'

const config: MasterConfig = {
  path: '/users',
  title: 'Quản lý tài khoản',
  description: 'Tạo tài khoản, gán nhóm quyền, khóa và đặt lại mật khẩu.',
  manage: 'users.manage',
  decode: user,
  noDelete: true,
  passwordReset: true,
  statuses: ['ACTIVE', 'LOCKED'],
  filters: [['groupId', 'Nhóm người dùng', { picker: 'user-groups' }]],
  fields: [
    { key: 'fullName', label: 'Họ tên' },
    { key: 'email', label: 'Email', type: 'email' },
    {
      key: 'groupId',
      label: 'Nhóm người dùng',
      type: 'catalog',
      lookup: { picker: 'user-groups' },
    },
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
    ['status', 'Trạng thái', 'status'],
  ],
}
export function UsersPage() {
  return <MasterPage config={config} />
}
