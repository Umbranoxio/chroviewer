import { z } from 'zod';

const localeSchema = z.enum([
  'en',
  'de-DE',
  'ja-JP',
  'zh-CN',
  'ru-RU',
  'fr-FR',
  'pl-PL',
  'nl-NL',
  'pt-BR',
  'zh-TW',
  'cs-CZ',
  'ko-KR',
  'it-IT',
  'es-ES',
  'sv-SE',
  'fi-FI',
]);

export const locales = localeSchema.options;
export type Locale = z.infer<typeof localeSchema>;
export const defaultLocale: Locale = 'en';

const languageLocales: Record<string, Locale> = {
  cs: 'cs-CZ',
  de: 'de-DE',
  en: 'en',
  es: 'es-ES',
  fi: 'fi-FI',
  fr: 'fr-FR',
  it: 'it-IT',
  ja: 'ja-JP',
  ko: 'ko-KR',
  nl: 'nl-NL',
  pl: 'pl-PL',
  pt: 'pt-BR',
  ru: 'ru-RU',
  sv: 'sv-SE',
  zh: 'zh-CN',
};

export function matchLocale(value: string): Locale | null {
  const requested = value.trim().replaceAll('_', '-').toLowerCase();
  const exact = locales.find((locale) => locale.toLowerCase() === requested);
  if (exact !== undefined) return exact;

  if (requested.startsWith('zh-hans') || /^zh-(?:cn|sg|my)(?:-|$)/.test(requested)) return 'zh-CN';
  if (requested.startsWith('zh-hant') || /^zh-(?:tw|hk|mo)(?:-|$)/.test(requested)) return 'zh-TW';

  const separator = requested.indexOf('-');
  const language = separator === -1 ? requested : requested.slice(0, separator);
  return languageLocales[language] ?? null;
}

export function getBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return defaultLocale;

  const requestedLocales = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  for (const requestedLocale of requestedLocales) {
    const locale = matchLocale(requestedLocale);
    if (locale !== null) return locale;
  }

  return defaultLocale;
}
