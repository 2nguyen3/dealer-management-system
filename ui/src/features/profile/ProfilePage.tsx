import {
  CalendarDays,
  Check,
  Fingerprint,
  KeyRound,
  LayoutGrid,
  LogOut,
  Mail,
  Palette,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import {
  DonutChart,
  LegendList,
  RadialRings,
  SegmentedMeter,
} from '@/components/charts/MebiusCharts'
import { CountUp, Stagger, StaggerItem } from '@/components/motion/Motion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/shadcn/accordion'
import { Avatar, AvatarFallback } from '@/components/shadcn/avatar'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import { Label } from '@/components/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group'
import { Separator } from '@/components/shadcn/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/shadcn/tabs'
import { THEME_OPTIONS } from '@/components/theme/ModeToggle'
import { isPalette, PALETTES, usePalette } from '@/components/theme/palette'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from '@/app/navigation'
import { navigationIcons } from '@/app/navigationIcons'
import { ChangePasswordModal } from '../authentication/ChangePasswordModal'
import { useAuth } from '../authentication/useAuth'
import {
  daysSince,
  initials,
  PERMISSION_AREAS,
  permissionCoverage,
} from './profileModel'

export function ProfilePage() {
  const { user, allowedFunctions, hasPermission, logout } = useAuth()
  const navigate = useNavigate()
  const { theme = 'system', setTheme } = useTheme()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [palette, setPalette] = usePalette()
  const swatch =
    PALETTES.find((option) => option.value === palette)?.swatch ?? '#1857d1'
  if (!user) return null

  const granted = new Set<string>(allowedFunctions)
  const coverage = permissionCoverage(granted)
  const totalCodes = coverage.reduce((sum, area) => sum + area.total, 0)
  const totalGranted = coverage.reduce((sum, area) => sum + area.granted, 0)
  const tenure = daysSince(user.createdAt)
  const modules = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        !item.unavailable &&
        item.path !== '/' &&
        allowsNavigation(hasPermission, routePermissions[item.path]),
    )

  return (
    <div className="page-container space-y-6">
      <h1 className="sr-only">Hồ sơ cá nhân</h1>
      {/* Identity hero */}
      <Card className="bg-water relative overflow-hidden py-0 shadow-xs">
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
          <Avatar className="size-20 rounded-2xl shadow-md ring-4 ring-card">
            <AvatarFallback className="rounded-2xl bg-gradient-to-br from-[#5fd4ff] via-primary to-[#0a2a6b] text-2xl font-bold text-white">
              {initials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-bold tracking-tight">
                {user.fullName}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  'gap-1',
                  user.status === 'ACTIVE'
                    ? 'border-success/40 text-success'
                    : 'border-destructive/40 text-destructive',
                )}
              >
                {user.status === 'ACTIVE' ? <Check /> : <X />}
                {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4" /> {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" /> {user.groupName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" /> Từ{' '}
                {formatDate(user.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 md:flex-col">
            <Button variant="outline" onClick={() => setPasswordOpen(true)}>
              <KeyRound /> Đổi mật khẩu
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() =>
                void logout().then(() => navigate('/login', { replace: true }))
              }
            >
              <LogOut /> Đăng xuất
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Quyền được cấp',
            value: totalGranted,
            suffix: `/${totalCodes}`,
            icon: ShieldCheck,
          },
          {
            label: 'Chức năng truy cập',
            value: modules.length,
            suffix: '',
            icon: LayoutGrid,
          },
          {
            label: 'Số ngày tham gia',
            value: tenure ?? 0,
            suffix: ' ngày',
            icon: CalendarDays,
          },
          {
            label: 'Mức phủ quyền',
            value: totalCodes
              ? Math.round((totalGranted / totalCodes) * 100)
              : 0,
            suffix: '%',
            icon: Fingerprint,
          },
        ].map((kpi) => (
          <StaggerItem key={kpi.label}>
            <Card className="gap-2 p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{kpi.label}</span>
                <kpi.icon className="size-4" />
              </div>
              <p className="text-2xl font-bold tabular-nums">
                <CountUp value={kpi.value} />
                <span className="text-sm font-medium text-muted-foreground">
                  {kpi.suffix}
                </span>
              </p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid /> Tổng quan
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <ShieldCheck /> Quyền hạn
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette /> Giao diện
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"
        >
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm">
                Phủ quyền theo nghiệp vụ
              </CardTitle>
              <CardDescription className="text-xs">
                Tỉ lệ quyền đã cấp
              </CardDescription>
            </CardHeader>
            <CardContent className="grid items-center gap-4 sm:grid-cols-2">
              <RadialRings
                data={coverage.map((area) => ({
                  key: area.key,
                  label: area.label,
                  ratio: area.ratio,
                }))}
                centerValue={`${totalGranted}`}
                centerLabel="quyền"
                height={200}
              />
              <LegendList
                items={coverage.map((area) => ({
                  key: area.key,
                  label: area.label,
                  value: `${area.granted}/${area.total}`,
                }))}
              />
            </CardContent>
          </Card>
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm">Truy cập nhanh</CardTitle>
              <CardDescription className="text-xs">
                {modules.length} chức năng khả dụng
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Stagger
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                step={0.02}
              >
                {modules.map((item) => {
                  const Icon = navigationIcons[item.path]
                  return (
                    <StaggerItem key={item.path}>
                      <NavLink
                        to={item.path}
                        className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:shadow-sm"
                      >
                        {Icon && (
                          <Icon className="size-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </StaggerItem>
                  )
                })}
              </Stagger>
            </CardContent>
          </Card>
          <Card className="shadow-xs lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  'Mã người dùng',
                  <code key="id" className="text-xs">
                    {user.id}
                  </code>,
                ],
                ['Nhóm', `${user.groupName} · ${user.groupCode}`],
                ['Tạo lúc', formatDateTime(user.createdAt)],
                ['Cập nhật lúc', formatDateTime(user.updatedAt)],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-0 space-y-0.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="truncate font-medium">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="permissions"
          className="grid gap-4 lg:grid-cols-[1fr_1.6fr]"
        >
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm">Cơ cấu quyền</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DonutChart
                data={coverage
                  .filter((area) => area.granted > 0)
                  .map((area) => ({
                    key: area.key,
                    label: area.label,
                    value: area.granted,
                    color: `var(--chart-${PERMISSION_AREAS.findIndex((a) => a.key === area.key) + 1})`,
                  }))}
                centerLabel="đã cấp"
                centerValue={String(totalGranted)}
                valueFormatter={(value) => `${value} quyền`}
                height={200}
              />
              <div className="space-y-1.5">
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>Tổng mức phủ</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {totalGranted}/{totalCodes}
                  </span>
                </p>
                <SegmentedMeter
                  ratio={totalCodes ? totalGranted / totalCodes : 0}
                  label="Mức phủ quyền"
                />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm">Chi tiết quyền</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion
                type="multiple"
                defaultValue={[PERMISSION_AREAS[0]!.key]}
              >
                {PERMISSION_AREAS.map((area, index) => {
                  const count = area.codes.filter(({ code }) =>
                    granted.has(code),
                  ).length
                  return (
                    <AccordionItem key={area.key} value={area.key}>
                      <AccordionTrigger className="hover:no-underline">
                        <span className="flex flex-1 items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: `var(--chart-${index + 1})` }}
                          />
                          {area.label}
                          <Badge
                            variant="secondary"
                            className="ml-auto tabular-nums"
                          >
                            {count}/{area.codes.length}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-wrap gap-1.5">
                        {area.codes.map(({ code, label }) => {
                          const ok = granted.has(code)
                          return (
                            <Badge
                              key={code}
                              variant="outline"
                              className={cn(
                                'gap-1',
                                ok
                                  ? 'border-primary/30 bg-primary/8 text-primary'
                                  : 'text-muted-foreground line-through opacity-60',
                              )}
                              title={code}
                            >
                              {ok ? <Check /> : <X />}
                              {label}
                            </Badge>
                          )
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm">Chủ đề giao diện</CardTitle>
              <CardDescription className="text-xs">
                Lưu trên trình duyệt này
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="grid gap-3 sm:grid-cols-3"
                aria-label="Chủ đề giao diện"
              >
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <Label
                    key={value}
                    htmlFor={`theme-${value}`}
                    className="cursor-pointer flex-col items-stretch gap-3 rounded-xl border p-3 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                  >
                    <ThemePreview mode={value} accent={swatch} />
                    <span className="flex items-center gap-2">
                      <RadioGroupItem id={`theme-${value}`} value={value} />
                      <Icon className="size-4" />
                      {label}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <Separator className="my-5" />
              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Palette className="size-4" /> Màu chủ đạo
              </p>
              <RadioGroup
                value={palette}
                onValueChange={(value) => isPalette(value) && setPalette(value)}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
                aria-label="Màu chủ đạo"
              >
                {PALETTES.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`palette-${option.value}`}
                    className="cursor-pointer flex-col items-stretch gap-2 rounded-xl border p-3 transition-all hover:-translate-y-0.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                  >
                    <span className="flex gap-1" aria-hidden="true">
                      <span
                        className="h-8 flex-[2] rounded-md"
                        style={{ background: option.swatch }}
                      />
                      <span
                        className="h-8 flex-1 rounded-md opacity-45"
                        style={{ background: option.swatch }}
                      />
                      <span
                        className="h-8 flex-1 rounded-md opacity-15"
                        style={{ background: option.swatch }}
                      />
                    </span>
                    <span className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`palette-${option.value}`}
                        value={option.value}
                      />
                      <span className="grid leading-tight">
                        <span>{option.label}</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </div>
  )
}

/** Miniature workspace drawn in the target theme's own colours. */
function ThemePreview({ mode, accent }: { mode: string; accent: string }) {
  const dark = mode === 'dark'
  const half = mode === 'system'
  const tile = (isDark: boolean) => (
    <div
      className="flex h-full flex-1 gap-1.5 p-2"
      style={{ background: isDark ? '#050a14' : '#f5f8fc' }}
    >
      <div
        className="w-1/4 rounded-sm"
        style={{ background: isDark ? '#03070f' : '#08142b' }}
      />
      <div className="flex flex-1 flex-col gap-1.5">
        <div
          className="h-2 w-2/3 rounded-sm"
          style={{ background: isDark ? '#19263f' : '#dfe6f0' }}
        />
        <div
          className="flex flex-1 items-end gap-1 rounded-sm p-1"
          style={{ background: isDark ? '#0a1222' : '#ffffff' }}
        >
          {[40, 70, 55, 90, 65].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${h}%`,
                background: accent,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
  return (
    <div
      className="flex h-24 overflow-hidden rounded-lg border"
      aria-hidden="true"
    >
      {half ? (
        <>
          {tile(false)}
          {tile(true)}
        </>
      ) : (
        tile(dark)
      )}
    </div>
  )
}
