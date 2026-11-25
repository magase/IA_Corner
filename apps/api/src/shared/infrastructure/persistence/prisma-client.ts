import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7 exige un driver adapter. Para MySQL se usa el conector oficial `mariadb`.
 * `allowPublicKeyRetrieval` es necesario con la autenticación caching_sha2 de MySQL 8
 * cuando la conexión no va por TLS (red local / mismo servidor).
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: url.searchParams.get('allowPublicKeyRetrieval') !== 'false',
    connectionLimit: Number(url.searchParams.get('connection_limit') ?? 10),
  });
  return new PrismaClient({ adapter });
}
