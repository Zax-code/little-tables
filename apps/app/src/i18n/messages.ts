/** Every catalogue, merged from its groups (see `i18n.test.ts` for the checks). */
import * as access from './messages/access.js'
import * as child from './messages/child.js'
import * as parents from './messages/parents.js'
import * as paths from './messages/paths.js'
import * as reward from './messages/reward.js'
import * as session from './messages/session.js'

export const groups = { access, child, parents, paths, reward, session } as const

const en = { ...access.en, ...child.en, ...parents.en, ...paths.en, ...reward.en, ...session.en }

type Catalogue = Record<keyof typeof en, string>

const fr: Catalogue = {
  ...access.fr,
  ...child.fr,
  ...parents.fr,
  ...paths.fr,
  ...reward.fr,
  ...session.fr,
}
const zh: Catalogue = {
  ...access.zh,
  ...child.zh,
  ...parents.zh,
  ...paths.zh,
  ...reward.zh,
  ...session.zh,
}

export const messages = { en, fr, 'zh-Hans': zh } as const
