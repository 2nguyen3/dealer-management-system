import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { id, message } from '../payment_receipts/contracts'
import { SourceStatement } from '../receivables/SourceStatement'

export function InventoryPage() {
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      setSelected(id(input))
      setError('')
    } catch (failure) {
      setError(message(failure))
    }
  }
  return (
    <div className="page-container">
      <h1 className="page-title">Tồn kho & Thẻ kho</h1>
      <p>
        Tra cứu từng mặt hàng, không cộng số lượng khác đơn vị. Chỉ gọi thẻ kho
        sau khi chọn mặt hàng.
      </p>
      <form onSubmit={submit} className="filter-bar filter-bar--row">
        <Input
          label="ID mặt hàng"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          required
        />
        <Button type="submit">Xem thẻ kho</Button>
      </form>
      {error && <Alert type="error">{error}</Alert>}
      {selected && (
        <SourceStatement
          key={selected}
          path={`/products/${selected}/inventory-entries`}
          title={`Thẻ kho mặt hàng #${selected}`}
          opening="openingStock"
          closing="closingStock"
        />
      )}
    </div>
  )
}
