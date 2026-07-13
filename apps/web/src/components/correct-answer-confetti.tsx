const confettiPieces = Array.from({ length: 14 }, (_, index) => index)
const flowerShapes = ['✿', '❀', '✾', '❁'] as const

type CorrectAnswerConfettiProps = {
  variant?: 'pieces' | 'flowers'
}

export function CorrectAnswerConfetti({ variant = 'pieces' }: CorrectAnswerConfettiProps) {
  return (
    <div
      aria-hidden="true"
      className={`answer-confetti${variant === 'flowers' ? ' answer-confetti--flowers' : ''}`}
    >
      {confettiPieces.map((piece) => (
        <i key={piece}>
          {variant === 'flowers' ? flowerShapes[piece % flowerShapes.length] : null}
        </i>
      ))}
    </div>
  )
}
