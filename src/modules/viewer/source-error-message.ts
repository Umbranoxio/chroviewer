import type { SourceError } from '../../sources/source-error';

export function sourceErrorMessage(error: SourceError, fallback: string, missingMapInfo: string) {
  return error.operation === 'find-map-info' ? missingMapInfo : `${fallback}: ${error.message}`;
}
