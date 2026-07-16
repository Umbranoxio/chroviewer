import enMessages from '../../messages/en.json';
import type { Locale } from './config';
import { intlFormats } from './formats';

declare module 'use-intl' {
  interface AppConfig {
    Formats: typeof intlFormats;
    Locale: Locale;
    Messages: typeof enMessages;
  }
}
