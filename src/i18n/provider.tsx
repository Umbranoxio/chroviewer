import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { IntlProvider } from 'use-intl';

import { defaultLocale, getBrowserLocale, type Locale } from './config';
import { intlFormats } from './formats';
import { getMessages } from './messages';

interface AppIntlProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function AppIntlProvider({ children, initialLocale = defaultLocale }: AppIntlProviderProps) {
  const [locale, setLocale] = useState(initialLocale);

  useEffect(() => {
    function updateLocale() {
      setLocale(getBrowserLocale());
    }

    updateLocale();
    window.addEventListener('languagechange', updateLocale);
    return () => {
      window.removeEventListener('languagechange', updateLocale);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <IntlProvider formats={intlFormats} locale={locale} messages={getMessages(locale)} timeZone="UTC">
      {children}
    </IntlProvider>
  );
}
