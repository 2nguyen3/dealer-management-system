import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Mở chi tiết</Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Chi tiết">
        <Input label="Mã chứng từ" id="document-code" required />
      </Modal>
    </>
  )
}

describe('shadcn application adapters', () => {
  it('keeps loading actions disabled', () => {
    render(<Button isLoading>Lưu</Button>)
    const button = screen.getByRole('button', { name: 'Lưu' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('closes the Radix dialog on Escape and preserves labeled fields', async () => {
    render(<DialogHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở chi tiết' }))

    expect(screen.getByRole('dialog', { name: 'Chi tiết' })).toBeDefined()
    expect(screen.getByLabelText(/^Mã chứng từ/)).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
