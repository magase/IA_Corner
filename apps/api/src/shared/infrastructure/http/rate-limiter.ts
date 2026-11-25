/** Rate limiter en memoria (ventana fija). Sustituible por Redis detrás de la misma interfaz. */
export interface RateLimiter {
  hit(key: string): { allowed: boolean; retryAfterSec: number };
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private nextSweepAt = 0;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    /** Tope de claves en memoria: evita agotar la RAM rotando IPs. */
    private readonly maxKeys = 100_000,
  ) {}

  hit(key: string) {
    const t = this.now();
    this.sweep(t);
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= t) {
      if (!b && this.buckets.size >= this.maxKeys) {
        // Expulsa la clave más antigua (orden de inserción del Map).
        const oldest = this.buckets.keys().next().value;
        if (oldest !== undefined) this.buckets.delete(oldest);
      }
      this.buckets.delete(key);
      this.buckets.set(key, { count: 1, resetAt: t + this.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    b.count++;
    const allowed = b.count <= this.max;
    return { allowed, retryAfterSec: allowed ? 0 : Math.ceil((b.resetAt - t) / 1000) };
  }

  get size(): number {
    return this.buckets.size;
  }

  /** Limpieza perezosa de ventanas caducadas, como mucho una vez por ventana. */
  private sweep(t: number): void {
    if (t < this.nextSweepAt) return;
    this.nextSweepAt = t + this.windowMs;
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}
