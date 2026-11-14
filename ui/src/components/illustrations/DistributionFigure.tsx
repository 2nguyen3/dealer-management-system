import { useEffect, useId, useRef, useState } from 'react'
import type * as Three from 'three'
import './DistributionFigure.css'
import { t } from '@/lib/i18n/core'

type Point = [number, number, number]
type Tones = readonly [string, string, string]
type Part = { at: Point; size: Point; tones: Tones }
type FigureState = 'idle' | 'loading' | 'ready' | 'error'

const blue: Tones = ['#d9e8fa', '#8eafd8', '#5579a9']
const paper: Tones = ['#fffdf5', '#e7e8e2', '#c3cecf']
const roof: Tones = ['#7c9fce', '#547bab', '#385b87']
const ink = '#304e73'

// Conceptual loading dock: a slab supports the building, pallets and van.
// Roof ribs sit on the roof; shutters/signs sit on walls; crates sit on pallets.
function warehouseParts(): Part[] {
  const parts: Part[] = []
  const box = (at: Point, size: Point, tones: Tones = blue) => {
    parts.push({ at, size, tones })
  }
  box([0, -0.13, 0], [7.8, 0.26, 5.8], paper)
  box([-0.55, 1.35, -0.65], [4.6, 2.7, 3.1], paper)
  box([-0.55, 2.79, -0.65], [4.95, 0.18, 3.45], roof)
  for (let x = -2.7; x <= 1.7; x += 0.44) {
    box([x, 2.91, -0.65], [0.035, 0.06, 3.32], blue)
  }
  // Raised skylights and rear service windows make the alternate view complete.
  for (const x of [-1.6, 0.55]) {
    box([x, 2.98, -0.8], [0.73, 0.12, 0.95], paper)
    box([x, 3.05, -0.8], [0.58, 0.025, 0.8], blue)
    box([x, 1.75, -2.215], [0.82, 0.52, 0.04], roof)
  }
  box([-2.865, 1.6, -0.65], [0.035, 0.75, 1.8], blue)
  for (const z of [-1.3, -0.65, 0]) {
    box([-2.89, 1.6, z], [0.03, 0.76, 0.035], paper)
  }
  box([1.765, 0.9, -0.8], [0.035, 1.8, 0.78], blue)
  box([1.8, 0.93, -0.53], [0.045, 0.08, 0.09], roof)
  box([-0.55, 0.14, 1.2], [4.8, 0.28, 0.8], blue)
  for (const x of [-1.65, 0.45]) {
    box([x, 1.12, 0.92], [1.46, 1.88, 0.08], roof)
    box([x, 1.15, 0.98], [1.24, 1.67, 0.05], blue)
    for (let y = 0.46; y < 1.95; y += 0.2) {
      box([x, y, 1.015], [1.23, 0.018, 0.018], roof)
    }
    box([x, 2.24, 0.97], [0.6, 0.18, 0.07], paper)
    box([x, 2.45, 1.09], [1.72, 0.08, 0.48], roof)
    for (const dx of [-0.83, 0.83]) {
      box([x + dx, 0.47, 1.39], [0.085, 0.38, 0.085], roof)
    }
  }
  // Pallets are slatted and every stacked carton has a small paper tape seam.
  const pallets: [number, number][] = [
    [-2.15, 2.1],
    [-0.9, 2.13],
  ]
  for (const [x, z] of pallets) {
    for (const dx of [-0.37, 0, 0.37]) {
      box([x + dx, 0.08, z], [0.1, 0.16, 0.76], roof)
    }
    box([x, 0.19, z], [0.96, 0.08, 0.83], paper)
    box([x, 0.56, z], [0.81, 0.66, 0.7], blue)
    box([x, 0.9, z], [0.13, 0.025, 0.71], paper)
    box([x, 0.6, z + 0.36], [0.13, 0.6, 0.025], paper)
  }
  // The compact delivery van rests on four dark, square-profile tyres.
  for (const x of [2.05, 3.15]) {
    for (const z of [0.55, 1.92]) {
      box([x, 0.26, z], [0.22, 0.4, 0.38], roof)
      box([x + (x < 2.5 ? -0.12 : 0.12), 0.26, z], [0.025, 0.19, 0.2], paper)
    }
  }
  box([2.6, 0.85, 0.83], [1.23, 1.05, 1.28], blue)
  box([2.6, 0.66, 1.81], [1.23, 0.67, 0.7], blue)
  box([2.6, 1.14, 1.67], [1.2, 0.3, 0.72], paper)
  box([2.6, 1.14, 2.04], [0.94, 0.22, 0.025], roof)
  box([3.225, 1.14, 1.65], [0.025, 0.22, 0.5], roof)
  box([1.975, 1.14, 1.65], [0.025, 0.22, 0.5], roof)
  box([2.6, 0.42, 2.19], [1.29, 0.14, 0.1], paper)
  for (const x of [2.2, 3]) {
    box([x, 0.68, 2.17], [0.2, 0.14, 0.045], paper)
  }
  return parts
}

