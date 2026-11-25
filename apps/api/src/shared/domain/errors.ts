/**
 * Errores de dominio. `code` es la categoría (mapea a un status HTTP);
 * `reason` es el motivo concreto que el front usa para mostrar el mensaje adecuado.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(
    message: string,
    readonly reason: string | undefined = undefined,
    readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
/** El plan gratuito alcanzó un límite o la feature es premium: el front muestra el paywall. */
export class PremiumRequiredError extends DomainError {
  readonly code = 'PREMIUM_REQUIRED';
}
