import { describe, test } from '@e2e-dev/web'
import { expect } from 'e2e'

// Without Google sign-in the server knows a single family, so the steps share its state in order.
describe('a child’s first day', { serial: true }, () => {
  test('names the child and opens the garden', async ({ app, screen }) => {
    await app.open('/')
    await screen.getByLabel('Prénom').fill('Lina')
    await screen.getByRole('button', 'Ouvrir mon jardin').tap()
    await expect(screen.getByRole('heading', 'Coucou Lina ♡')).toBeVisible()
    await expect(screen.getByRole('button', 'Arroser mon jardin')).toBeVisible()
  })

  test('waters the garden with a practice session', async ({ agent, screen }) => {
    await screen.getByRole('button', 'Arroser mon jardin').tap()
    await agent.act('answer every question of the session correctly until it ends')
    await agent.assert('the session is over and the child is congratulated')
    await agent.act('go back to the "Aujourd’hui" screen')
    await expect(screen.getByRole('link', 'Aujourd’hui')).toBeVisible()
    await agent.assert('the week shows that the garden was watered today')
  })
})
