import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import type { FunctionCode, UserGroup } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

interface FunctionItem {
  id: number
  code: FunctionCode
  name: string
}

interface GroupPermissionItem {
  id: string
  groupId: number
  functionId: number
  functionCode: FunctionCode
  functionName: string
  isAllowed: boolean
}

export function PermissionsPage() {
  const { hasPermission, refreshProfile } = useAuth()
  const canManage = hasPermission('permissions.manage')

  const [groups, setGroups] = useState<UserGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [functions, setFunctions] = useState<FunctionItem[]>([])
  const [permissions, setPermissions] = useState<
    Record<number, GroupPermissionItem>
  >({})
  const [permissionEtags, setPermissionEtags] = useState<
    Record<number, string | null>
  >({})

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [updatingFunctionId, setUpdatingFunctionId] = useState<number | null>(
    null,
  )

  useEffect(() => {
    Promise.all([
      cachedApiFetch<UserGroup[] | { items: UserGroup[] }>('/user-groups'),
      cachedApiFetch<{ items: FunctionItem[] }>('/functions?limit=100'),
    ])
      .then(([gRes, fRes]) => {
        const groupItems = Array.isArray(gRes.data)
          ? gRes.data
          : gRes.data.items || []
        setGroups(groupItems)
        setFunctions(fRes.data.items || [])
        if (groupItems[0]) {
          setSelectedGroupId(String(groupItems[0].id))
        }
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(
          e.message || 'Không thể tải danh sách chức năng và nhóm quyền.',
        )
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedGroupId) return
    let isMounted = true

    apiFetch<{ items: GroupPermissionItem[] }>(
      `/user-groups/${selectedGroupId}/permissions?limit=100`,
    )
      .then((res) => {
        if (!isMounted) return
        const map: Record<number, GroupPermissionItem> = {}
        for (const item of res.data.items || []) {
          map[item.functionId] = item
        }
        setPermissions(map)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải phân quyền của nhóm.')
      })

    return () => {
      isMounted = false
    }
  }, [selectedGroupId])

  const handleTogglePermission = async (
    fn: FunctionItem,
    currentAllowed: boolean,
  ) => {
    if (!canManage || !selectedGroupId) return
    setUpdatingFunctionId(fn.id)
    setError(null)
    setSuccessNotice(null)

    try {
      // First get fresh permission with ETag
      let etag = permissionEtags[fn.id]
      try {
        const getRes: ApiResponse<GroupPermissionItem> = await apiFetch(
          `/user-groups/${selectedGroupId}/permissions/${fn.id}`,
        )
        etag = getRes.etag
      } catch {
        // May not exist yet
      }

      const res: ApiResponse<GroupPermissionItem> = await apiFetch(
        `/user-groups/${selectedGroupId}/permissions/${fn.id}`,
        {
          method: 'PUT',
          ifMatch: etag || undefined,
          body: { isAllowed: !currentAllowed },
        },
      )

      invalidateCache('/permissions')
      setPermissions((prev) => ({
        ...prev,
        [fn.id]: res.data,
      }))
      setPermissionEtags((prev) => ({
        ...prev,
        [fn.id]: res.etag,
      }))

      setSuccessNotice(
        `Đã ${!currentAllowed ? 'cấp quyền' : 'thu hồi quyền'} "${fn.name}" thành công.`,
      )
      // Refresh current user's profile in case their own permissions changed
      void refreshProfile()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể thay đổi phân quyền.')
    } finally {
      setUpdatingFunctionId(null)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Phân quyền chức năng</h1>
          <p className="page-desc">
            Thiết lập danh mục các chức năng được phép thực hiện cho từng nhóm
            tài khoản
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successNotice && <Alert type="success">{successNotice}</Alert>}

      <div className="card filter-bar-card">
        <div className="filter-group-inline">
          <label htmlFor="select-group" className="form-label mb-0">
            Chọn nhóm người dùng:
          </label>
          <div style={{ minWidth: '280px' }}>
            <Select
              id="select-group"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              options={groups.map((g) => ({
                value: String(g.id),
                label: `${g.name} (${g.code})`,
              }))}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải dữ liệu phân quyền..." />
        </div>
      ) : (
        <div className="card">
          <Table caption="Bảng phân quyền chức năng">
            <thead>
              <tr>
                <th scope="col" style={{ width: '80px' }}>
                  ID
                </th>
                <th scope="col">Mã chức năng</th>
                <th scope="col">Tên chức năng</th>
                <th scope="col" style={{ textAlign: 'center', width: '180px' }}>
                  Quyền hạn
                </th>
                {canManage && (
                  <th
                    scope="col"
                    style={{ textAlign: 'center', width: '140px' }}
                  >
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {functions.map((fn) => {
                const perm = permissions[fn.id]
                const isAllowed = perm ? perm.isAllowed : false
                const isUpdating = updatingFunctionId === fn.id

                return (
                  <tr key={fn.id}>
                    <td className="font-mono">#{fn.id}</td>
                    <td className="font-mono">{fn.code}</td>
                    <td>
                      <strong>{fn.name}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isAllowed ? (
                        <Badge variant="success">Được phép</Badge>
                      ) : (
                        <Badge variant="neutral">Không cho phép</Badge>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'center' }}>
                        <Button
                          variant={isAllowed ? 'danger' : 'primary'}
                          size="sm"
                          onClick={() => handleTogglePermission(fn, isAllowed)}
                          isLoading={isUpdating}
                        >
                          {isAllowed ? 'Thu hồi' : 'Cho phép'}
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
