import { UserCheck, UserLock } from 'lucide-react'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { user } from '../master_data/masterContracts'
import { countWhere, num, partsBy, ratioOf } from '../master_data/summaryData'
import { DonutTile, MeterTile, StatTile } from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'

function userSummary(items: Row[]) {
  const locked = countWhere(items, (item) => item.status === 'LOCKED')
  const active = items.length - locked
  return (
    <>
      <StatTile label="Đang hoạt động" value={active} icon={<UserCheck />} />
      <StatTile label="Đang khóa" value={locked} icon={<UserLock />} />
      <DonutTile
        title="Tài khoản theo nhóm"
        centerLabel="tài khoản"
        head={['Nhóm', 'Số tài khoản']}
        data={partsBy(
          items,
          (item) => num(item.groupId),
          (item) => String(item.groupName),
        )}
      />
      <MeterTile
        title="Tài khoản hoạt động"
        className="lg:col-span-4"
        ratio={ratioOf(active, items.length)}
        caption={`${active}/${items.length} tài khoản`}
        color="var(--success)"
        legend={[
          { key: 'active', label: 'Hoạt động', value: active },
          { key: 'locked', label: 'Đang khóa', value: locked },
        ]}
      />
    </>
  )
}

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
  sorts: [
    { field: 'fullName', label: 'Họ tên' },
    { field: 'email', label: 'Email' },
    { field: 'createdAt', label: 'Ngày tạo', firstDirection: 'desc' },
    { field: 'id', label: 'Thứ tự tạo' },
  ],
  summary: userSummary,
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
