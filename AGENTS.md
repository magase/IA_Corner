# AGENTS.md — Corner

Guía para agentes de IA (y humanos) que trabajen en este repositorio.
Contexto completo de arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Proyecto

Corner es una app freemium (web + móvil) de entrenamiento para deportes de contacto y nutrición:
ejercicios de gimnasio, pliometría, movilidad, flexibilidad, drills en solitario de striking,
planes de nutrición y una wiki de nutrientes y suplementos.

## Stack

- `apps/api`: Node.js 22 **vanilla** (módulo `http` nativo, **sin Express/Fastify**) + TypeScript, Prisma + MySQL, Zod.
- `apps/app`: Angular + Ionic + Capacitor (pendiente, fase 5).
- `packages/shared`: enums, contratos y catálogo de permisos compartidos.

## Comandos

```bash
npm install
cp apps/api/.env.example apps/api/.env   # y rellena los secretos
npm run db:up                          # MySQL en Docker
npm run prisma:migrate -w @corner/api  # migraciones
npm run prisma:seed -w @corner/api     # catálogo base (deportes, material)
npm run dev -w @corner/api             # API en modo watch
npm test                               # todos los tests
npm run lint && npm run typecheck && npm run format:check
```

Antes de dar una tarea por terminada: `npm run lint`, `npm run typecheck` y `npm test` deben pasar.

## Reglas de arquitectura (hexagonal)

Estructura por módulo: `apps/api/src/modules/<modulo>/{domain,application,infrastructure,interfaces/http}`.

- `domain`: entidades y reglas puras. No importa nada de otras capas ni librerías de infraestructura.
- `application`: casos de uso y **puertos** (interfaces). No importa `infrastructure` ni `interfaces`.
- `infrastructure`: adaptadores (Prisma, Google, pagos, IA). Implementan los puertos.
- `interfaces/http`: rutas; validan con Zod y llaman a casos de uso.
- Las dependencias se conectan solo en el composition root, `apps/api/src/app.ts`.
- ESLint hace cumplir estas reglas: no las desactives.

## TDD

1. Escribe primero el test que falla (Vitest), junto al código como `*.test.ts`.
2. Implementa lo mínimo para que pase y luego refactoriza.
3. Los casos de uso se testean con dobles de los puertos, sin base de datos.
4. Los tests e2e de HTTP van en `apps/api/test/`. Usan `startTestApp()` (en `test/helpers`), con fakes en memoria de `test/fakes`.

## Freemium

- La única fuente de verdad es `packages/shared/src/entitlements.ts`.
- El código pregunta por una **feature** o un **límite**, nunca `if (tier === 'PREMIUM')`.
- Si se alcanza un límite, lanza `PremiumRequiredError`, que la API devuelve como HTTP 402 para que el front muestre el paywall.
- Plan gratis: máximo 10 filas de `WorkoutLog`; el usuario puede borrarlas.
- Pagos: puerto `PaymentGateway`; en el MVP solo existe `FakePaymentGateway`.
- IA: puerto `PlanPersonalizer` (Claude), solo para premium y fuera del MVP.

## Seguridad (obligatorio)

- Nunca escribas secretos en el código; usa `.env` (validado en `config/env.ts`).
- Contraseñas con argon2id. Refresh tokens guardados solo como hash SHA-256, con rotación por familia.
- Rutas autenticadas: usa `authenticate(req)` (Bearer). Nunca tomes el `userId` del body ni de la URL.
- Valida toda entrada con Zod. No registres en logs datos personales, de salud ni tokens.
- Edad mínima: 18 años. Para guardar datos de salud hace falta consentimiento (RGPD).
- No relajes CORS, las cabeceras de seguridad, el rate limit ni el límite de body.
- Las operaciones irreversibles (borrar cuenta) exigen reautenticación y rate limit.
- Nunca auto-vincules identidades a cuentas con email no verificado sin anular sus credenciales.

## Contenido y producto

- Idiomas: español (por defecto) e inglés. Todo contenido traducible va en tablas `*Translation`, y los textos de UI en i18n.
- Drills de striking: solo ejercicios que se puedan hacer en solitario.
- Grappling: solo existe en la base de datos (`isEnabled = false`). **No crees una sección en la app.**
- **Prohibido:** cualquier contenido sobre corte de peso o rehidratación para el pesaje.
- Nutrición y suplementos: muestra **siempre** el aviso de consultar a un profesional sanitario o nutricionista.
- Suplementos: incluyen nivel de evidencia y estado WADA, y enlazan con su artículo de la wiki.
- Multimedia de ejercicios: deja los placeholders (`mediaUrl = null`); los recursos los aporta el equipo.

## Estilo y git

- TypeScript `strict`, Prettier (comillas simples, ancho 100) y ESLint.
- Commits con Conventional Commits (lo valida commitlint): `feat(auth): ...`, `test(plans): ...`.
- No hagas commit ni push sin que te lo pidan.
