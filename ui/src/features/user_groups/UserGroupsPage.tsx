import { Users, UsersRound } from 'lucide-react'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { master } from '../master_data/masterContracts'
import { num, partsBy, sumBy } from '../master_data/summaryData'
import { DonutTile, StatTile } from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

function groupSummary(items: Row[]) {
  return (
    <>
      <StatTile label={t('Nhóm')} value={items.length} icon={<UsersRound />} />
      <StatTile
        label={t('Người dùng')}
        value={sumBy(items, (item) => num(item.userCount))}
        icon={<Users />}
      />
      <DonutTile
        title={t('Người dùng theo nhóm')}
        centerLabel={t('tài khoản')}
        head={[t('Nhóm'), t('Số người dùng')]}
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
  title: t('Nhóm người dùng'),
  description: t('Các nhóm tài khoản dùng để phân quyền chức năng.'),
  manage: 'groups.manage',
  deletePermission: 'permissions.manage',
  decode: master,
  sorts: [
    { field: 'code', label: t('Mã nhóm') },
    { field: 'name', label: t('Tên nhóm') },
    { field: 'id', label: t('Thứ tự tạo') },
  ],
  summary: groupSummary,
  fields: [
    { key: 'code', label: t('Mã nhóm') },
    { key: 'name', label: t('Tên nhóm') },
  ],
  columns: [
    ['code', t('Mã nhóm')],
    ['name', t('Tên nhóm')],
    ['userCount', t('Số người dùng'), 'count'],
  ],
}
export function UserGroupsPage() {
  return <MasterPage config={config} />
}
