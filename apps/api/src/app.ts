import type { Server } from 'node:http';
import {
  DeleteAccount,
  ExportMyData,
  GetMe,
  SetHealthConsent,
} from './modules/identity/application/account.js';
import { LoginWithEmail } from './modules/identity/application/login-with-email.js';
import { LoginWithGoogle } from './modules/identity/application/login-with-google.js';
import { Logout } from './modules/identity/application/logout.js';
import type {
  AccessTokenService,
  GoogleTokenVerifier,
  OpaqueTokenGenerator,
  PasswordHasher,
  RefreshTokenStore,
  UserRepository,
} from './modules/identity/application/ports.js';
import { RefreshSession } from './modules/identity/application/refresh-session.js';
import { RegisterWithEmail } from './modules/identity/application/register-with-email.js';
import { SessionIssuer } from './modules/identity/application/session-issuer.js';
import { bearerAuthenticator } from './modules/identity/interfaces/http/auth-guard.js';
import { registerAuthRoutes } from './modules/identity/interfaces/http/auth.routes.js';
import { registerMeRoutes } from './modules/identity/interfaces/http/me.routes.js';
import { GetHealth, type HealthChecker } from './modules/health/application/get-health.js';
import { registerHealthRoutes } from './modules/health/interfaces/http/health.routes.js';
import type {
  CatalogReader,
  HealthConsentReader,
  ProfileRepository,
} from './modules/profile/application/ports.js';
import {
  GetAthleteProfile,
  UpsertAthleteProfile,
} from './modules/profile/application/profile-use-cases.js';
import { registerProfileRoutes } from './modules/profile/interfaces/http/profile.routes.js';
import type { CatalogQueries } from './modules/catalog/application/ports.js';
import { CatalogService } from './modules/catalog/application/catalog-use-cases.js';
import { registerCatalogRoutes } from './modules/catalog/interfaces/http/catalog.routes.js';
import {
  GenerateNutritionPlan,
  GetActiveNutritionPlan,
  type NutritionPlanRepository,
} from './modules/nutrition/application/nutrition-use-cases.js';
import type {
  ExerciseCandidateReader,
  PlanPersonalizer,
  TrainingPlanRepository,
} from './modules/training/application/ports.js';
import {
  GenerateTrainingPlan,
  GetActiveTrainingPlan,
} from './modules/training/application/training-use-cases.js';
import { registerPlanRoutes } from './modules/training/interfaces/http/plans.routes.js';
import {
  WorkoutService,
  type WorkoutRepository,
} from './modules/workouts/application/workout-use-cases.js';
import { registerWorkoutRoutes } from './modules/workouts/interfaces/http/workouts.routes.js';
import type { AthleteContextReader } from './shared/application/athlete-context.js';
import type { EntitlementsReader } from './shared/application/entitlements.js';
import type { Clock, IdGenerator } from './shared/application/ports.js';
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from './shared/infrastructure/http/rate-limiter.js';
import { Router } from './shared/infrastructure/http/router.js';
import { buildServer } from './shared/infrastructure/http/server.js';

export interface AppDeps {
  config: { corsOrigins: readonly string[]; cookieSecure: boolean; trustProxyHops: number };
  clock: Clock;
  ids: IdGenerator;
  healthChecker: HealthChecker;
  users: UserRepository;
  refreshTokens: RefreshTokenStore;
  hasher: PasswordHasher;
  accessTokens: AccessTokenService;
  opaqueTokens: OpaqueTokenGenerator;
  google: GoogleTokenVerifier;
  profiles: ProfileRepository;
  catalog: CatalogReader;
  consent: HealthConsentReader;
  entitlements: EntitlementsReader;
  catalogQueries: CatalogQueries;
  athletes: AthleteContextReader;
  exerciseCandidates: ExerciseCandidateReader;
  trainingPlans: TrainingPlanRepository;
  nutritionPlans: NutritionPlanRepository;
  workouts: WorkoutRepository;
  /** Premium (IA). Sin configurar en el MVP. */
  planPersonalizer?: PlanPersonalizer;
  /** Global: 300 req/min por IP. */
  rateLimiter?: RateLimiter;
  /** Credenciales y reautenticación: 10 intentos / 15 min por IP (y por usuario en reauth). */
  authRateLimiter?: RateLimiter;
  /** Refresh de sesión: 60 / 15 min por IP. */
  refreshRateLimiter?: RateLimiter;
  logger?: { error: (msg: string, err?: unknown) => void };
}

/** Composition root: aquí se conectan puertos y adaptadores. */
export function createApp(d: AppDeps): Server {
  const router = new Router();
  const sessions = new SessionIssuer(
    d.accessTokens,
    d.refreshTokens,
    d.opaqueTokens,
    d.ids,
    d.clock,
  );
  const authenticate = bearerAuthenticator(d.accessTokens);
  const authLimiter = d.authRateLimiter ?? new InMemoryRateLimiter(10, 15 * 60_000);

  registerHealthRoutes(router, new GetHealth(d.healthChecker));
  registerAuthRoutes(router, {
    register: new RegisterWithEmail(d.users, d.hasher, sessions, d.ids, d.clock),
    login: new LoginWithEmail(d.users, d.hasher, sessions),
    google: new LoginWithGoogle(d.users, d.google, d.refreshTokens, sessions, d.ids, d.clock),
    refresh: new RefreshSession(d.refreshTokens, d.opaqueTokens, d.users, sessions, d.clock),
    logout: new Logout(d.refreshTokens, d.opaqueTokens, d.clock),
    limiter: authLimiter,
    refreshLimiter: d.refreshRateLimiter ?? new InMemoryRateLimiter(60, 15 * 60_000),
    cookieSecure: d.config.cookieSecure,
    now: () => d.clock.now(),
  });
  registerMeRoutes(router, {
    authenticate,
    getMe: new GetMe(d.users, d.entitlements),
    setHealthConsent: new SetHealthConsent(d.users, d.clock),
    exportData: new ExportMyData(d.users),
    deleteAccount: new DeleteAccount(d.users, d.hasher, d.google),
    reauthLimiter: authLimiter,
    cookieSecure: d.config.cookieSecure,
  });
  registerProfileRoutes(router, {
    authenticate,
    get: new GetAthleteProfile(d.profiles, d.consent),
    upsert: new UpsertAthleteProfile(d.profiles, d.catalog, d.consent, d.entitlements),
  });

  registerCatalogRoutes(router, new CatalogService(d.catalogQueries));
  registerPlanRoutes(router, {
    authenticate,
    generateTraining: new GenerateTrainingPlan(
      d.athletes,
      d.exerciseCandidates,
      d.trainingPlans,
      d.entitlements,
      d.clock,
      d.planPersonalizer ?? null,
    ),
    getTraining: new GetActiveTrainingPlan(d.trainingPlans, d.athletes),
    generateNutrition: new GenerateNutritionPlan(
      d.athletes,
      d.nutritionPlans,
      d.entitlements,
      d.clock,
    ),
    getNutrition: new GetActiveNutritionPlan(d.nutritionPlans, d.athletes, d.entitlements),
  });
  registerWorkoutRoutes(router, {
    authenticate,
    workouts: new WorkoutService(d.workouts, d.entitlements, d.clock),
  });

  return buildServer({
    router,
    corsOrigins: d.config.corsOrigins,
    trustProxyHops: d.config.trustProxyHops,
    rateLimiter: d.rateLimiter ?? new InMemoryRateLimiter(300, 60_000),
    ...(d.logger ? { logger: d.logger } : {}),
  });
}
