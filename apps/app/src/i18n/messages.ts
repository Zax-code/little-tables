/** Every catalogue, merged from its groups (see `i18n.test.ts` for the checks). */
import * as access from './messages/access.js'
import * as child from './messages/child.js'
import * as hard from './messages/hard.js'
import * as lock from './messages/lock.js'
import * as parents from './messages/parents.js'
import * as paths from './messages/paths.js'
import * as reward from './messages/reward.js'
import * as session from './messages/session.js'

export const groups = { access, child, hard, lock, parents, paths, reward, session } as const

const en = {
  ...access.en,
  ...child.en,
  ...hard.en,
  ...lock.en,
  ...parents.en,
  ...paths.en,
  ...reward.en,
  ...session.en,
}

type Catalogue = Record<keyof typeof en, string>

const fr: Catalogue = {
  ...access.fr,
  ...child.fr,
  ...hard.fr,
  ...lock.fr,
  ...parents.fr,
  ...paths.fr,
  ...reward.fr,
  ...session.fr,
}
const zh: Catalogue = {
  ...access.zh,
  ...child.zh,
  ...hard.zh,
  ...lock.zh,
  ...parents.zh,
  ...paths.zh,
  ...reward.zh,
  ...session.zh,
}

export const messages = { en, fr, 'zh-Hans': zh } as const
