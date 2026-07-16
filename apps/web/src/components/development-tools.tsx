import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export function DevelopmentTools() {
  return <TanStackRouterDevtools initialIsOpen={false} position="top-right" />
}