const parts = warehouseParts()

// The lightweight SVG uses the same solid parts as WebGL, with painter's order
// for this fixed isometric view. It requires no Three.js or graphics context.
function fallbackFaces() {
  const faces: { points: string; fill: string; depth: number }[] = []
  const project = ([x, y, z]: Point) =>
    `${300 + (x - z) * 37.24},${275 + (x + z) * 21.5 - y * 43}`
  for (const {
    at: [x, y, z],
    size: [w, h, d],
    tones,
  } of parts) {
    const a = x - w / 2
    const b = x + w / 2
    const c = y - h / 2
    const e = y + h / 2
    const f = z - d / 2
    const g = z + d / 2
    const surfaces: { vertices: Point[]; fill: string }[] = [
      {
        vertices: [
          [a, e, f],
          [a, e, g],
          [b, e, g],
          [b, e, f],
        ],
        fill: tones[0],
      },
      {
        vertices: [
          [a, c, g],
          [b, c, g],
          [b, e, g],
          [a, e, g],
        ],
        fill: tones[1],
      },
      {
        vertices: [
          [b, c, f],
          [b, e, f],
          [b, e, g],
          [b, c, g],
        ],
        fill: tones[2],
      },
    ]
    for (const { vertices, fill } of surfaces) {
      faces.push({
        points: vertices.map(project).join(' '),
        fill,
        depth: vertices.reduce((sum, [x, y, z]) => sum + x + y + z, 0) / 4,
      })
    }
  }
  return faces.sort((a, b) => a.depth - b.depth)
}

const faces = fallbackFaces()

