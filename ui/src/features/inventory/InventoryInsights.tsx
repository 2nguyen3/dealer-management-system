import { PackageCheck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartCard } from '../../components/blocks/ChartCard'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../components/shadcn/chart'
import { Progress } from '../../components/shadcn/progress'
import { Table } from '../../components/ui/Table'
import {
  CHART_AXIS,
  CHART_GRID,
  formatCompact,
  toNumber,
} from '../../lib/chart'
import { formatQuantity, formatVND } from '../../lib/formatters'
import { SectionCard } from '../document_history/DocumentParts'
import { stockLevel, type StockRow } from './inventoryRows'

const TOP = 10
const chartConfig = {
  value: { label: 'Giá trị tồn', color: 'var(--chart-1)' },
} satisfies ChartConfig

function shorten(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** Top products by stock value: a single-series, single-hue horizontal bar. */
export function StockValueChart({ rows }: { rows: StockRow[] }) {
  const top = rows
    .filter((row) => row.stockValue !== null && row.stockValue > 0n)
    .sort((a, b) =>
      a.stockValue! === b.stockValue!
        ? a.code.localeCompare(b.code)
        : a.stockValue! > b.stockValue!
          ? -1
          : 1,
    )
    .slice(0, TOP)
  const data = top.map((row) => ({
    name: row.name,
    code: row.code,
    value: toNumber(row.stockValue!.toString()),
    exact: formatVND(row.stockValue!.toString()),
  }))
  return (
    <ChartCard
      title="Giá trị tồn kho cao nhất"
      description={`Top ${TOP} mặt hàng theo tồn × giá nhập hiện hành`}
      isEmpty={!data.length}
      empty={
        <p className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Chưa có mặt hàng nào có giá nhập để tính giá trị tồn.
        </p>
      }
      table={
        <Table caption="Giá trị tồn kho theo mặt hàng">
          <thead>
            <tr>
              <th>Mặt hàng</th>
              <th className="cell-number">Giá trị tồn</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.code}>
                <td>
                  <span className="font-medium text-foreground">
                    {item.name}
                  </span>{' '}
                  <span className="text-muted-foreground">({item.code})</span>
                </td>
                <td className="cell-number">{item.exact}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      }
    >
      <ChartContainer
        config={chartConfig}
        className="aspect-auto w-full"
        style={{ height: Math.max(160, data.length * 30 + 40) }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid horizontal={false} stroke={CHART_GRID} />
          <XAxis
            type="number"
            tickFormatter={(value: number) => formatCompact(value)}
            tick={{ fontSize: 11, fill: CHART_AXIS }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tickFormatter={(value: string) => shorten(value)}
            tick={{ fontSize: 12, fill: CHART_AXIS }}
            axisLine={false}
            tickLine={false}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)' }}
            content={
              <ChartTooltipContent
                formatter={(_value, _name, item) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">Giá trị tồn</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {(item.payload as { exact: string }).exact}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

/** Low-stock products ordered by how far below their threshold they are. */
export function LowStockCard({
  rows,
  onSelect,
}: {
  rows: StockRow[]
  onSelect: (row: StockRow) => void
}) {
  const low = rows
    .filter((row) => row.low)
    .map((row) => ({ row, level: stockLevel(row) }))
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .slice(0, 8)
  return (
    <SectionCard
      title="Cần nhập thêm"
      description="Mặt hàng dưới ngưỡng cảnh báo tồn"
      contentClassName="px-2"
    >
      {low.length ? (
        <ul className="space-y-1">
          {low.map(({ row, level }) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(row)}
                className="w-full cursor-pointer rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {`${formatQuantity(row.currentStock)}${row.threshold ? ` / ${formatQuantity(row.threshold)}` : ''} ${row.unitName}`.trim()}
                  </span>
                </span>
                <Progress
                  value={level ?? 0}
                  aria-valuenow={level ?? 0}
                  aria-label={`Mức tồn ${row.name}`}
                  className="mt-1.5 h-1.5 bg-amber-100 [&>[data-slot=progress-indicator]]:bg-amber-500"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
          <PackageCheck className="size-6 text-success" aria-hidden="true" />
          Không có mặt hàng nào dưới ngưỡng tồn.
        </div>
      )}
    </SectionCard>
  )
}
