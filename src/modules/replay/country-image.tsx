import { Globe } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

interface CountryImageProps {
  country: string;
  size?: number;
}

export function CountryImage({ country, size = 16 }: CountryImageProps) {
  const format = useFormatter();
  const t = useTranslations('replay');
  const countryCode = country.toUpperCase();
  const countryName = /^[A-Z]{2}$/.test(countryCode) ? format.displayName(countryCode, { type: 'region' }) : undefined;

  if (countryName === undefined || countryName === countryCode) {
    return <Globe style={{ width: size, height: size }} aria-label={t('unknownCountry')} />;
  }

  const lowerCountryCode = countryCode.toLowerCase();
  const fileName = [lowerCountryCode.charCodeAt(0), lowerCountryCode.charCodeAt(1)]
    .map((codePoint) => (codePoint + 127365).toString(16))
    .join('-');

  return (
    <img
      className="max-w-none shrink-0"
      src={`${import.meta.env.BASE_URL}twemoji/${fileName}.png`}
      alt={countryName}
      title={countryName}
      width={size}
      height={size}
    />
  );
}
