# Coding standards

## Domain

- Business rules live behind the `LearningEngine` public interface.
- Time and randomness are explicit inputs to domain functions.
- Persisted and transported values are validated with Effect Schema.
- Answer events are immutable and idempotent by event ID.
- Tests exercise public interfaces and observable outcomes, not private helpers.

## TypeScript

- Strict TypeScript is mandatory; do not use `any` or unchecked type assertions.
- Prefer immutable values and `ReadonlyArray` at module interfaces.
- Model expected failures with tagged errors rather than thrown strings.
- Keep platform-specific imports inside adapters.

## UI

- All interactive controls must be keyboard accessible and at least 44×44 CSS pixels.
- Never rely on color, sound, or motion alone for required feedback.
- All non-essential animation must respect `prefers-reduced-motion`.
- Feature code uses semantic design tokens rather than raw palette values.

## Verification

- Add behavior tests with each new domain capability.
- Run type checking and the relevant test file during implementation.
- Run the complete `pnpm check` before review and commit.
