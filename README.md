# Corner

App multiplataforma (web, iOS y Android) para entrenar y gestionar el entrenamiento en deportes de contacto,
con planes de nutrición y una wiki de nutrientes y suplementos. Modelo **freemium**.

> ⚠️ Corner ofrece información general de entrenamiento y nutrición. No sustituye la consulta con un
> profesional sanitario, médico o nutricionista.

## Funcionalidades

| Área          | Gratis (MVP)                                                       | Premium                                                                | Extras de pago                      |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------- |
| Entrenamiento | Plan determinista a partir de plantillas                           | Plan personalizado con IA                                              | —                                   |
| Registro      | Hasta 10 sesiones, historial en lista                              | Ilimitado, calendario, temporizador de rounds                          | —                                   |
| Cuerpo        | —                                                                  | Peso, medidas, fatiga, sueño                                           | —                                   |
| Nutrición     | Recomendación general y menú genérico                              | Calorías y macros (Mifflin-St Jeor), comidas, restricciones dietéticas | Recetas, registro diario de comidas |
| Wiki          | Nutrientes, hidratación, suplementos (evidencia y WADA), conceptos | —                                                                      | —                                   |

**Contenido:**

- unos 60 ejercicios de fuerza, pliometría, movilidad y flexibilidad;
- unos 10 drills en solitario por deporte: Muay Thai, Boxeo, Kickboxing, Taekwondo y Karate.

Grappling está modelado en la base de datos, pero aún no tiene sección en la app.

**Idiomas:** español (por defecto) e inglés. **Edad mínima:** 18 años.

## Stack

| Capa                           | Tecnología                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| Backend (`apps/api`)           | Node.js 22 vanilla (`http` nativo) + TypeScript, Zod              |
| Base de datos                  | MySQL 8.4 con Prisma ORM 7 (driver adapter `mariadb`)             |
| Frontend (`apps/app`)          | Angular + Ionic + Capacitor _(fase 5, aún no creado)_             |
| Compartido (`packages/shared`) | Enums y catálogo de permisos freemium                             |
| Calidad                        | Vitest (TDD), ESLint, Prettier, Husky, commitlint, GitHub Actions |

## Inicio rápido

```bash
npm install
cp apps/api/.env.example apps/api/.env   # y edita los secretos
npm run db:up
npm run prisma:migrate -w @corner/api
npm run prisma:seed -w @corner/api
npm run dev -w @corner/api
curl http://localhost:3000/api/v1/health
```

La guía paso a paso, con requisitos previos y solución de problemas, está en **[docs/INSTALL.md](docs/INSTALL.md)**.

## Estructura

```
.
├── apps/
│   └── api/
│       ├── prisma/schema.prisma     Modelo de datos
│       ├── src/
│       │   ├── app.ts               Composition root (conexión de puertos y adaptadores)
│       │   ├── main.ts              Punto de entrada
│       │   ├── modules/<modulo>/    domain · application · infrastructure · interfaces/http
│       │   └── shared/              Errores de dominio, servidor HTTP, router, seguridad, config
│       └── test/                    Tests e2e
├── packages/shared/                 Enums y entitlements (freemium)
├── docs/                            Arquitectura e instalación
├── docker-compose.yml               MySQL local
└── AGENTS.md                        Reglas para agentes de IA y colaboradores
```

## Scripts

| Comando                                   | Descripción                                       |
| ----------------------------------------- | ------------------------------------------------- |
| `npm test`                                | Ejecuta todos los tests                           |
| `npm run lint` / `npm run lint:fix`       | ESLint, incluidas las reglas de capas hexagonales |
| `npm run typecheck`                       | Comprobación de tipos de TypeScript               |
| `npm run format` / `npm run format:check` | Prettier                                          |
| `npm run build`                           | Compila todos los paquetes                        |
| `npm run db:up` / `npm run db:down`       | Arranca o para MySQL en Docker                    |
| `npm run dev -w @corner/api`              | API en modo watch                                 |
| `npm run start -w @corner/api`            | API compilada (producción)                        |
| `npm run prisma:migrate -w @corner/api`   | Crea y aplica migraciones                         |
| `npm run test:cov -w @corner/api`         | Tests con cobertura                               |

## API

| Método        | Ruta                         | Auth                          | Descripción                                                                         |
| ------------- | ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `GET`         | `/api/v1/health`             | —                             | Estado de la API y la base de datos (`200` ok, `503` degradado)                     |
| `POST`        | `/api/v1/auth/register`      | —                             | Alta con email y contraseña (18+, aceptación de términos)                           |
| `POST`        | `/api/v1/auth/login`         | —                             | Login con email y contraseña                                                        |
| `POST`        | `/api/v1/auth/google`        | —                             | Login o alta con el ID token de Google                                              |
| `POST`        | `/api/v1/auth/refresh`       | Cookie + `X-Corner-Client: 1` | Renueva la sesión (rota el refresh token)                                           |
| `POST`        | `/api/v1/auth/logout`        | Cookie + `X-Corner-Client: 1` | Cierra la sesión                                                                    |
| `GET`         | `/api/v1/me`                 | Bearer                        | Usuario, plan, features y límites                                                   |
| `PUT`         | `/api/v1/me/consents/health` | Bearer                        | Da o retira el consentimiento de datos de salud (retirarlo borra el perfil)         |
| `GET` / `PUT` | `/api/v1/me/profile`         | Bearer                        | Perfil del atleta (requiere consentimiento)                                         |
| `GET`         | `/api/v1/me/export`          | Bearer                        | Exporta todos tus datos en JSON (RGPD)                                              |
| `DELETE`      | `/api/v1/me`                 | Bearer + reautenticación      | Borra la cuenta. Envía `password`, o `googleIdToken` si la cuenta es solo de Google |

**Sesión:** las respuestas de login y registro devuelven un `accessToken` (JWT de 15 minutos) para la cabecera
`Authorization: Bearer`. El refresh token viaja en la cookie `corner_rt`, que es httpOnly, `SameSite=Strict`,
dura 30 días y solo se envía a `/api/v1/auth`.

Los errores tienen la forma `{ error, reason?, message, details? }`. El campo `reason` indica el motivo
concreto, por ejemplo `UNDERAGE`, `EMAIL_TAKEN`, `HEALTH_CONSENT_REQUIRED` o `SIGNUP_DATA_REQUIRED`.

Códigos de error comunes: `400` validación, `401` no autenticado, **`402` requiere premium** (el front muestra
el paywall), `404`, `405`, `413` petición demasiado grande, `415` el body no es JSON, `429` límite de peticiones.

## Documentación

- [docs/INSTALL.md](docs/INSTALL.md): instalación y arranque
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arquitectura, freemium, seguridad y hoja de ruta
- [AGENTS.md](AGENTS.md): convenciones y reglas del repositorio

## Estado

- ✅ Fase 1: esqueleto, tooling, Docker/MySQL, CI y modelo de datos.
- ✅ Fase 2: autenticación (email y Google), sesión con rotación, perfil, edad mínima, consentimiento y RGPD.
- ⏳ Fase 3: catálogo de ejercicios y wiki (es/en).

Ver la hoja de ruta completa en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#hoja-de-ruta).
