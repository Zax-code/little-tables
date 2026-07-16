import { Link } from '@tanstack/react-router'

export function OwnerAccessLink({ isAdmin }: Readonly<{ isAdmin: boolean }>) {
  if (!isAdmin) return null
  return (
    <Link className="owner-access-link" preload="render" to="/access">
      manage who can join
    </Link>
  )
}
