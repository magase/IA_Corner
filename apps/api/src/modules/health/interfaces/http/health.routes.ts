import type { Router } from '../../../../shared/infrastructure/http/router.js';
import type { GetHealth } from '../../application/get-health.js';

export function registerHealthRoutes(router: Router, getHealth: GetHealth): void {
  router.get('/api/v1/health', async () => {
    const report = await getHealth.execute();
    return { status: report.status === 'ok' ? 200 : 503, body: report };
  });
}
