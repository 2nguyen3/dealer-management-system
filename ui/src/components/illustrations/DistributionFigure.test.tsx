import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DistributionFigure } from './DistributionFigure'

const graphics = vi.hoisted(() => ({
  moduleLoads: 0,
  releaseImport: null as (() => void) | null,
  createRenderer: vi.fn(),
  render: vi.fn(),
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
  disposeRenderer: vi.fn(),
  loseContext: vi.fn(),
  disposeGeometry: vi.fn(),
  disposeMaterial: vi.fn(),
  disconnect: vi.fn(),
  resize: null as (() => void) | null,
  width: 420,
  height: 350,
}))

vi.mock('three', async (importOriginal) => {
  graphics.moduleLoads += 1
  const actual = await importOriginal<typeof import('three')>()
  await new Promise<void>((resolve) => {
    graphics.releaseImport = resolve
  })
  vi.spyOn(actual.BufferGeometry.prototype, 'dispose').mockImplementation(
    graphics.disposeGeometry,
  )
  vi.spyOn(actual.Material.prototype, 'dispose').mockImplementation(
    graphics.disposeMaterial,
  )
  class MockRenderer {
    domElement = document.createElement('canvas')
    constructor() {
      graphics.createRenderer()
    }
    setPixelRatio = graphics.setPixelRatio
    setClearColor = vi.fn()
    setSize = graphics.setSize
    render = graphics.render
    dispose = graphics.disposeRenderer
    forceContextLoss = graphics.loseContext
  }
  return { ...actual, WebGLRenderer: MockRenderer }
})