export function DistributionFigure() {
  const captionId = useId()
  const statusId = useId()
  const host = useRef<HTMLDivElement>(null)
  const rotate = useRef<(() => void) | null>(null)
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<FigureState>('idle')
  const [sideView, setSideView] = useState(false)

  useEffect(() => {
    if (request === 0 || !host.current) return
    const container = host.current
    let stopped = false
    let displayed = false
    let renderer: Three.WebGLRenderer | undefined
    let observer: ResizeObserver | undefined
    const geometries = new Set<Three.BufferGeometry>()
    const materials = new Set<Three.Material>()

    const release = () => {
      stopped = true
      rotate.current = null
      observer?.disconnect()
      observer = undefined
      renderer?.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost,
      )
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      geometries.clear()
      materials.clear()
      if (renderer) {
        renderer.domElement.remove()
        renderer.dispose()
        renderer.forceContextLoss()
        renderer = undefined
      }
    }
    const fail = () => {
      if (stopped) return
      release()
      setState('error')
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      fail()
    }

    async function load() {
      try {
        // Only the explicit explore/retry button can activate this effect.
        const THREE = await import('three')
        if (stopped) return
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
        renderer.setClearColor(0x000000, 0)
        renderer.domElement.setAttribute('aria-hidden', 'true')
        renderer.domElement.style.cssText =
          'display:block;width:100%;height:100%'
        renderer.domElement.addEventListener('webglcontextlost', onContextLost)
        container.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-5, 5, 4.2, -4.2, 0.1, 50)
        camera.position.set(9, 7.5, 9)
        camera.lookAt(0, 0.8, 0)
        const group = new THREE.Group()
        scene.add(group)
        const outlines = new THREE.LineBasicMaterial({ color: ink })
        materials.add(outlines)
        const paletteMaterials = new Map<Tones, Three.MeshBasicMaterial[]>()
        for (const { at, size, tones } of parts) {
          let palette = paletteMaterials.get(tones)
          if (!palette) {
            const toneMaterials = tones.map((color) => {
              const material = new THREE.MeshBasicMaterial({
                color,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
              })
              materials.add(material)
              return material
            })
            palette = [
              toneMaterials[2]!,
              toneMaterials[1]!,
              toneMaterials[0]!,
              toneMaterials[2]!,
              toneMaterials[1]!,
              toneMaterials[2]!,
            ]
            paletteMaterials.set(tones, palette)
          }
          const geometry = new THREE.BoxGeometry(...size)
          geometries.add(geometry)
          const mesh = new THREE.Mesh(geometry, palette)
          mesh.position.set(...at)
          group.add(mesh)
          const edges = new THREE.EdgesGeometry(geometry)
          geometries.add(edges)
          const line = new THREE.LineSegments(edges, outlines)
          line.position.set(...at)
          group.add(line)
        }

        const draw = () => {
          if (stopped || !renderer) return
          try {
            const { width, height } = container.getBoundingClientRect()
            if (width <= 0 || height <= 0) return
            const aspect = width / height
            const halfHeight = Math.max(4.4, 5.2 / aspect)
            camera.left = -halfHeight * aspect
            camera.right = halfHeight * aspect
            camera.top = halfHeight
            camera.bottom = -halfHeight
            camera.updateProjectionMatrix()
            renderer.setSize(width, height, false)
            renderer.render(scene, camera)
            if (stopped) return
            if (!displayed) {
              displayed = true
              setState('ready')
            }
          } catch {
            fail()
          }
        }
        let alternate = false
        // Discrete views, with no tween, transition or RAF, also honor reduced motion.
        rotate.current = () => {
          alternate = !alternate
          camera.position.set(alternate ? -9 : 9, 7.5, 9)
          camera.lookAt(0, 0.8, 0)
          setSideView(alternate)
          draw()
        }
        observer = new ResizeObserver(draw)
        observer.observe(container)
        draw()
      } catch {
        fail()
      }
    }
    void load()
    return release
  }, [request])

  const explore = () => {
    setState('loading')
    setSideView(false)
    setRequest((previous) => previous + 1)
  }

  return (
    <figure
      className="distribution-figure"
      aria-labelledby={captionId}
      data-state={state}
    >
      <div
        className="distribution-figure__viewport"
        role="img"
        aria-label={t(
          'Nhà kho, cửa xuất hàng, kiện hàng trên pallet và xe giao hàng. Mô hình minh họa, không phải dữ liệu tồn kho.',
        )}
      >
        <svg
          className="distribution-figure__fallback"
          viewBox="0 0 600 480"
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            display: state === 'ready' ? 'none' : 'block',
          }}
        >
          <path
            d="M75 311 283 192 548 335 342 454Z"
            fill="#91afd2"
            opacity=".18"
          />
          <g stroke={ink} strokeWidth="1.15" strokeLinejoin="round">
            {faces.map((face, index) => (
              <polygon key={index} points={face.points} fill={face.fill} />
            ))}
          </g>
          <g fill={ink} opacity=".3">
            <circle cx="76" cy="220" r="2" />
            <circle cx="516" cy="184" r="2" />
            <circle cx="490" cy="211" r="1.5" />
          </g>
        </svg>
        <div
          ref={host}
          className="distribution-figure__canvas"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            visibility: state === 'ready' ? 'visible' : 'hidden',
            pointerEvents: 'none',
          }}
        />
      </div>
      <figcaption id={captionId} className="distribution-figure__caption">
        {t('Minh họa mạng lưới phân phối')}
      </figcaption>
      <div className="distribution-figure__controls">
        <button
          type="button"
          className="distribution-figure__button"
          onClick={state === 'ready' ? () => rotate.current?.() : explore}
          disabled={state === 'loading'}
          aria-describedby={statusId}
        >
          {state === 'ready'
            ? t('Đổi góc nhìn')
            : state === 'loading'
              ? t('Đang tải mô hình…')
              : state === 'error'
                ? t('Thử lại mô hình')
                : t('Khám phá mô hình')}
        </button>
        <span
          id={statusId}
          role="status"
          className="distribution-figure__status"
        >
          {state === 'error'
            ? t('Không thể hiển thị 3D. Hình minh họa tĩnh vẫn khả dụng.')
            : state === 'ready'
              ? sideView
                ? t('Góc nhìn: bên hông nhà kho.')
                : t('Góc nhìn: cửa xuất hàng.')
              : state === 'loading'
                ? t('Hình minh họa tĩnh được giữ lại trong khi tải.')
                : t('Mô hình khái niệm, không sử dụng dữ liệu vận hành.')}
        </span>
      </div>
    </figure>
  )
}

export default DistributionFigure
