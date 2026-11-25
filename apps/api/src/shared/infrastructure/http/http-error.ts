/** Error de transporte (no de dominio): CORS, CSRF, body inválido, rate limit... */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(code);
  }
}
