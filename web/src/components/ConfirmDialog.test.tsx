import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { renderWithApp } from '@/test/render'
import { ConfirmDialog } from './ConfirmDialog'

describe('the guard in front of a destructive action', () => {
  it('keeps the button dead until the exact words are typed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithApp(
      <ConfirmDialog open onOpenChange={() => {}} title="Delete member" typeToConfirm="Nimal Perera" confirmLabel="Delete member" danger onConfirm={onConfirm} />
    )

    const confirm = screen.getByRole('button', { name: 'Delete member' })
    expect(confirm).toBeDisabled()

    const field = screen.getByRole('textbox')
    await user.type(field, 'Nimal')
    expect(confirm).toBeDisabled()

    // A near miss is still a miss: this is the last thing between a click and
    // a member's record being gone.
    await user.clear(field)
    await user.type(field, 'nimal perera')
    expect(confirm).toBeDisabled()

    await user.clear(field)
    await user.type(field, 'Nimal Perera')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('ignores stray whitespace around an otherwise exact match', async () => {
    const user = userEvent.setup()
    renderWithApp(<ConfirmDialog open onOpenChange={() => {}} title="Delete wallet" typeToConfirm="Petty Cash" confirmLabel="Delete wallet" onConfirm={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), '  Petty Cash  ')
    expect(screen.getByRole('button', { name: 'Delete wallet' })).toBeEnabled()
  })

  it('confirms straight away when nothing has to be typed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithApp(<ConfirmDialog open onOpenChange={() => {}} title="Void this receipt" confirmLabel="Void" onConfirm={onConfirm} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Void' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cannot be confirmed twice while the first one is still running', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithApp(<ConfirmDialog open onOpenChange={() => {}} title="Delete loan" confirmLabel="Delete" busy onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: /delete/i })
    expect(confirm).toBeDisabled()
    await user.click(confirm).catch(() => undefined)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
