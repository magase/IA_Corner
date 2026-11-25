import { ValidationError } from '../../../shared/domain/errors.js';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** Política basada en longitud (NIST 800-63B) + mínimo de letras y números. */
export function assertPasswordPolicy(password: string, email: string): void {
  const weak = (msg: string) => new ValidationError(msg, 'WEAK_PASSWORD');
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw weak(
      `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
    );
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw weak('La contraseña debe contener letras y números');
  }
  const local = email.split('@')[0] ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local.toLowerCase())) {
    throw weak('La contraseña no puede contener tu email');
  }
}
