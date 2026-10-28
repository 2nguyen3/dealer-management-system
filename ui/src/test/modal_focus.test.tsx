import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'

function TestModalForm() {
  const [isOpen, setIsOpen] = useState(true)
  const [text, setText] = useState('')
  const [number, setNumber] = useState('')

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Test Modal">
      <div>
        <Input
          label="Tên đại lý"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Input
          label="Số lượng"
          type="number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </div>
    </Modal>
  )
}

describe('Modal Focus Retention', () => {
  it('retains input focus across multiple keystrokes without losing focus to the dialog', () => {
    render(<TestModalForm />)

    const textInput = screen.getByLabelText('Tên đại lý', {
      selector: 'input',
    }) as HTMLInputElement
    textInput.focus()
    expect(document.activeElement).toBe(textInput)

    // Simulate typing "Agentra" character by character
    fireEvent.change(textInput, { target: { value: 'A' } })
    expect(document.activeElement).toBe(textInput)
    expect(textInput.value).toBe('A')

    fireEvent.change(textInput, { target: { value: 'Ag' } })
    expect(document.activeElement).toBe(textInput)
    expect(textInput.value).toBe('Ag')

    fireEvent.change(textInput, { target: { value: 'Agentra' } })
    expect(document.activeElement).toBe(textInput)
    expect(textInput.value).toBe('Agentra')

    // Test number input
    const numberInput = screen.getByLabelText('Số lượng', {
      selector: 'input',
    }) as HTMLInputElement
    numberInput.focus()
    expect(document.activeElement).toBe(numberInput)

    fireEvent.change(numberInput, { target: { value: '1' } })
    expect(document.activeElement).toBe(numberInput)

    fireEvent.change(numberInput, { target: { value: '10' } })
    expect(document.activeElement).toBe(numberInput)

    fireEvent.change(numberInput, { target: { value: '100' } })
    expect(document.activeElement).toBe(numberInput)
    expect(numberInput.value).toBe('100')
  })
})
