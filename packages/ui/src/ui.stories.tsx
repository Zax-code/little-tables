import type { Story } from '@ladle/react'
import { Bell, Droplets, Languages, LockKeyhole, Pause, SunMoon, Volume2 } from 'lucide-react'
import { useState } from 'react'

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
  type CharacterPose,
} from './practice.js'
import { Alert, NavigationBar, Sheet } from './structure.js'

const week = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const fractions: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [1, 4],
  [3, 8],
  [4, 3],
]
const poses = {
  correct: '/art/miffy-practice-correct.png',
  encourage: '/art/miffy-practice-encourage.png',
  idle: '/art/miffy-practice-idle.png',
}

export const Buttons: Story = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Button icon={<Droplets aria-hidden className="size-5.5" />} size="lg" width="full">
      Arroser mon jardin
    </Button>
    <Button variant="tinted" width="full">
      Autres séances
    </Button>
    <Button variant="gray" width="full">
      Annuler
    </Button>
    <Button variant="destructive" width="full">
      Retirer Zoé
    </Button>
    <div className="flex gap-3">
      <IconButton label="Pause">
        <Pause aria-hidden className="size-5" />
      </IconButton>
      <IconButton label="Espace parents">
        <LockKeyhole aria-hidden className="size-5" />
      </IconButton>
    </div>
  </div>
)

export const ParentSettings: Story = () => {
  const [sound, setSound] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system')
  return (
    <div className="-m-4 flex min-h-dvh flex-col gap-5 bg-surface-2 p-4">
      <NavigationBar back={{ label: 'Parents', onBack: () => undefined }} title="Réglages" />
      <ListGroup
        footer="Un petit coucou seulement si la séance du jour n'est pas faite."
        title="Rappels quotidiens"
      >
        <ListRow
          trailing="chevron"
          detail="18:00"
          leading={<Avatar alt="" src="/art/avatar-miffy.png" />}
          onClick={() => undefined}
          title="Léa"
        />
        <ListRow
          trailing="chevron"
          detail="17:30"
          leading={<Avatar alt="" src="/art/avatar-fenna-fox.png" />}
          onClick={() => undefined}
          title="Zoé"
        />
        <ListRow
          trailing="chevron"
          detail="Désactivé"
          leading={<Avatar alt="" src="/art/avatar-malo-bear.png" />}
          onClick={() => undefined}
          title="Tom"
        />
      </ListGroup>
      <section className="flex flex-col gap-1.5">
        <h2 className="px-4 text-footnote font-extrabold uppercase tracking-wide text-label-2">
          Apparence
        </h2>
        <SegmentedControl
          label="Apparence"
          onChange={setTheme}
          options={[
            { label: 'Système', value: 'system' },
            { label: 'Clair', value: 'light' },
            { label: 'Sombre', value: 'dark' },
          ]}
          value={theme}
        />
      </section>
      <ListGroup>
        <ListRow
          trailing="chevron"
          detail="3 actifs"
          leading={
            <IconTile className="bg-danger">
              <Bell />
            </IconTile>
          }
          onClick={() => undefined}
          title="Rappels"
        />
        <ListRow
          trailing="chevron"
          detail="Système"
          leading={
            <IconTile className="bg-sky">
              <SunMoon />
            </IconTile>
          }
          onClick={() => undefined}
          title="Apparence"
        />
        <ListRow
          trailing="chevron"
          detail="Français"
          leading={
            <IconTile className="bg-leaf">
              <Languages />
            </IconTile>
          }
          onClick={() => undefined}
          title="Langue"
        />
        <ListRow
          accessory={<Switch aria-label="Son" checked={sound} onCheckedChange={setSound} />}
          leading={
            <IconTile className="bg-sun">
              <Volume2 />
            </IconTile>
          }
          title="Son"
        />
      </ListGroup>
      <ListGroup>
        <ListRow destructive onClick={() => undefined} title="Se déconnecter" />
      </ListGroup>
    </div>
  )
}

export const Controls: Story = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <TextField counter="3/40" defaultValue="Léa" label="Prénom" />
    <div className="flex gap-2">
      <Chip>× 2</Chip>
      <Chip selected>× 3</Chip>
      <Chip disabled>11 et 12</Chip>
    </div>
    <div className="flex items-center gap-3">
      <Badge tone="leaf">+1 arrosage</Badge>
      <Badge tone="sun">Pousse</Badge>
      <Badge>Propriétaire</Badge>
    </div>
  </div>
)

