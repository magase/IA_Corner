export interface HealthChecker {
  isDatabaseUp(): Promise<boolean>;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

export class GetHealth {
  constructor(private readonly checker: HealthChecker) {}

  async execute(): Promise<HealthReport> {
    const up = await this.checker.isDatabaseUp().catch(() => false);
    return { status: up ? 'ok' : 'degraded', database: up ? 'up' : 'down' };
  }
}
