import { Link } from '@tanstack/react-router'

import { useI18n } from '../i18n.js'

export function OwnerAccessLink({ isAdmin }: Readonly<{ isAdmin: boolean }>) {
  const { t } = useI18n()
  if (!isAdmin) return null
  return (
    <Link className="owner-access-link" preload="render" to="/access">
      {t('owner.manage')}
    </Link>
  )
}
