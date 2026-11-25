import type { PrismaClient } from '@prisma/client';
import type { HealthChecker } from '../../../modules/health/application/get-health.js';

export class PrismaHealthChecker implements HealthChecker {
  constructor(private readonly prisma: PrismaClient) {}

  async isDatabaseUp(): Promise<boolean> {
    await this.prisma.$queryRaw`SELECT 1`;
    return true;
  }
}
