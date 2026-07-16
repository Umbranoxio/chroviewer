import { z } from 'zod';

export const beatSaberNumberSchema = z
  .union([
    z.number(),
    z.string().transform((value) => {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }),
    z.boolean().transform(Number),
  ])
  .catch(0);

export const beatSaberIntegerSchema = beatSaberNumberSchema.transform(Math.trunc);

export const beatSaberStringSchema = z
  .union([z.string(), z.union([z.number(), z.boolean()]).transform(String)])
  .catch('');

export const beatSaberBooleanSchema = z
  .union([z.boolean(), z.number().transform((value) => value !== 0), z.string().transform((value) => value === 'true')])
  .catch(false);

export const beatSaberJsonObjectSchema = z.record(z.string(), z.json());
