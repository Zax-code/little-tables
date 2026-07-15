export function OwnerAccessLink({ isAdmin }: Readonly<{ isAdmin: boolean }>) {
  if (!isAdmin) return null
  return (
    <a className="owner-access-link" href="/access">
      manage who can join
    </a>
  )
}
