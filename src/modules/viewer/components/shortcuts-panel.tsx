import { useTranslations } from 'use-intl';

import { Kbd } from '@/components/ui/kbd';

export function ShortcutsPanel() {
  const t = useTranslations('viewer.shortcuts');
  const shortcuts = [
    [t('keys.space'), t('actions.playPause')],
    [t('keys.leftRight'), t('actions.seek')],
    ['M', t('actions.toggleHitsounds')],
    ['F', t('actions.fullscreen')],
    ['H', t('actions.hideControls')],
    ['?', t('actions.openShortcuts')],
  ];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">{t('title')}</h2>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-xs">
        {shortcuts.map(([key, action]) => (
          <div className="contents" key={key}>
            <dt>
              <Kbd>{key}</Kbd>
            </dt>
            <dd className="text-muted-foreground">{action}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground border-border mt-4 border-t pt-3 text-xs leading-relaxed">
        {t.rich('attribution', {
          chroViewer: (chunks) => (
            <a
              className="text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-2"
              href="https://github.com/Umbranoxio/chroviewer"
              target="_blank"
              rel="noopener noreferrer"
            >
              {chunks}
            </a>
          ),
          chroMapper: (chunks) => (
            <a
              className="text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-2"
              href="https://github.com/Caeden117/ChroMapper"
              target="_blank"
              rel="noopener noreferrer"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
