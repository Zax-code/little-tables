import { AllowedEmailAccess } from './allowed-email-access.js'

/**
 * Before family profiles, the deployment had one learner identity (`lou`).
 * Allowlisted Google emails were access gates to that shared learner, not
 * independent data owners. Only the deployment owner may retain that
 * historically ambiguous practice stream during the family-profile backfill.
 */
const retainSharedProfileId = (email: string): boolean => AllowedEmailAccess.isAdministrator(email)

export const LegacyProfileMigration = { retainSharedProfileId } as const
