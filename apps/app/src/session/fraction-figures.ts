/** How a fraction is laid out in a flower bed. */

/** Columns of a bed, so that every part stays a finger wide on a phone. */
export const bedColumns = (denominator: number) =>
  denominator > 6 && denominator % 2 === 0 ? denominator / 2 : denominator

/** The first `numerator` of `denominator` parts are in flower. */
export const filledParts = (denominator: number, numerator: number) =>
  Array.from({ length: denominator }, (_, index) => index < numerator)
