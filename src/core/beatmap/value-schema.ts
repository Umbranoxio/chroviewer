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

export const beatSaberJsonArraySchema = z.array(z.json());

export const beatSaberStringArraySchema = z
  .array(z.string().optional().catch(undefined))
  .transform((values) => values.filter((value) => value !== undefined))
  .catch([]);

export const beatSaberTrackSchema = z
  .union([z.string().transform((value) => [value]), beatSaberStringArraySchema])
  .catch([]);

export const beatSaberVector3Schema = z
  .array(z.json())
  .min(3)
  .transform(
    ([x, y, z]) =>
      [beatSaberNumberSchema.parse(x), beatSaberNumberSchema.parse(y), beatSaberNumberSchema.parse(z)] as const,
  );
