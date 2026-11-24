import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { renderWithApp } from '@/test/render'
import { api, http, HttpResponse, mockApi } from '@/test/msw'
import type { SystemUser } from '../api'
import { EditUserDialog } from './UserDialogs'

// Society officers (docs/MEETING-MINUTES-REQUIREMENTS.md §3): a Secretary needs
// a linked member, and taking the post from the current Secretary asks first.

const MEMBERS = [
  { id: 11, society_id: 'M-0123', full_name: 'Kamal Perera', nic: '701234567V' },
  { id: 12, society_id: 'M-0241', full_name: 'Sunil Silva', nic: '751234567V' }
]

const SUNIL: SystemUser = {
  id: 7, username: 'sunil', full_name: 'Sunil Silva', role: 'viewer', is_active: 1,
  society_position: null, member_id: null, member_name: null, member_society_id: null, member_app_ready: null
}

const patches: Array<Record<string, unknown>> = []

mockApi(
  // No session in a component test: the client's silent refresh just fails
  http.post(api('/auth/refresh'), () => HttpResponse.json({ error: 'No session' }, { status: 401 })),
  http.get(api('/members/slim'), () => HttpResponse.json(MEMBERS)),
  http.patch(api('/users/7'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    patches.push(body)
    if (body.society_position === 'secretary' && !body.replace_secretary) {
      return HttpResponse.json(
        { error: 'Kamal Perera is the Secretary', code: 'SECRETARY_TAKEN', current: { user_id: 3, full_name: 'Kamal Perera', username: 'kamal', member_name: 'Kamal Perera' } },
        { status: 409 }
      )
    }
    return HttpResponse.json({ ...SUNIL, society_position: 'secretary', member_id: 12 })
  })
)

describe('making someone the Secretary', () => {
  it('needs a linked member, then confirms the handover by name', async () => {
    patches.length = 0
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderWithApp(<EditUserDialog user={SUNIL} isSelf={false} onOpenChange={onOpenChange} />)

    await user.selectOptions(screen.getByLabelText('Society Position'), 'secretary')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the member account this Secretary uses')
    expect(patches).toHaveLength(0)

    await user.click(screen.getByRole('combobox', { name: /Linked Member/ }))
    await user.click(await screen.findByText('Sunil Silva', { selector: '[cmdk-item] *, [cmdk-item]' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Make Sunil Silva the Secretary?')).toBeInTheDocument()
    expect(screen.getByText(/Kamal Perera will stop being Secretary/)).toBeInTheDocument()
    expect(patches[0]).toEqual({ society_position: 'secretary', member_id: 12 })

    await user.click(screen.getByRole('button', { name: 'Make Sunil Silva Secretary' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(patches[1]).toEqual({ society_position: 'secretary', member_id: 12, replace_secretary: true })
  })

  it('does not let an administrator disable their own account', () => {
    renderWithApp(<EditUserDialog user={{ ...SUNIL, role: 'admin' }} isSelf onOpenChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /Active/ })).toBeDisabled()
    expect(screen.getByText('You cannot disable your own account.')).toBeInTheDocument()
  })
})
