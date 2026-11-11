# UI polish — "Thủy" theme, mono type, visual-first screens (2026-11-12)

Scope: visual/interaction polish of the implemented React UI. No backend or API
contract change; server remains authority for stock, debt, payment and permission.

## Goals

| # | Goal | Outcome |
| - | ---- | ------- |
| G1 | Clear, compact, visual-first | KPI tiles + charts + tables first; descriptions cut to one short line or removed |
| G2 | shadcn/ui only | Primitives come from the shadcn registry (`npx shadcn add`), composed — not hand-made look-alikes |
| G3 | Motion | Route fade/slide, staggered tiles, chart draw-in, count-up numbers (`motion`), respects reduced motion |
| G4 | Charts in the Mebius freebies style | Rounded bars, soft gradient areas, radial rings, segmented progress, dashed horizontal grid, card-native tooltips |
| G5 | Monospace type | JetBrains Mono (Vietnamese subset) for the whole UI |
| G6 | "Thủy" (water) identity | Ocean blue / deep navy / cyan / silver palette, new water-drop logo mark, favicon |
| G7 | Light + dark theme | `next-themes` class strategy, header toggle, profile preference, full dark token set |
| G8 | User profile | `/profile`: identity hero, permission coverage visuals, security (change password), appearance |
| G9 | Clear payment flow | Online payments as a 4-step tracker (Tạo → Thanh toán VNPAY → Cổng xác nhận → Phiếu thu), stepper dialog, QR/link hand-off |
| G10 | Filter / sort / order | Server-side `sort` (contract enums) via sortable column headers + sort menu; existing filters kept |

## Phases

1. **Foundations** (single owner, before page work)
   - Tokens rewrite in `src/styles.css` (light + `.dark`), remove legacy junk.
   - Font swap (`@fontsource-variable/jetbrains-mono`), `BrandMark` SVG + favicon.
   - `ThemeProvider`, `ModeToggle` (shadcn dark-mode recipe), Sonner `Toaster`.
   - Motion helpers: `PageTransition`, `Stagger`, `CountUp`.
   - Data helpers: `SortableHeader` (shadcn data-table header recipe), `useSort`.
   - Chart kit `src/components/charts/` (Mebius-style Recharts wrappers).
   - Extra registry components: radio-group, accordion, hover-card, empty, kbd, item…
   - Profile route + sidebar/user-menu entry.
2. **Page polish** (parallel, disjoint file ownership)
   - A: Home, Dashboard, Reports.
   - B: Finance — online payments flow, receipts, upfront, refunds, credit, receivables.
   - C: Master data & admin — agencies, products, catalogues, users, groups, permissions, audit, rules.
   - D: Goods — receipts, issues, returns, adjustments, counts, inventory, history, corrections.
3. **Verification**: `npm run typecheck`, `lint`, `format:check`, `test`, `build`;
   Docker rebuild of frontend + readiness; browser smoke on 8080.
4. **Release**: commit on `deploy-prod`, push `origin`, Vercel production deploy.

## Rules for page work

- Shared blocks (`components/blocks`, `components/charts`, `components/ui`) are owned by
  phase 1; pages consume them.
- Keep test markers, roles, labels and validated data handling; update tests only for
  intentional copy/structure changes.
- Sort only by fields the contract enum allows (`GET … sort`); unknown sort → 422.
- Status is always text + colour; charts keep a table view where they had one.
