/** A whole number typed on the keypad, digit by digit. */
import type { PadKey } from '@little-tables/ui'
import { useState } from 'react'

/** A typed whole number, at most `maxDigits` long. */
export function useTypedNumber(maxDigits: number) {
  const [value, setValue] = useState('')
  return {
    clear: () => setValue(''),
    press: (key: Exclude<PadKey, 'submit'>) =>
      setValue((current) =>
        key === 'erase'
          ? current.slice(0, -1)
          : current.length >= maxDigits
            ? current
            : current === '0'
              ? key
              : `${current}${key}`,
      ),
    value,
  }
}
