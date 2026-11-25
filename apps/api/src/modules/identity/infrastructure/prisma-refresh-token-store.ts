import type { PrismaClient } from '@prisma/client';
import type { RefreshTokenRecord, RefreshTokenStore } from '../application/ports.js';

export class PrismaRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly db: PrismaClient) {}

  async save(r: RefreshTokenRecord) {
    await this.db.refreshToken.create({ data: r });
  }

  async findByHash(tokenHash: string) {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        userAgent: true,
      },
    });
  }

  async revoke(id: string, at: Date) {
    // updateMany con condición = compare-and-set atómico frente a rotaciones concurrentes.
    const { count } = await this.db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
    return count === 1;
  }

  async revokeFamily(familyId: string, at: Date) {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeAllForUser(userId: string, at: Date) {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
