export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function Spinner({ size = 'md', label = 'Đang tải...' }: SpinnerProps) {
  return (
    <div
      className={`spinner-container spinner-container--${size}`}
      role="status"
    >
      <div className={`spinner spinner--${size}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
