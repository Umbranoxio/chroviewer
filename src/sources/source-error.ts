import { TaggedError } from 'better-result';

export class SourceError extends TaggedError('SourceError')<{
  message: string;
  source: 'archive' | 'beatsaver' | 'local' | 'scoresaber';
  operation: string;
  status?: number;
  cause?: unknown;
}>() {}

export function sourceError(cause: unknown, details: Omit<ConstructorParameters<typeof SourceError>[0], 'cause'>) {
  return SourceError.is(cause) ? cause : new SourceError({ ...details, cause });
}
