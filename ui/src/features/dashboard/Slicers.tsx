import { FilterX, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Select } from '../../components/ui/Select'
import { useCatalogOptions } from '../districts/useCatalogOptions'
import {
  activeFilters,
  filterNames,
  type FilterKey,
  type FilterValue,
  type Filters,
} from './model'

export interface SlicerAvailability {
  agencyId: boolean
  typeId: boolean
  districtId: boolean
  productId: boolean
}

/** Power BI–style slicer bar: one row of filters plus active-filter chips. */
export function Slicers({
  month,
  months,
  onMonth,
  filters,
  available,
  onFilter,
  onReset,
}: {
  month: string
  months: { value: string; label: string }[]
  onMonth: (value: string) => void
  filters: Filters
  available: SlicerAvailability
  onFilter: (key: FilterKey, value: FilterValue | null) => void
  onReset: () => void
}) {
  const types = useCatalogOptions(available.typeId ? '/agency-types' : null)
  const districts = useCatalogOptions(
    available.districtId ? '/districts' : null,
  )
  const active = activeFilters(filters)

  function catalogChange(
    key: 'typeId' | 'districtId',
    options: { value: string; label: string }[],
    value: string,
  ) {
    const option = options.find((item) => item.value === value)
    onFilter(
      key,
      value ? { id: value, label: option?.label ?? `#${value}` } : null,
    )
  }

  return (
    <section
      aria-label="Bộ lọc bảng điều khiển"
      className="z-10 rounded-xl border lg:sticky lg:top-14 bg-card/95 p-3 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] [&_.form-field]:mb-0">
        <Select
          id="dashboard-month"
          label="Tháng"
          options={months}
          value={month}
          onChange={(event) => onMonth(event.target.value)}
        />
        {available.agencyId && (
          <EntityPicker
            id="dashboard-agency"
            resource="agencies"
            label="Đại lý"
            placeholder="Tất cả đại lý"
            value={filters.agencyId?.id ?? ''}
            onChange={(id, item) =>
              onFilter(
                'agencyId',
                id ? { id, label: item?.label ?? `#${id}` } : null,
              )
            }
          />
        )}
        {available.typeId && (
          <Select
            id="dashboard-type"
            label="Loại đại lý"
            value={filters.typeId?.id ?? ''}
            error={types.error || undefined}
            onChange={(event) =>
              catalogChange('typeId', types.options, event.target.value)
            }
            options={[
              {
                value: '',
                label: types.loading ? 'Đang tải…' : 'Tất cả loại',
              },
              ...types.options,
            ]}
          />
        )}
        {available.districtId && (
          <Select
            id="dashboard-district"
            label="Quận"
            value={filters.districtId?.id ?? ''}
            error={districts.error || undefined}
            onChange={(event) =>
              catalogChange('districtId', districts.options, event.target.value)
            }
            options={[
              {
                value: '',
                label: districts.loading ? 'Đang tải…' : 'Tất cả quận',
              },
              ...districts.options,
            ]}
          />
        )}
        {available.productId && (
          <EntityPicker
            id="dashboard-product"
            resource="products"
            label="Mặt hàng"
            placeholder="Tất cả mặt hàng"
            value={filters.productId?.id ?? ''}
            onChange={(id, item) =>
              onFilter(
                'productId',
                id ? { id, label: item?.label ?? `#${id}` } : null,
              )
            }
          />
        )}
      </div>
      {active.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Đang lọc:
          </span>
          <ul className="flex flex-wrap gap-2" aria-label="Bộ lọc đang áp dụng">
            {active.map(([key, value]) => (
              <li
                key={key}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/8 py-0.5 pr-1 pl-2.5 text-xs text-foreground"
              >
                <span className="truncate">
                  <span className="text-muted-foreground">
                    {filterNames[key]}:
                  </span>{' '}
                  {value.label}
                </span>
                <button
                  type="button"
                  onClick={() => onFilter(key, null)}
                  aria-label={`Bỏ lọc ${filterNames[key]}`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/15 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            icon={<FilterX className="size-4" aria-hidden="true" />}
            onClick={onReset}
          >
            Xóa bộ lọc
          </Button>
        </div>
      )}
    </section>
  )
}
