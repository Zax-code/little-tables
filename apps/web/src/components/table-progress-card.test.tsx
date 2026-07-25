import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../i18n.js'
import { TableProgressCard } from './table-progress-card.js'

describe('TableProgressCard', () => {
  it('writes natural Chinese count phrases in progress tooltips', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale="zh-Hans">
        <TableProgressCard
          onChoose={vi.fn()}
          progress={{
            facts: { familiar: 2, fluent: 3, growing: 2, total: 12, unseen: 5 },
            table: 6,
          }}
        />
      </I18nProvider>,
    )

    expect(markup).toContain('title="已记牢 3 道"')
    expect(markup).toContain('title="正在熟悉 4 道"')
    expect(markup).toContain('title="还有 5 道待发现"')
    expect(markup).not.toContain('title="3 已记牢"')
  })
})
