import type { E2EConfig } from 'e2e'
import { chatgpt } from 'e2e/oauth/chatgpt'
import { web } from '@e2e-dev/web'

// The agent steps run on a ChatGPT Plus or Pro subscription: sign in once with `corepack pnpm e2e:login`.
export default {
  agents: {
    default: {
      model: chatgpt('gpt-6-luna'),
      context: [
        'little tables is a French PWA where a child practises multiplication tables and verb',
        'conjugation. Each practice session ("séance") waters a plant in the child\'s garden',
        '("jardin"); the tabs are "Aujourd\'hui", "Jardin" and "Progrès". The interface is in',
        'French: answer questions correctly unless a goal says otherwise.',
      ].join(' '),
    },
  },
  targets: [
    {
      // The app follows the browser's language; the tests read its French copy.
      engine: web({ locale: 'fr-FR' }),
      app: {
        // Port 0 picks a free port, so the run never collides with `pnpm dev` or `pnpm dev:server`.
        url: 'http://127.0.0.1:0',
        readyUrl: 'http://127.0.0.1:{port}/health/ready',
        command: {
          executable: 'bash',
          args: ['scripts/serve.sh'],
          env: { PORT: '{port}' },
          log: '.e2e/logs/app.log',
          startupTimeout: 600_000,
        },
      },
    },
  ],
} satisfies E2EConfig
