import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(new URL('../../ui/package.json', import.meta.url))
const { chromium } = require('playwright')
const width = 1800
const height = 2546
const nodes = []
const edges = []
const notes = []
const node = (id, cx, y, w, h, text, shape = 'box') => nodes.push({ id, x: cx - w / 2, y, w, h, text, shape })
const edge = (from, to, points, label = '', labelX = 0, labelY = 0) => edges.push({ from, to, points, label, labelX, labelY })
node('start', 740, 130, 240, 58, 'Bắt đầu', 'oval')
node('open', 740, 225, 420, 68, 'Người dùng truy cập\nứng dụng web')
node('restore', 740, 330, 420, 72, 'Tải giao diện React\nKhôi phục phiên nếu có')
node('session', 740, 450, 340, 110, 'Có phiên\nhợp lệ?', 'diamond')
node('login', 1300, 470, 390, 70, 'Nhập thông tin đăng nhập')
node('credentials', 1300, 585, 390, 76, 'Backend kiểm tra\ntài khoản và mật khẩu')
node('valid', 1300, 705, 330, 110, 'Đăng nhập\nhợp lệ?', 'diamond')
node('loginError', 1620, 590, 260, 76, 'Hiển thị lỗi\nđăng nhập')
node('tokens', 1300, 855, 390, 76, 'Tạo phiên / Cấp access token\nvà refresh token')
node('profile', 740, 855, 430, 76, 'Tải hồ sơ và quyền\nHiển thị chức năng phù hợp')
node('action', 740, 980, 430, 76, 'Người dùng chọn chức năng\nNhập dữ liệu hoặc bộ lọc')
node('request', 740, 1100, 430, 76, 'React gửi yêu cầu API\nNginx chuyển tiếp tới FastAPI')
node('authorize', 740, 1220, 430, 76, 'Backend kiểm tra xác thực,\nquyền và dữ liệu')
node('accepted', 740, 1340, 340, 110, 'Yêu cầu được\nchấp nhận?', 'diamond')
node('reject', 1320, 1357, 390, 76, 'Trả lỗi\nKhông thực hiện nghiệp vụ')
node('error', 1540, 1475, 380, 76, 'Hiển thị lỗi; yêu cầu\nđăng nhập lại nếu cần')
node('kind', 740, 1500, 340, 110, 'Loại\nthao tác?', 'diamond')
node('query', 350, 1665, 430, 76, 'Truy vấn PostgreSQL\nLọc, phân trang hoặc tổng hợp')
node('readResult', 350, 1825, 430, 76, 'Tạo dữ liệu phản hồi\nhoặc tệp báo cáo')
node('transaction', 1060, 1665, 430, 76, 'Mở transaction / Kiểm tra\ntrạng thái và quy tắc nghiệp vụ')
node('write', 1060, 1785, 430, 76, 'Khóa, kiểm tra phiên bản\nGhi dữ liệu, kiểm tra ràng buộc')
node('committed', 1060, 1905, 350, 120, 'Giao dịch hoàn tất\nthành công?', 'diamond')
node('rollback', 1530, 1927, 380, 76, 'Rollback nếu chưa commit\nTrả lỗi nghiệp vụ')
node('writeResult', 1060, 2070, 430, 76, 'Dữ liệu đã commit\nTạo phản hồi thành công')
node('response', 740, 2190, 430, 64, 'API trả kết quả qua Nginx')
node('display', 740, 2290, 430, 70, 'React hiển thị dữ liệu\nCập nhật trạng thái giao diện')
node('continue', 740, 2395, 340, 110, 'Tiếp tục\nsử dụng?', 'diamond')
node('logout', 1260, 2410, 400, 76, 'Đăng xuất / Xóa phiên cục bộ\nGửi yêu cầu thu hồi phiên')
node('end', 1640, 2420, 210, 58, 'Kết thúc', 'oval')

