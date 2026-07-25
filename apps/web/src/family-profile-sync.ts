import type { ChildProfile } from '@little-tables/domain'

export async function flushPendingAttemptsForProfiles(
  profiles: ReadonlyArray<ChildProfile>,
  flushProfile: (profileId: string) => Promise<unknown>,
): Promise<void> {
  await Promise.all(profiles.map(({ id }) => flushProfile(id)))
}
