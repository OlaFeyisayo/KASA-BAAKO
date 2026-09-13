export function formatAmount(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount)
  return Number.isFinite(num) ? `GHS ${num.toFixed(2)}` : 'Not provided'
}