describe('DistributionFigure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    graphics.createRenderer.mockReset()
    graphics.render.mockReset()
    graphics.width = 420
    graphics.height = 350
    graphics.resize = null
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 0, graphics.width, graphics.height),
    )
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          graphics.resize = callback
        }
        observe = vi.fn()
        disconnect = graphics.disconnect
      },
    )
  })

  afterEach(() => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockRestore()
    vi.unstubAllGlobals()
  })

  it('keeps a useful fallback without loading Three and cancels a stale import on unmount', async () => {
    const { container, unmount } = render(<DistributionFigure />)
    expect(graphics.moduleLoads).toBe(0)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'không phải dữ liệu tồn kho',
    )
    expect(container.querySelectorAll('polygon').length).toBeGreaterThan(100)
    expect(container.querySelector('canvas')).toBeNull()
    const button = screen.getByRole('button', { name: 'Khám phá mô hình' })
    fireEvent.click(button)
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('trong khi tải')
    await waitFor(() => expect(graphics.releaseImport).not.toBeNull())
    unmount()
    await act(async () => graphics.releaseImport?.())
    expect(graphics.createRenderer).not.toHaveBeenCalled()
    expect(graphics.render).not.toHaveBeenCalled()
  })

  it('renders only on demand, switches views, resizes, and disposes GPU resources once', async () => {
    const frame = vi.spyOn(window, 'requestAnimationFrame')
    const fetch = vi.spyOn(globalThis, 'fetch')
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    const { container, unmount } = render(
      <StrictMode>
        <DistributionFigure />
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Khám phá mô hình' }))
    const button = await screen.findByRole('button', { name: 'Đổi góc nhìn' })
    expect(graphics.createRenderer).toHaveBeenCalledTimes(1)
    expect(graphics.setPixelRatio.mock.calls[0]?.[0]).toBeLessThanOrEqual(1.75)
    expect(graphics.render).toHaveBeenCalledTimes(1)
    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
    fireEvent.click(button)
    expect(screen.getByRole('status').textContent).toContain('bên hông')
    expect(graphics.render).toHaveBeenCalledTimes(2)
    fireEvent.click(button)
    expect(screen.getByRole('status').textContent).toContain('cửa xuất hàng')
    expect(graphics.render).toHaveBeenCalledTimes(3)
    graphics.width = 300
    graphics.height = 250
    act(() => graphics.resize?.())
    expect(graphics.setSize).toHaveBeenLastCalledWith(300, 250, false)
    expect(graphics.render).toHaveBeenCalledTimes(4)
    expect(frame).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    const lateResize = graphics.resize
    unmount()
    expect(graphics.disconnect).toHaveBeenCalledTimes(1)
    expect(graphics.disposeRenderer).toHaveBeenCalledTimes(1)
    expect(graphics.loseContext).toHaveBeenCalledTimes(1)
    expect(graphics.disposeGeometry.mock.calls.length).toBeGreaterThan(100)
    expect(graphics.disposeMaterial).toHaveBeenCalledTimes(10)
    act(() => lateResize?.())
    expect(graphics.render).toHaveBeenCalledTimes(4)
    frame.mockRestore()
    fetch.mockRestore()
  })

  it('waits for a measurable viewport and preserves its fallback until a successful render', async () => {
    graphics.width = 0
    graphics.height = 0
    const { container } = render(<DistributionFigure />)
    fireEvent.click(screen.getByRole('button', { name: 'Khám phá mô hình' }))
    await waitFor(() => expect(graphics.createRenderer).toHaveBeenCalledOnce())
    expect(graphics.render).not.toHaveBeenCalled()
    expect(container.querySelector<SVGElement>('svg')?.style.display).toBe(
      'block',
    )
    graphics.width = 240
    graphics.height = 200
    act(() => graphics.resize?.())
    expect(screen.getByRole('button', { name: 'Đổi góc nhìn' })).toBeDefined()
    expect(graphics.render).toHaveBeenCalledTimes(1)
  })

  it('retains the fallback on WebGL failure and allows an explicit retry', async () => {
    graphics.createRenderer.mockImplementationOnce(() => {
      throw new Error('WebGL unavailable')
    })
    const { container } = render(<DistributionFigure />)
    fireEvent.click(screen.getByRole('button', { name: 'Khám phá mô hình' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Thử lại mô hình' }),
    )
    await screen.findByRole('button', { name: 'Đổi góc nhìn' })
    expect(graphics.createRenderer).toHaveBeenCalledTimes(2)
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
  })

  it('releases partial initialization after a render failure', async () => {
    graphics.render.mockImplementationOnce(() => {
      throw new Error('Driver render failure')
    })
    const { container } = render(<DistributionFigure />)
    fireEvent.click(screen.getByRole('button', { name: 'Khám phá mô hình' }))
    await screen.findByRole('button', { name: 'Thử lại mô hình' })
    expect(container.querySelector('canvas')).toBeNull()
    expect(graphics.disposeRenderer).toHaveBeenCalledOnce()
    expect(graphics.disposeGeometry.mock.calls.length).toBeGreaterThan(100)
    expect(graphics.disconnect).toHaveBeenCalledOnce()
    expect(container.querySelector<SVGElement>('svg')?.style.display).toBe(
      'block',
    )
  })

  it('handles context loss accessibly and ignores stale context/resize events after cleanup', async () => {
    const { container, unmount } = render(<DistributionFigure />)
    fireEvent.click(screen.getByRole('button', { name: 'Khám phá mô hình' }))
    await screen.findByRole('button', { name: 'Đổi góc nhìn' })
    const canvas = container.querySelector('canvas')!
    const lost = new Event('webglcontextlost', { cancelable: true })
    fireEvent(canvas, lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(screen.getByRole('status').textContent).toContain(
      'tĩnh vẫn khả dụng',
    )
    expect(container.querySelector('canvas')).toBeNull()
    expect(graphics.disposeRenderer).toHaveBeenCalledTimes(1)
    const lateResize = graphics.resize
    fireEvent(canvas, new Event('webglcontextlost'))
    act(() => lateResize?.())
    expect(graphics.render).toHaveBeenCalledTimes(1)
    unmount()
    expect(graphics.disposeRenderer).toHaveBeenCalledTimes(1)
    expect(graphics.disconnect).toHaveBeenCalledTimes(1)
  })
})
