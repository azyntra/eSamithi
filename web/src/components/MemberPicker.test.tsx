import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { renderWithApp } from '@/test/render'
import { api, http, HttpResponse, mockApi } from '@/test/msw'
import { MemberPicker } from './MemberPicker'

// The fourth row is shaped like production: a member entered from paper with
// nothing but a society ID. MySQL sorts NULL first, so in a real society these
// are the first rows the picker shows, and the first the treasurer types past.
const MEMBERS = [
  { id: 1, society_id: 'TEST-001', full_name: 'Nimal Perera', nic: '901234567V' },
  { id: 2, society_id: 'TEST-002', full_name: 'Kamala Silva', nic: '885544332V' },
  { id: 3, society_id: 'TEST-003', full_name: 'Nimal Fernando', nic: '921111222V' },
  { id: 207, society_id: '207', full_name: null, nic: null }
]

mockApi(http.get(api('/members/slim'), () => HttpResponse.json(MEMBERS)))

function Harness({ exclude = [] as number[] }) {
  const [value, setValue] = useState<number | null>(null)
  return (
    <>
      <MemberPicker value={value} onChange={setValue} exclude={exclude} />
      <output data-testid="picked">{value ?? 'none'}</output>
    </>
  )
}

describe('a member with no name on record', () => {
  it('does not crash the picker on the first keystroke and is still found by ID', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness />)
    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Kamala Silva')).toBeInTheDocument())
    expect(screen.getByText('Unnamed member')).toBeInTheDocument()

    const search = screen.getByPlaceholderText(/search/i)
    await user.type(search, 'a')
    await waitFor(() => expect(screen.getByText('Kamala Silva')).toBeInTheDocument())

    await user.clear(search)
    await user.type(search, '207')
    await waitFor(() => expect(screen.getByText('Unnamed member')).toBeInTheDocument())
    expect(screen.queryByText('Kamala Silva')).not.toBeInTheDocument()

    await user.click(screen.getByText('Unnamed member'))
    expect(screen.getByTestId('picked')).toHaveTextContent('207')
  })
})

describe('finding a member', () => {
  it('finds the same person by name, by member ID and by NIC', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness />)
    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Kamala Silva')).toBeInTheDocument())

    const search = screen.getByPlaceholderText(/search/i)
    for (const term of ['Kamala', 'TEST-002', '885544332V']) {
      await user.clear(search)
      await user.type(search, term)
      await waitFor(() => expect(screen.getByText('Kamala Silva')).toBeInTheDocument())
      expect(screen.queryByText('Nimal Fernando')).not.toBeInTheDocument()
    }
  })

  it('shows the ID and NIC so two people with the same first name can be told apart', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness />)
    await user.click(screen.getByRole('combobox'))
    const search = screen.getByPlaceholderText(/search/i)
    await user.type(search, 'Nimal')
    await waitFor(() => expect(screen.getByText('Nimal Perera')).toBeInTheDocument())
    expect(screen.getByText('Nimal Fernando')).toBeInTheDocument()
    expect(screen.getByText('TEST-001 · 901234567V')).toBeInTheDocument()
    expect(screen.getByText('TEST-003 · 921111222V')).toBeInTheDocument()
  })

  it('hands back the id of whoever is chosen', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness />)
    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Kamala Silva')).toBeInTheDocument())
    await user.click(screen.getByText('Kamala Silva'))
    expect(screen.getByTestId('picked')).toHaveTextContent('2')
  })

  it('never offers someone who is already in the form', async () => {
    const user = userEvent.setup()
    renderWithApp(<Harness exclude={[2]} />)
    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Nimal Perera')).toBeInTheDocument())
    expect(screen.queryByText('Kamala Silva')).not.toBeInTheDocument()
  })
})
