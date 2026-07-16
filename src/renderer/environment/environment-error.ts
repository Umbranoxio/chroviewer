import { TaggedError } from 'better-result';

export class EnvironmentLoadAborted extends TaggedError('EnvironmentLoadAborted')<{
  environmentId: string;
  message: string;
  cause?: unknown;
}>() {}

export class EnvironmentLoadError extends TaggedError('EnvironmentLoadError')<{
  environmentId: string;
  message: string;
  cause: unknown;
}>() {}

export type EnvironmentLoadFailure = EnvironmentLoadAborted | EnvironmentLoadError;

export function environmentLoadFailure(environmentId: string, cause: unknown): EnvironmentLoadFailure {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return new EnvironmentLoadAborted({
      environmentId,
      message: `environment ${environmentId} load was cancelled`,
      cause,
    });
  }

  return new EnvironmentLoadError({
    environmentId,
    message: cause instanceof Error ? cause.message : `environment ${environmentId} failed to load`,
    cause,
  });
}