export const Progress: Story = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <ProgressBar label="Arrosages du lupin" segments={3} value={1} />
    <ProgressBar label="Table de 7" tone="sun" value={0.4} />
    <ProgressRing label="Séance en cours" value={0.6}>
      3/5
    </ProgressRing>
    <WeekStrip
      days={week.map((label, index) => ({ label, practiced: index < 2, today: index === 4 }))}
      status="Encore 1 jour"
      title="Ma semaine"
    />
  </div>
)

export const Practice: Story = () => {
  const [typed, setTyped] = useState('4')
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <p className="text-center text-exercise font-black tabular">6 × 7</p>
      <p className="mx-auto flex h-19 w-38 items-center justify-center rounded-[1.375rem] border-3 border-tint bg-surface text-[2.5rem] font-black">
        {typed === '' ? '?' : typed}
      </p>
      <NumberPad
        onKey={(key) =>
          setTyped((current) =>
            key === 'erase'
              ? current.slice(0, -1)
              : key === 'submit'
                ? ''
                : `${current}${key}`.slice(0, 5),
          )
        }
      />
    </div>
  )
}

export const Tiles: Story = () => (
  <div className="flex max-w-sm flex-col gap-6">
    <AnswerTiles
      label="Réponses"
      onPick={() => undefined}
      render={(value) => value}
      stateOf={(value) => (value === 56 ? 'correct' : 'dimmed')}
      values={[54, 56, 48, 63]}
    />
    <AnswerTiles
      label="Fractions"
      onPick={() => undefined}
      render={([numerator, denominator]) => (
        <FractionText className="text-[1.875rem]" denominator={denominator} numerator={numerator} />
      )}
      values={fractions}
    />
  </div>
)

export const CharacterOnThePanel: Story = () => {
  const [pose, setPose] = useState<CharacterPose>('idle')
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <SegmentedControl
        label="Pose"
        onChange={setPose}
        options={[
          { label: 'Attente', value: 'idle' },
          { label: 'Juste', value: 'correct' },
          { label: 'Erreur', value: 'encourage' },
        ]}
        value={pose}
      />
      <div className="-mx-4 mt-10 flex flex-col">
        <CharacterDock
          bubble={
            pose === 'correct' ? (
              <p className="flex flex-col">
                <strong className="text-title-3 font-black">Oui ! 56 ♡</strong>
                <span className="text-subhead font-bold text-label-2">7 × 8 = 56</span>
              </p>
            ) : pose === 'encourage' ? (
              <p className="flex flex-col">
                <strong className="text-title-3 font-black">Hmm… c'était 10</strong>
                <span className="text-subhead font-bold text-label-2">On regarde ensemble ?</span>
              </p>
            ) : undefined
          }
          label="Miffy"
          pose={pose}
          poses={poses}
        />
        <div
          className={
            pose === 'correct'
              ? 'rounded-t-[1.875rem] bg-leaf-soft p-4'
              : pose === 'encourage'
                ? 'rounded-t-[1.875rem] bg-sun-soft p-4'
                : 'rounded-t-[1.875rem] bg-surface-2 p-4'
          }
        >
          <AnswerTiles
            label="Réponses"
            onPick={() => undefined}
            render={(value) => value}
            values={[54, 56, 48, 63]}
          />
        </div>
      </div>
    </div>
  )
}

export const ParentCode: Story = () => {
  const [code, setCode] = useState('')
  return (
    <PinPad
      onKey={(key) =>
        setCode((current) =>
          key === 'erase' ? current.slice(0, -1) : `${current}${key}`.slice(0, 4),
        )
      }
      value={code}
    />
  )
}

export const Overlays: Story = () => {
  const [sheet, setSheet] = useState(false)
  const [alert, setAlert] = useState(false)
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <Button onClick={() => setSheet(true)} variant="tinted">
        Autres séances
      </Button>
      <Button onClick={() => setAlert(true)} variant="gray">
        Retirer Zoé
      </Button>
      <Sheet
        description="Choisis comment tu veux t'entraîner"
        onOpenChange={setSheet}
        open={sheet}
        title="Autres séances"
      >
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((table) => (
            <Chip key={table}>× {table}</Chip>
          ))}
        </div>
      </Sheet>
      <Alert
        cancelLabel="Annuler"
        confirmLabel="Retirer Zoé"
        description="Son jardin et ses progrès seront supprimés. Cette action est définitive."
        destructive
        onConfirm={() => setAlert(false)}
        onOpenChange={setAlert}
        open={alert}
        title="Retirer Zoé ?"
      />
    </div>
  )
}

export const Empty: Story = () => (
  <EmptyState
    action={<Button>Réessayer</Button>}
    description="La toute première ouverture a besoin d'internet. Ensuite, ton jardin marche même sans réseau."
    title="Pas de connexion"
  />
)
