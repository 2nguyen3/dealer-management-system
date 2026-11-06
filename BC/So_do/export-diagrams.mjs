// Shared geometry keeps the editable draw.io file and report images consistent.
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(new URL('../../ui/package.json', import.meta.url))
const { chromium } = require('playwright')
const width = 1600
const height = 1200
const boxes = [
  { id: 'presentation', x: 60, y: 130, w: 940, h: 170, title: 'TẦNG 1. TRÌNH BÀY', frame: true },
  { id: 'application', x: 60, y: 360, w: 940, h: 510, title: 'TẦNG 2. ỨNG DỤNG', frame: true },
  { id: 'data', x: 60, y: 930, w: 940, h: 160, title: 'TẦNG 3. DỮ LIỆU', frame: true },
  { id: 'browser', x: 100, y: 195, w: 400, h: 75, lines: ['Trình duyệt người dùng', 'React 19 · TypeScript · SPA'] },
  { id: 'nginx', x: 620, y: 195, w: 340, h: 75, lines: ['Nginx', 'Phục vụ UI · Proxy /api/'] },
  { id: 'api', x: 190, y: 430, w: 660, h: 80, lines: ['FastAPI: Router / Schema / Dependencies', 'Nhận HTTP · Kiểm tra dữ liệu · Xác thực / RBAC'] },
  { id: 'service', x: 190, y: 560, w: 660, h: 90, lines: ['Service: xử lý nghiệp vụ', 'Danh mục · Chứng từ · Kho · Công nợ · Thanh toán · Báo cáo'] },
  { id: 'repository', x: 190, y: 710, w: 660, h: 80, lines: ['Repository / SQLAlchemy 2 / psycopg 3', 'Truy vấn và ghi dữ liệu trong transaction'] },
  { id: 'postgres', x: 190, y: 990, w: 660, h: 75, lines: ['PostgreSQL trên Supabase (dịch vụ bên ngoài)', 'Bảng · Khóa / ràng buộc · Trigger · Ledger · View / Function'] },
  { id: 'vnpay', x: 1150, y: 550, w: 390, h: 110, lines: ['VNPAY', 'Thanh toán online', 'Tích hợp sandbox; không đồng nghĩa production'] },
  { id: 'smtp', x: 1150, y: 720, w: 390, h: 90, lines: ['Máy chủ SMTP', 'Gửi email đặt lại mật khẩu', 'Chỉ hoạt động khi có cấu hình hợp lệ'], dashed: true },
]
const edges = [
  { id: 'web', source: 'browser', target: 'nginx', points: [[500, 232], [620, 232]], label: 'HTTP', lx: 560, ly: 215, both: true },
  { id: 'http', source: 'nginx', target: 'api', points: [[790, 270], [790, 325], [520, 325], [520, 430]], label: '/api/v1 · JSON', lx: 680, ly: 318, both: true },
  { id: 'business', source: 'api', target: 'service', points: [[520, 510], [520, 560]], both: true },
  { id: 'access', source: 'service', target: 'repository', points: [[520, 650], [520, 710]], both: true },
  { id: 'sql', source: 'repository', target: 'postgres', points: [[520, 790], [520, 990]], label: 'SQL · kết nối TLS', lx: 650, ly: 912, both: true },
  { id: 'payment', source: 'service', target: 'vnpay', points: [[850, 605], [1150, 605]], label: 'Checkout / Query / Refund', lx: 1000, ly: 593, both: true },
  { id: 'ipn', source: 'vnpay', target: 'api', points: [[1250, 550], [1250, 470], [850, 470]], label: 'IPN đã ký (qua public ingress)', lx: 1120, ly: 456 },
  { id: 'mail', source: 'service', target: 'smtp', points: [[850, 630], [1060, 630], [1060, 765], [1150, 765]], label: 'SMTP / TLS', lx: 1090, ly: 698, dashed: true },
]
const annotations = [
  { x: 60, y: 62, text: 'KIẾN TRÚC HỆ THỐNG AGENTRA', size: 32, bold: true },
  { x: 60, y: 100, text: 'Client–server ba tầng · Backend nguyên khối mô-đun (modular monolith)', size: 21 },
  { x: 1150, y: 400, text: 'DỊCH VỤ TÍCH HỢP NGOÀI', size: 21, bold: true },
  { x: 90, y: 835, text: 'Xuyên suốt: cấu hình · lỗi API · request ID · logging · phiên DB', size: 18 },
  { x: 60, y: 1132, text: 'Mũi tên hai chiều: yêu cầu / phản hồi. Nét đứt: email phụ thuộc cấu hình.', size: 18 },
  { x: 60, y: 1163, text: 'Sơ đồ từ mã nguồn ngày 06/11/2026; không xác nhận trạng thái dịch vụ đang chạy.', size: 18 },
]
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const svgBoxes = boxes.map((box) => {
  const rect = `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="white" stroke="black" stroke-width="2"${box.dashed ? ' stroke-dasharray="8 5"' : ''}/>`
  if (box.frame) return `${rect}<text x="${box.x + 25}" y="${box.y + 37}" font-size="22" font-weight="700">${escape(box.title)}</text>`
  const start = box.y + box.h / 2 - (box.lines.length - 1) * 13
  return rect + box.lines.map((line, i) => `<text data-box="${box.id}" x="${box.x + box.w / 2}" y="${start + i * 26}" text-anchor="middle" dominant-baseline="middle" font-size="${i === 0 ? 21 : 17}" font-weight="${i === 0 ? 700 : 400}">${escape(line)}</text>`).join('')
}).join('\n')
const svgEdges = edges.map((edge) => `<polyline points="${edge.points.map((point) => point.join(',')).join(' ')}" fill="none" stroke="black" stroke-width="2" marker-end="url(#arrow)"${edge.both ? ' marker-start="url(#arrow)"' : ''}${edge.dashed ? ' stroke-dasharray="8 5"' : ''}/>` + (edge.label ? `<text x="${edge.lx}" y="${edge.ly}" text-anchor="middle" font-size="17" stroke="white" stroke-width="5" paint-order="stroke">${escape(edge.label)}</text>` : '')).join('\n')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Kiến trúc ba tầng của Agentra</title>
<desc id="desc">Trình duyệt và Nginx ở tầng trình bày; FastAPI, service và repository ở tầng ứng dụng; PostgreSQL trên Supabase ở tầng dữ liệu. Backend tích hợp VNPAY và SMTP.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="black"/></marker></defs>
<rect width="100%" height="100%" fill="white"/>
<g font-family="Arial, sans-serif" fill="black">${svgBoxes}\n${svgEdges}\n${annotations.map((a) => `<text x="${a.x}" y="${a.y}" font-size="${a.size}" font-weight="${a.bold ? 700 : 400}">${escape(a.text)}</text>`).join('\n')}</g></svg>\n`
const cells = boxes.map((box) => {
  const value = box.frame ? box.title : box.lines.join('\n')
  const style = `rounded=0;whiteSpace=wrap;html=0;fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;fontFamily=Arial;fontSize=${box.frame ? 22 : 19};strokeWidth=2;${box.frame ? 'align=left;verticalAlign=top;spacingTop=18;spacingLeft=25;fontStyle=1;' : 'align=center;verticalAlign=middle;'}${box.dashed ? 'dashed=1;' : ''}`
  return `<mxCell id="${box.id}" value="${escape(value).replaceAll('\n', '&#10;')}" style="${style}" vertex="1" parent="1"><mxGeometry x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" as="geometry"/></mxCell>`
})
for (const edge of edges) {
  const source = boxes.find((box) => box.id === edge.source)
  const target = boxes.find((box) => box.id === edge.target)
  const first = edge.points[0]
  const last = edge.points.at(-1)
  const style = `edgeStyle=none;rounded=0;html=0;endArrow=block;endFill=1;startArrow=${edge.both ? 'block' : 'none'};startFill=1;strokeColor=#000000;strokeWidth=2;exitX=${(first[0] - source.x) / source.w};exitY=${(first[1] - source.y) / source.h};exitPerimeter=0;entryX=${(last[0] - target.x) / target.w};entryY=${(last[1] - target.y) / target.h};entryPerimeter=0;${edge.dashed ? 'dashed=1;' : ''}`
  cells.push(`<mxCell id="${edge.id}" style="${style}" edge="1" parent="1" source="${edge.source}" target="${edge.target}"><mxGeometry relative="1" as="geometry"><Array as="points">${edge.points.slice(1, -1).map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array></mxGeometry></mxCell>`)
  if (edge.label) annotations.push({ x: edge.lx - 170, y: edge.ly, text: edge.label, size: 17, w: 340, center: true })
}
for (const [index, a] of annotations.entries()) {
  cells.push(`<mxCell id="text-${index}" value="${escape(a.text)}" style="text;html=0;whiteSpace=wrap;align=${a.center ? 'center' : 'left'};verticalAlign=middle;fillColor=${a.center ? '#FFFFFF' : 'none'};strokeColor=none;fontColor=#000000;fontFamily=Arial;fontSize=${a.size};fontStyle=${a.bold ? 1 : 0};" vertex="1" parent="1"><mxGeometry x="${a.x}" y="${a.y - a.size}" width="${a.w ?? (width - a.x - 20)}" height="${a.size + 8}" as="geometry"/></mxCell>`)
}
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" type="device"><diagram id="agentra-architecture" name="Kiến trúc ba tầng"><mxGraphModel dx="${width}" dy="${height}" grid="1" gridSize="10" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" background="#FFFFFF"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('\n')}</root></mxGraphModel></diagram></mxfile>\n`
await writeFile(path.join(directory, 'Kien_truc_he_thong.svg'), svg, 'utf8')
await writeFile(path.join(directory, 'Kien_truc_he_thong.drawio'), xml, 'utf8')
const browser = await chromium.launch({ headless: true, channel: process.env.BC_BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await page.setContent(`<html lang="vi"><head><meta charset="UTF-8"/><style>html,body{margin:0;padding:0;background:white}svg{display:block}</style></head><body>${svg}</body></html>`)
  const checks = await page.evaluate(({ xml, boxes, width, height }) => {
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml')
    const errors = [...documentXml.querySelectorAll('parsererror')].map((el) => el.textContent)
    const cells = [...documentXml.querySelectorAll('mxCell')]
    const ids = cells.map((cell) => cell.id)
    if (new Set(ids).size !== ids.length) errors.push('Duplicate draw.io IDs')
    for (const cell of cells.filter((cell) => cell.getAttribute('edge') === '1')) {
      if (!ids.includes(cell.getAttribute('source')) || !ids.includes(cell.getAttribute('target'))) errors.push(`Missing edge endpoint: ${cell.id}`)
    }
    for (const text of document.querySelectorAll('text')) {
      const bounds = text.getBBox()
      if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > width || bounds.y + bounds.height > height) errors.push(`Outside canvas: ${text.textContent}`)
      const box = boxes.find((item) => item.id === text.getAttribute('data-box'))
      if (box && (bounds.x < box.x + 8 || bounds.x + bounds.width > box.x + box.w - 8 || bounds.y < box.y || bounds.y + bounds.height > box.y + box.h)) errors.push(`Outside box: ${text.textContent}`)
    }
    return { errors, vertices: cells.filter((cell) => cell.getAttribute('vertex') === '1').length, edges: cells.filter((cell) => cell.getAttribute('edge') === '1').length }
  }, { xml, boxes, width, height })
  if (checks.errors.length) throw new Error(JSON.stringify(checks))
  await page.screenshot({ path: path.join(directory, 'Kien_truc_he_thong.png'), timeout: 120000 })
  console.log(JSON.stringify({ ...checks, png: '3200x2400', output: directory }, null, 2))
} finally {
  await browser.close()
}
