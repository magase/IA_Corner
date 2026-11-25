import type { Handler } from './types.js';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Route {
  method: Method;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export interface RouteMatch {
  handler: Handler;
  params: Record<string, string>;
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: Method, path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({ method, pattern: new RegExp(`^${source}/?$`), keys, handler });
    return this;
  }

  get(p: string, h: Handler) {
    return this.add('GET', p, h);
  }
  post(p: string, h: Handler) {
    return this.add('POST', p, h);
  }
  put(p: string, h: Handler) {
    return this.add('PUT', p, h);
  }
  patch(p: string, h: Handler) {
    return this.add('PATCH', p, h);
  }
  delete(p: string, h: Handler) {
    return this.add('DELETE', p, h);
  }

  /** Devuelve la ruta, 'method-not-allowed' si el path existe con otro método, o null. */
  match(method: string, path: string): RouteMatch | 'method-not-allowed' | null {
    let pathExists = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      pathExists = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
      return { handler: r.handler, params };
    }
    return pathExists ? 'method-not-allowed' : null;
  }
}
