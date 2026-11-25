import type { AddOn } from '@corner/shared';
import type { PrismaClient } from '@prisma/client';
import type { EntitlementsReader, UserPlan } from '../../application/entitlements.js';
import type { Clock } from '../../application/ports.js';

export class PrismaEntitlementsReader implements EntitlementsReader {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: Clock,
  ) {}

  async forUser(userId: string): Promise<UserPlan> {
    const now = this.clock.now();
    const [sub, addOns] = await Promise.all([
      this.db.subscription.findUnique({ where: { userId } }),
      this.db.userAddOn.findMany({
        where: { userId, OR: [{ activeUntil: null }, { activeUntil: { gt: now } }] },
      }),
    ]);
    const premiumActive =
      sub?.tier === 'PREMIUM' &&
      sub.status === 'ACTIVE' &&
      (sub.currentPeriodEnd === null || sub.currentPeriodEnd > now);
    return {
      tier: premiumActive ? 'PREMIUM' : 'FREE',
      addOns: addOns.map((a) => a.addOn as AddOn),
    };
  }
}
