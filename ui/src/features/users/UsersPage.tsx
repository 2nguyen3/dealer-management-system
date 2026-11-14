import { UserCheck, UserLock } from 'lucide-react'
import { MasterPage, type MasterConfig } from '../master_data/MasterPage'
import { user } from '../master_data/masterContracts'
import { countWhere, num, partsBy, ratioOf } from '../master_data/summaryData'
import { DonutTile, MeterTile, StatTile } from '../master_data/summaryParts'
import type { Row } from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

function userSummary(items: Row[]) {
  const locked = countWhere(items, (item) => item.status === 'LOCKED')
  const active = items.length - locked
  return (
    <>
      <StatTile
        label={t('Đang hoạt động')}
        value={active}
        icon={<UserCheck />}
      />
      <StatTile label={t('Đang khóa')} value={locked} icon={<UserLock />} />
      <DonutTile
        title={t('Tài khoản theo nhóm')}
        centerLabel={t('tài khoản')}
        head={[t('Nhóm'), t('Số tài khoản')]}
        data={partsBy(
          items,
          (item) => num(item.groupId),
          (item) => String(item.groupName),
        )}
      />
      <MeterTile
        title={t('Tài khoản hoạt động')}
        className="lg:col-span-4"
        ratio={ratioOf(active, items.length)}
        caption={t('{active}/{count} tài khoản', {
          active,
          count: items.length,
        })}
        color="var(--success)"
        legend={[
          { key: 'active', label: t('Hoạt động'), value: active },
          { key: 'locked', label: t('Đang khóa'), value: locked },
        ]}
      />
    </>
  )
}

const config: MasterConfig = {
  path: '/users',
  title: t('Quản lý tài khoản'),
  description: t('Tạo tài khoản, gán nhóm quyền, khóa và đặt lại mật khẩu.'),
  manage: 'users.manage',
  decode: user,
  noDelete: true,
  passwordReset: true,
  statuses: ['ACTIVE', 'LOCKED'],
  filters: [['groupId', t('Nhóm người dùng'), { picker: 'user-groups' }]],
  sorts: [
    { field: 'fullName', label: t('Họ tên') },
    { field: 'email', label: 'Email' },
    { field: 'createdAt', label: t('Ngày tạo'), firstDirection: 'desc' },
    { field: 'id', label: t('Thứ tự tạo') },
  ],
  summary: userSummary,
  fields: [
    { key: 'fullName', label: t('Họ tên') },
    { key: 'email', label: 'Email', type: 'email' },
    {
      key: 'groupId',
      label: t('Nhóm người dùng'),
      type: 'catalog',
      lookup: { picker: 'user-groups' },
    },
    {
      key: 'password',
      label: t('Mật khẩu'),
      type: 'password',
      createOnly: true,
    },
    {
      key: 'status',
      label: t('Trạng thái'),
      type: 'status',
      choices: ['ACTIVE', 'LOCKED'],
    },
  ],
  columns: [
    ['fullName', t('Họ tên')],
    ['email', 'Email'],
    ['groupName', t('Nhóm')],
    ['status', t('Trạng thái'), 'status'],
  ],
}
export function UsersPage() {
  return <MasterPage config={config} />
}