edge('start', 'open', [[740,188],[740,225]])
edge('open', 'restore', [[740,293],[740,330]])
edge('restore', 'session', [[740,402],[740,450]])
edge('session', 'profile', [[740,560],[740,855]], 'Có', 770, 600)
edge('session', 'login', [[910,505],[1105,505]], 'Không', 1005, 492)
edge('login', 'credentials', [[1300,540],[1300,585]])
edge('credentials', 'valid', [[1300,661],[1300,705]])
edge('valid', 'tokens', [[1300,815],[1300,855]], 'Có', 1330, 843)
edge('valid', 'loginError', [[1465,760],[1620,760],[1620,666]], 'Không', 1535, 745)
edge('loginError', 'login', [[1620,590],[1620,505],[1495,505]])
edge('tokens', 'profile', [[1105,893],[955,893]])
edge('profile', 'action', [[740,931],[740,980]])
edge('action', 'request', [[740,1056],[740,1100]])
edge('request', 'authorize', [[740,1176],[740,1220]])
edge('authorize', 'accepted', [[740,1296],[740,1340]])
edge('accepted', 'reject', [[910,1395],[1125,1395]], 'Không', 1010, 1381)
edge('reject', 'error', [[1515,1395],[1540,1395],[1540,1475]])
edge('accepted', 'kind', [[740,1450],[740,1500]], 'Có', 769, 1483)
edge('kind', 'query', [[570,1555],[350,1555],[350,1665]], 'Tra cứu / Báo cáo', 365, 1539)
edge('kind', 'transaction', [[910,1555],[1060,1555],[1060,1665]], 'Thay đổi dữ liệu', 1100, 1598)
edge('query', 'readResult', [[350,1741],[350,1825]], 'Thành công', 425, 1790)
edge('query', 'error', [[135,1703],[80,1703],[80,1630],[1755,1630],[1755,1513],[1730,1513]], 'Lỗi truy vấn', 1530, 1615)
edge('transaction', 'write', [[1060,1741],[1060,1785]])
edge('write', 'committed', [[1060,1861],[1060,1905]])
edge('committed', 'rollback', [[1235,1965],[1340,1965]], 'Không', 1289, 1949)
edge('rollback', 'error', [[1720,1965],[1775,1965],[1775,1455],[1540,1455],[1540,1475]])
edge('committed', 'writeResult', [[1060,2025],[1060,2070]], 'Có', 1089, 2054)
edge('readResult', 'response', [[350,1901],[350,2222],[525,2222]])
edge('writeResult', 'response', [[1060,2146],[1060,2170],[740,2170],[740,2190]])
edge('response', 'display', [[740,2254],[740,2290]])
edge('display', 'continue', [[740,2360],[740,2395]])
edge('error', 'continue', [[1540,1551],[1540,1580],[1700,1580],[1700,1850],[1305,1850],[1305,2345],[1000,2345],[1000,2380],[900,2380],[900,2450],[910,2450]])
edge('continue', 'restore', [[570,2450],[45,2450],[45,366],[530,366]], 'Có: kiểm tra / khôi phục phiên', 290, 2428)
edge('continue', 'logout', [[740,2505],[740,2525],[1260,2525],[1260,2486]], 'Không / Đăng xuất', 1030, 2513)
edge('logout', 'end', [[1460,2448],[1535,2448]])

notes.push({ x: 90, y: 70, size: 34, text: 'QUÁ TRÌNH HOẠT ĐỘNG CỦA HỆ THỐNG AGENTRA', bold: true })
notes.push({ x: 90, y: 108, size: 22, text: 'Luồng tổng quát: truy cập, xác thực, xử lý yêu cầu và phản hồi' })
notes.push({ x: 150, y: 670, size: 22, text: 'NGUYÊN TẮC XỬ LÝ', bold: true })
notes.push({ x: 150, y: 713, size: 21, text: 'Backend quyết định quyền truy cập.' })
notes.push({ x: 150, y: 749, size: 21, text: 'Trình duyệt không truy cập trực tiếp DB.' })
notes.push({ x: 150, y: 785, size: 21, text: 'Lưu nháp chưa làm phát sinh ghi sổ.' })
notes.push({ x: 1140, y: 1025, size: 21, text: 'Thanh toán online có luồng xác minh riêng.' })
notes.push({ x: 1140, y: 1060, size: 21, text: 'Return không phải bằng chứng đã thu tiền.' })
notes.push({ x: 1300, y: 2075, size: 20, text: 'Chỉ báo ghi thành công sau commit.' })
notes.push({ x: 1300, y: 2110, size: 20, text: 'Mất phản hồi: cần xác định kết quả;' })
notes.push({ x: 1300, y: 2145, size: 20, text: 'không tự phát lại lệnh ghi mới.' })
notes.push({ x: 1300, y: 2180, size: 20, text: 'If-Match / Idempotency-Key áp dụng' })
notes.push({ x: 1300, y: 2215, size: 20, text: 'cho các thao tác có yêu cầu.' })

