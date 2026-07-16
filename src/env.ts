import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const localHostnames = new Set(['localhost', '0.0.0.0', '127.0.0.1', '[::1]']);

const publicApiUrl = z
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === 'https:' || (url.protocol === 'http:' && localHostnames.has(url.hostname));
    },
    { message: 'must be https, or localhost http' },
  )
  .transform((value) => value.replace(/\/$/, ''));

export const env = createEnv({
  isServer: false,
  clientPrefix: 'VITE_',
  client: {
    VITE_BEATSAVER_API_URL: publicApiUrl.default('https://api.beatsaver.com'),
    VITE_SCORESABER_API_URL: publicApiUrl.default('https://scoresaber.com'),
    VITE_LUDUS_URL: publicApiUrl.default('https://ludus-1.scoresaber.com'),
  },
  runtimeEnvStrict: {
    VITE_BEATSAVER_API_URL: import.meta.env.VITE_BEATSAVER_API_URL,
    VITE_SCORESABER_API_URL: import.meta.env.VITE_SCORESABER_API_URL,
    VITE_LUDUS_URL: import.meta.env.VITE_LUDUS_URL,
  },
  emptyStringAsUndefined: true,
});
