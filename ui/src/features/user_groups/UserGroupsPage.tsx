import { Users, UsersRound } from 'lucide-react'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { master } from '../master_data/masterContracts'
import { num, partsBy, sumBy } from '../master_data/summaryData'
import { DonutTile, StatTile } from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'

function groupSummary(items: Row[]) {
  return (
    <>
      <StatTile label="Nhóm" value={items.length} icon={<UsersRound />} />
      <StatTile
        label="Người dùng"
        value={sumBy(items, (item) => num(item.userCount))}
        icon={<Users />}
      />
      <DonutTile
        title="Người dùng theo nhóm"
        centerLabel="tài khoản"
        head={['Nhóm', 'Số người dùng']}
        data={partsBy(
          items,
          (item) => num(item.id),
          (item) => String(item.name),
          (item) => num(item.userCount),
        )}
      />
    </>
  )
}

const config: MasterConfig = {
  path: '/user-groups',
  title: 'Nhóm người dùng',
  description: 'Các nhóm tài khoản dùng để phân quyền chức năng.',
  manage: 'groups.manage',
  deletePermission: 'permissions.manage',
  decode: master,
  sorts: [
    { field: 'code', label: 'Mã nhóm' },
    { field: 'name', label: 'Tên nhóm' },
    { field: 'id', label: 'Thứ tự tạo' },
  ],
  summary: groupSummary,
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
