import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { useState } from 'react'
import { renderWithApp } from '@/test/render'
import { addThousands, centsToRupees, RupeeInput, rupeesToCents } from './RupeeInput'

function Harness({ max }: { max?: number }) {
  const [value, setValue] = useState('')
  return (
    <>
      <RupeeInput aria-label="Amount" value={value} onChange={setValue} max={max} />
      <output data-testid="raw">{value}</output>
      <output data-testid="cents">{rupeesToCents(value)}</output>
    </>
  )
}

describe('money entry', () => {
  it('groups thousands for the eye while keeping the raw number underneath', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness />)
    const field = screen.getByLabelText('Amount')
    await user.type(field, '1234567.89')
    expect(field).toHaveValue('1,234,567.89')
    expect(screen.getByTestId('raw')).toHaveTextContent('1234567.89')
    // What the API receives is integer cents, never a float of rupees
    expect(screen.getByTestId('cents')).toHaveTextContent('123456789')
  })

  it('refuses anything that is not money', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness />)
    const field = screen.getByLabelText('Amount')
    await user.type(field, '12ab.3x4')
    expect(field).toHaveValue('12.34')
    await user.clear(field)
    // more than two decimals is not a rupee amount
    await user.type(field, '5.999')
    expect(field).toHaveValue('5.99')
  })

  it('flags an amount above the ceiling without blocking the typing', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness max={1000} />)
    const field = screen.getByLabelText('Amount')
    await user.type(field, '999')
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
    await user.type(field, '9')
    expect(field).toHaveValue('9,999')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('round-trips cents through the display and back', () => {
    for (const cents of [0, 1, 99, 100, 12345, 123456789]) {
      expect(rupeesToCents(centsToRupees(cents))).toBe(cents)
    }
    expect(addThousands('')).toBe('')
    expect(addThousands('100')).toBe('100')
    expect(addThousands('1000.5')).toBe('1,000.5')
  })

  it('reports an empty field as empty rather than as zero rupees typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithApp(<RupeeInput aria-label="Amount" value="250" onChange={onChange} />)
    await user.clear(screen.getByLabelText('Amount'))
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})
