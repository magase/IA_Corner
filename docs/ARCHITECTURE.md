# Corner — Arquitectura

## Monorepo

| Paquete           | Descripción                                                |
| ----------------- | ---------------------------------------------------------- |
| `apps/api`        | Node.js vanilla (http nativo) + TypeScript, Prisma + MySQL |
| `apps/app`        | Angular + Ionic + Capacitor (web, iOS, Android) — fase 5   |
| `packages/shared` | Enums, contratos y catálogo de permisos (freemium)         |

## Persistencia

Prisma 7 con el driver adapter `@prisma/adapter-mariadb`, el conector oficial y compatible con MySQL. El cliente se crea en
`shared/infrastructure/persistence/prisma-client.ts`. La URL de conexión y el seed se configuran en
`apps/api/prisma.config.ts`, que carga `apps/api/.env` si existe: Prisma 7 ya no lo carga automáticamente.
En el `package.json` raíz, `overrides.effect` fuerza una versión parcheada de una dependencia interna de la CLI
de Prisma (GHSA-7589-6fvf-x4pw). Se podrá quitar cuando Prisma actualice esa dependencia.

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

## Catálogo y wiki (fase 3)

- **Contenido:** está versionado en `apps/api/prisma/seed-data/*.json` y validado con Zod (`seed-data/schema.ts`). Ambos idiomas son obligatorios, igual que los códigos de catálogo y los recuentos mínimos, y hay un filtro que rechaza cualquier contenido de corte de peso. `npx tsx prisma/seed-data/validate.ts <fichero>` valida un fichero, y `test/seed-data.test.ts`, el conjunto.
- **Seed:** idempotente (upsert por slug). Lo que se elimina de los JSON se despublica en BD (`isActive` / `isPublished`), no se borra, para no romper planes ni registros existentes.
- **Lectura:** el módulo `catalog` (puerto `CatalogQueries`, adaptador Prisma) traduce al idioma pedido con fallback al español. El filtro de material devuelve los ejercicios cuyo material requerido está **todo** disponible; el peso corporal siempre cuenta y `FULL_GYM` desactiva el filtro.
- **Avisos:** `requiresHealthDisclaimer` vale `true` en nutrición, hidratación y suplementos; el front muestra el aviso legal.
- **Multimedia:** `mediaUrl` y `thumbnailUrl` quedan a `null` hasta disponer de recursos propios.

## Planes y registro (fase 4)

- **Generador determinista** (`training/domain/plan-generator.ts`, función pura): las mismas entradas y el mismo catálogo dan siempre el mismo plan.
  - El reparto semanal va de 1 a 7 días y el objetivo lo ajusta. Pierna pesada y potencia nunca caen en días consecutivos.
  - Cada sesión tiene calentamiento de movilidad, bloque principal, finalizador y vuelta a la calma con estiramientos.
  - El volumen depende de los minutos por sesión (unos 10 minutos por ejercicio principal).
  - Los ejercicios se filtran por material disponible, por dificultad (nunca por encima del nivel) y por los deportes del usuario (repartiendo entre ellos por turnos).
  - Primero se cubren músculos distintos y se evita repetir en la semana.
  - Si el catálogo no cubre un enfoque, se usa uno alternativo en lugar de perder el día.
  - `generatorVersion` queda guardado en el plan.
- **IA (premium, fuera del MVP):** puerto `PlanPersonalizer`. Recibirá el borrador determinista y lo ajustará. Sin configurar, responde `AI_PLAN_UNAVAILABLE`.
- **Nutrición:**
  - El plan gratuito da recomendaciones generales (códigos traducibles, sin calorías), un menú genérico por objetivo y suplementos enlazados a la wiki.
  - El premium (`MACRO_CALCULATOR`) calcula con Mifflin-St Jeor × factor de actividad, con ajuste moderado según objetivo: déficit máximo del 10 % y suelo de grasa de 0,8 g/kg.
  - Siempre lleva `requiresHealthDisclaimer: true`.
- **Registro:** el límite (`limits.workoutLogRows`: 10 en el plan gratuito) se aplica dentro de una transacción que bloquea la fila `User` (`SELECT … FOR UPDATE`). Se ha comprobado que con 12 peticiones simultáneas se crean exactamente 10. El historial es una lista, sin gráficas.

## Hoja de ruta

1. ✅ Esqueleto, tooling, Docker/MySQL, CI, modelo de datos.
2. ✅ Auth (email + Google), perfil, edad mínima, consentimiento.
3. ✅ Catálogo + seeds (ejercicios, deportes, wiki) es/en.
4. ✅ Generador determinista de entrenamiento y nutrición, registro con límite.
5. App Angular/Ionic: tema Corner (rojo, negro, verde militar), onboarding, plan, registro, wiki.
