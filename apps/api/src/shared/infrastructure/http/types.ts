import type { IncomingMessage } from 'node:http';

export interface HttpRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  headers: IncomingMessage['headers'];
  cookies: Record<string, string>;
  ip: string;
  body: unknown;
}

export interface HttpResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string | string[]>;
}

export type Handler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

/** Verifica la identidad de la petición y devuelve el userId (lanza UnauthorizedError). */
export type Authenticator = (req: HttpRequest) => Promise<string>;
