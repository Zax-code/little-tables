import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { Bell } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button, IconButton } from './button.js'
import { Chip, SegmentedControl, Switch, TextField } from './controls.js'
import { Avatar, Badge, EmptyState, ProgressBar, ProgressRing, WeekStrip } from './display.js'
import { IconTile, ListGroup, ListRow } from './list.js'
import {
  AnswerTiles,
  CharacterDock,
  FractionText,
  NumberPad,
  PinPad,
  type PadKey,
} from './practice.js'
import { NavigationBar, Screen } from './structure.js'

afterEach(cleanup)

/** Fails with axe's own message when the rendered markup breaks an accessibility rule. */
const expectAccessible = async (element: ReactElement): Promise<void> => {
  const { container } = render(element)
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  expect(results.violations.map(({ help, id }) => `${id}: ${help}`)).toEqual([])
}

describe('accessibility', () => {
  it.each<[string, ReactElement]>([
    [
      'buttons',
      <>
        <Button>Arroser mon jardin</Button>
        <IconButton label="Pause">II</IconButton>
      </>,
    ],
    [
      'grouped list',
      <ListGroup footer="Un petit coucou seulement si besoin." title="Rappels">
        <ListRow
          trailing="chevron"
          leading={
            <IconTile>
              <Bell />
            </IconTile>
          }
          onClick={() => undefined}
          title="Rappels"
          detail="3 actifs"
        />
        <ListRow accessory={<Switch aria-label="Son" />} title="Son" />
      </ListGroup>,
    ],
    [
      'segmented control',
      <SegmentedControl
        label="Apparence"
        onChange={() => undefined}
        options={[
          { label: 'Clair', value: 'light' },
          { label: 'Sombre', value: 'dark' },
        ]}
        value="light"
      />,
    ],
    ['text field', <TextField counter="3/40" defaultValue="Léa" label="Prénom" />],
    [
      'progress',
      <>
        <ProgressBar label="Arrosages" segments={3} value={2} />
        <ProgressRing label="Séance" value={0.6}>
          3/5
        </ProgressRing>
      </>,
    ],
    [
      'week',
      <WeekStrip
        days={['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => ({
          label,
          practiced: index < 2,
          today: index === 4,
        }))}
        status="Encore 1 jour"
        title="Ma semaine"
      />,
    ],
    [
      'empty state',
      <EmptyState
        action={<Button>Réessayer</Button>}
        description="Ton jardin marche même sans réseau."
        title="Pas de connexion"
      />,
    ],
    [
      'avatar and badge',
      <>
        <Avatar alt="Léa" src="data:," />
        <Badge tone="leaf">+1 arrosage</Badge>
        <Chip>× 7</Chip>
      </>,
    ],
    ['number pad', <NumberPad onKey={() => undefined} />],
    ['pin pad', <PinPad onKey={() => undefined} value="12" />],
    [
      'answer tiles',
      <AnswerTiles
        label="Réponses"
        onPick={() => undefined}
        render={(value) => value}
        values={[54, 56, 48, 63]}
      />,
    ],
    ['fraction', <FractionText denominator={4} numerator={3} />],
    [
      'screen and navigation',
      <Screen
        top={<NavigationBar back={{ label: 'Parents', onBack: () => undefined }} title="Léa" />}
      >
        <p>Contenu</p>
      </Screen>,
    ],
  ])('%s has no violations', async (_name, element) => {
    await expectAccessible(element)
  })
})

describe('NumberPad', () => {
  it('reports digits, erase and submit', async () => {
    const keys: PadKey[] = []
    render(<NumberPad onKey={(key) => keys.push(key)} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'Effacer' }))
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    expect(keys).toEqual(['5', 'erase', 'submit'])
  })

  it('can block submitting an empty answer', () => {
    render(<NumberPad onKey={() => undefined} submitDisabled />)
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled()
  })
})

describe('PinPad', () => {
  it('shows how many digits are typed', () => {
    render(<PinPad onKey={() => undefined} value="12" />)
    expect(screen.getByRole('status')).toHaveAccessibleName('2 chiffres sur 4')
  })
})

describe('AnswerTiles', () => {
  it('picks a value and shows its state', async () => {
    const onPick = vi.fn()
    render(
      <AnswerTiles
        label="Réponses"
        onPick={onPick}
        render={(value) => value}
        stateOf={(value) => (value === 56 ? 'correct' : 'dimmed')}
        values={[54, 56]}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: '56' }))
    expect(onPick).toHaveBeenCalledWith(56, 1)
    expect(screen.getByRole('button', { name: '56' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('SegmentedControl', () => {
  it('changes value', async () => {
    function Example() {
      const [value, setValue] = useState<'dark' | 'light'>('light')
      return (
        <>
          <SegmentedControl
            label="Apparence"
            onChange={setValue}
            options={[
              { label: 'Clair', value: 'light' },
              { label: 'Sombre', value: 'dark' },
            ]}
            value={value}
          />
          <output>{value}</output>
        </>
      )
    }
    render(<Example />)
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Sombre' }))
    expect(screen.getByRole('status')).toHaveTextContent('dark')
  })
})

describe('Switch', () => {
  it('toggles', async () => {
    const onChange = vi.fn()
    render(<Switch aria-label="Son" onCheckedChange={onChange} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Son' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('FractionText', () => {
  it('reads as words', () => {
    render(<FractionText denominator={2} numerator={1} whole={1} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('1 et 1 sur 2')
  })
})

describe('CharacterDock', () => {
  const poses = { correct: '/correct.png', encourage: '/encourage.png', idle: '/idle.png' }

  it('shows the pose and the bubble', () => {
    render(
      <CharacterDock
        bubble={<strong>Oui ! 56 ♡</strong>}
        label="Miffy est contente"
        pose="correct"
        poses={poses}
      />,
    )
    expect(screen.getByRole('img', { name: 'Miffy est contente' })).toHaveAttribute(
      'src',
      '/correct.png',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Oui ! 56 ♡')
  })

  it('has no bubble while idle', () => {
    render(<CharacterDock label="Miffy attend" pose="idle" poses={poses} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
