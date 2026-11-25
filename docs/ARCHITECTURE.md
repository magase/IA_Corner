# Corner — Arquitectura

## Monorepo

| Paquete           | Descripción                                                |
| ----------------- | ---------------------------------------------------------- |
| `apps/api`        | Node.js vanilla (http nativo) + TypeScript, Prisma + MySQL |
| `apps/app`        | Angular + Ionic + Capacitor (web, iOS, Android) — fase 5   |
| `packages/shared` | Enums, contratos y catálogo de permisos (freemium)         |

## Capas (hexagonal) — `apps/api/src/modules/<modulo>/`

- `domain/` entidades, value objects, reglas puras. Sin dependencias externas.
- `application/` casos de uso + **puertos** (interfaces).
- `infrastructure/` **adaptadores**: Prisma, Google OAuth, pagos, IA.
- `interfaces/http/` rutas y mapeo HTTP ↔ casos de uso.

ESLint bloquea imports `domain → application/infrastructure/interfaces` y `application → infrastructure/interfaces`.
El _composition root_ es `src/app.ts`.

## TDD

Test primero en cada caso de uso (Vitest). Tests unitarios junto al código (`*.test.ts`), e2e en `apps/api/test/`.

## Freemium

`packages/shared/src/entitlements.ts` es la única fuente de verdad. El negocio pregunta
"¿tiene la feature X?" / "¿cuál es su límite?", nunca "¿es premium?".
Límite alcanzado → `PremiumRequiredError` → HTTP 402 → el front muestra el paywall.

| Gratis (MVP)                            | Premium                                                 | Add-ons (pago aparte, requieren Premium) |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| Plan determinista (plantillas)          | Plan personalizado con IA (`PlanPersonalizer` → Claude) | Recetas                                  |
| Registro: máx. 10 filas, solo historial | Registro ilimitado                                      | Registro de comidas diario               |
| Nutrición general + menú genérico       | Mifflin-St Jeor × actividad, comidas, restricciones     |                                          |
| Wiki                                    | Temporizador de rounds, calendario, métricas corporales |                                          |

## Pagos

Puerto `PaymentGateway`. MVP: `FakePaymentGateway`. Después: Stripe (web) y RevenueCat (App Store / Google Play).

## Seguridad

argon2id, JWT de acceso corto + refresh token rotativo (hash SHA-256 en BD, detección de reutilización por familia),
cookie httpOnly/Secure/SameSite, validación Zod, rate limiting, CORS con lista blanca, cabeceras de seguridad,
límite de tamaño de body, edad mínima 18, consentimiento RGPD de datos de salud, exportación/borrado de cuenta.

## Contenido

- ~60 ejercicios: fuerza, pliometría, movilidad, flexibilidad.
- ~10 drills en solitario por deporte: Muay Thai, Boxeo, Kickboxing, Taekwondo, Karate.
- Grappling (lucha, sambo, judo, BJJ): solo en BD (`isEnabled=false`), sin sección en la app.
- Wiki: macros, micros, hidratación, suplementos (evidencia + estado WADA), conceptos de entrenamiento.
- **Excluido:** cualquier protocolo de corte de peso o rehidratación.
- Avisos legales siempre visibles en nutrición y suplementos.

## Autenticación (fase 2)

- **Email y contraseña:** argon2id con 19 MiB, t=2 y p=1. Para no revelar qué emails existen, el login hace la misma verificación de hash aunque el email no exista.
- **Google:** la app obtiene un ID token (Google Identity Services o plugin de Capacitor) y la API lo verifica con las claves públicas de Google (`aud` = client IDs configurados). En el primer acceso se piden la fecha de nacimiento y la aceptación de términos (`SIGNUP_DATA_REQUIRED`). Si ya existe una cuenta con ese email: si el email estaba **verificado**, se vincula; si **no** lo estaba, Google demuestra la propiedad, así que se **anula la contraseña previa y se cierran todas sus sesiones**. Así se evita el secuestro previo de cuentas (alguien que registra antes el email de otra persona).
- **Sesión:** un JWT HS256 de 15 minutos y un refresh token opaco de 32 bytes, del que en BD solo se guarda el hash SHA-256. Cada refresh rota el token dentro de la misma familia. La revocación es un compare-and-set atómico. Hay un **margen de 30 s**: si dos pestañas rotan a la vez, la que pierde recibe `REFRESH_TOKEN_ROTATED` sin cerrar la sesión. Reutilizar un token rotado hace más de 30 s (`REFRESH_TOKEN_REUSED`) revoca toda la familia.
- **CSRF:** la cookie va con `SameSite=Strict` y `Path=/api/v1/auth`, y `/auth/refresh` y `/auth/logout` exigen la cabecera `X-Corner-Client: 1`. Es una cabecera personalizada, así que obliga a una petición previa (preflight) de CORS que solo superan los orígenes permitidos.
- **Rate limit:** 300 peticiones por minuto e IP en general; 10 cada 15 minutos por IP en register, login y google; 60 cada 15 minutos en refresh. El borrado de cuenta se limita por IP y por usuario. El limitador en memoria expira las ventanas caducadas y tiene un tope de 100 000 claves. La IP sale del socket o, con `TRUST_PROXY_HOPS=N`, de la entrada N contando desde la derecha de `X-Forwarded-For`.
- **Reautenticación:** `DELETE /me` exige la contraseña o, en cuentas solo de Google, un ID token reciente de la misma identidad.
- **Enumeración de cuentas:** el login iguala los tiempos con un hash de relleno y el registro calcula el hash antes de comprobar si el email existe. El registro sigue respondiendo `409 EMAIL_TAKEN`; cerrar del todo la enumeración exige un flujo de alta por email (pendiente).
- **Concurrencia del perfil:** el upsert bloquea la fila `User` (`SELECT … FOR UPDATE`) y vuelve a comprobar el consentimiento dentro de la transacción. Retirar el consentimiento sigue el mismo orden de bloqueo.
- **Capas:** ESLint prohíbe en `domain` y `application` importar capas externas **y** librerías de infraestructura (`@prisma/client`, `zod`, `jose`, `@node-rs/*`, `node:*`).
- **RGPD:** retirar el consentimiento borra el perfil y las métricas corporales. `GET /me/export` exporta los datos y `DELETE /me` borra la cuenta en cascada.
- **Pendiente:** verificación de email y recuperación de contraseña (requieren un servicio de correo). Las cookies en apps nativas con Capacitor se resolverán con CapacitorHttp en la fase 5.

## Hoja de ruta

1. ✅ Esqueleto, tooling, Docker/MySQL, CI, modelo de datos.
2. ✅ Auth (email + Google), perfil, edad mínima, consentimiento.
3. Catálogo + seeds (ejercicios, deportes, wiki) es/en.
4. Generador determinista de entrenamiento y nutrición, registro con límite.
5. App Angular/Ionic: tema Corner (rojo, negro, verde militar), onboarding, plan, registro, wiki.
