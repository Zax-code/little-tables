/** Rows used to lay out a bed so every part stays at least a finger wide on a phone. */
export const bedColumns = (denominator: number): number =>
  denominator > 6 && denominator % 2 === 0 ? denominator / 2 : denominator

/** The first `numerator` parts of a whole in `denominator` parts are planted. */
export const filledParts = (denominator: number, numerator: number): ReadonlyArray<boolean> =>
  Array.from({ length: denominator }, (_, index) => index < numerator)