const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const text = (lines, x, cy, size = 23) => lines.split('\n').map((line, index, all) => `<text x="${x}" y="${cy + (index - (all.length - 1) / 2) * 30}" text-anchor="middle" dominant-baseline="middle" font-size="${size}">${esc(line)}</text>`).join('')
const svgNodes = nodes.map((n) => {
  const cx = n.x + n.w / 2
  const cy = n.y + n.h / 2
  const shape = n.shape === 'diamond' ? `<polygon points="${cx},${n.y} ${n.x+n.w},${cy} ${cx},${n.y+n.h} ${n.x},${cy}"/>` : n.shape === 'oval' ? `<ellipse cx="${cx}" cy="${cy}" rx="${n.w/2}" ry="${n.h/2}"/>` : `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"/>`
  return `<g fill="white" stroke="black" stroke-width="2">${shape}</g>${text(n.text, cx, cy)}`
}).join('\n')
const svgEdges = edges.map((e) => `<polyline points="${e.points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="black" stroke-width="2" marker-end="url(#arrow)"/>${e.label ? `<text x="${e.labelX}" y="${e.labelY}" font-size="20" text-anchor="middle" stroke="white" stroke-width="7" paint-order="stroke">${esc(e.label)}</text>` : ''}`).join('\n')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Lưu đồ quá trình hoạt động Agentra"><defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="black"/></marker></defs><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="black">${svgEdges}${svgNodes}${notes.map((n) => `<text x="${n.x}" y="${n.y}" font-size="${n.size}" font-weight="${n.bold ? 700 : 400}">${esc(n.text)}</text>`).join('')}</g></svg>\n`
const cells = nodes.map((n) => `<mxCell id="${n.id}" value="${esc(n.text).replaceAll('\n','&#10;')}" vertex="1" parent="1" style="shape=${n.shape === 'diamond' ? 'rhombus' : n.shape === 'oval' ? 'ellipse' : 'rectangle'};whiteSpace=wrap;html=0;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;fontColor=#000000;fontFamily=Arial;fontSize=23;"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`)
for (const [i,e] of edges.entries()) {
  const source = nodes.find((n) => n.id === e.from)
  const target = nodes.find((n) => n.id === e.to)
  const first = e.points[0], last = e.points.at(-1)
  cells.push(`<mxCell id="edge-${i}" edge="1" parent="1" source="${e.from}" target="${e.to}" style="edgeStyle=none;rounded=0;endArrow=block;endFill=1;strokeColor=#000000;strokeWidth=2;exitX=${(first[0]-source.x)/source.w};exitY=${(first[1]-source.y)/source.h};exitPerimeter=0;entryX=${(last[0]-target.x)/target.w};entryY=${(last[1]-target.y)/target.h};entryPerimeter=0;"><mxGeometry relative="1" as="geometry"><Array as="points">${e.points.slice(1,-1).map(([x,y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array></mxGeometry></mxCell>`)
  if (e.label) notes.push({ x: e.labelX-180, y: e.labelY, size: 20, text: e.label, center: true })
}
for (const [i,n] of notes.entries()) cells.push(`<mxCell id="note-${i}" value="${esc(n.text)}" vertex="1" parent="1" style="text;html=0;whiteSpace=wrap;align=${n.center ? 'center' : 'left'};fillColor=${n.center ? '#FFFFFF' : 'none'};strokeColor=none;fontColor=#000000;fontFamily=Arial;fontSize=${n.size};fontStyle=${n.bold ? 1 : 0};"><mxGeometry x="${n.x}" y="${n.y-n.size}" width="${n.center ? 360 : width-n.x-30}" height="${n.size+10}" as="geometry"/></mxCell>`)
const xml = `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" type="device"><diagram id="workflow" name="Quá trình hoạt động"><mxGraphModel page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" background="#FFFFFF"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('\n')}</root></mxGraphModel></diagram></mxfile>\n`
await writeFile(path.join(directory, 'Qua_trinh_hoat_dong.svg'), svg)
await writeFile(path.join(directory, 'Qua_trinh_hoat_dong.drawio'), xml)
const browser = await chromium.launch({ headless: true, channel: process.env.BC_BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await page.setContent(`<html lang="vi"><head><meta charset="utf-8"/><style>html,body{margin:0;background:white}svg{display:block}</style></head><body>${svg}</body></html>`)
  await page.screenshot({ path: path.join(directory, 'Qua_trinh_hoat_dong.png'), timeout: 120000 })
  console.log('Exported workflow PNG (3600x5092), SVG and draw.io. No verification suite run.')
} finally {
  await browser.close()
}
