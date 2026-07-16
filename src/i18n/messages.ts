import type { AbstractIntlMessages } from 'use-intl';

import csCzMessages from '../../messages/cs-CZ.json';
import deDeMessages from '../../messages/de-DE.json';
import enMessages from '../../messages/en.json';
import esEsMessages from '../../messages/es-ES.json';
import fiFiMessages from '../../messages/fi-FI.json';
import frFrMessages from '../../messages/fr-FR.json';
import itItMessages from '../../messages/it-IT.json';
import jaJpMessages from '../../messages/ja-JP.json';
import koKrMessages from '../../messages/ko-KR.json';
import nlNlMessages from '../../messages/nl-NL.json';
import plPlMessages from '../../messages/pl-PL.json';
import ptBrMessages from '../../messages/pt-BR.json';
import ruRuMessages from '../../messages/ru-RU.json';
import svSeMessages from '../../messages/sv-SE.json';
import zhCnMessages from '../../messages/zh-CN.json';
import zhTwMessages from '../../messages/zh-TW.json';
import type { Locale } from './config';

const messagesByLocale: Record<Locale, AbstractIntlMessages> = {
  en: enMessages,
  'de-DE': deDeMessages,
  'ja-JP': jaJpMessages,
  'zh-CN': zhCnMessages,
  'ru-RU': ruRuMessages,
  'fr-FR': frFrMessages,
  'pl-PL': plPlMessages,
  'nl-NL': nlNlMessages,
  'pt-BR': ptBrMessages,
  'zh-TW': zhTwMessages,
  'cs-CZ': csCzMessages,
  'ko-KR': koKrMessages,
  'it-IT': itItMessages,
  'es-ES': esEsMessages,
  'sv-SE': svSeMessages,
  'fi-FI': fiFiMessages,
};

export function getMessages(locale: Locale) {
  if (locale === 'en') return enMessages;
  return mergeMessages(enMessages, messagesByLocale[locale]);
}

function mergeMessages(base: AbstractIntlMessages, override: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, mergeMessage(value, override[key])]));
}

function mergeMessage(
  base: string | AbstractIntlMessages,
  override: string | AbstractIntlMessages | undefined,
): string | AbstractIntlMessages {
  if (typeof base === 'string') return typeof override === 'string' && override.trim() !== '' ? override : base;
  return mergeMessages(base, typeof override === 'object' ? override : {});
}
