# Manual de instalación y arranque

Este manual explica cómo dejar Corner funcionando en local para desarrollo, y cómo compilar y arrancar la API
en modo producción.

> Estado actual (fase 2): solo existe la API (`apps/api`), con autenticación y perfil. La app Angular/Ionic se añadirá en la fase 5 y
> este manual se ampliará entonces.

## 1. Requisitos previos

| Herramienta    | Versión                          | Para qué                              | Comprobar       |
| -------------- | -------------------------------- | ------------------------------------- | --------------- |
| Node.js        | **22 o superior** (ver `.nvmrc`) | API y tooling                         | `node -v`       |
| npm            | 10 o superior                    | Gestor de paquetes (workspaces)       | `npm -v`        |
| Docker Desktop | Reciente                         | MySQL local                           | `docker info`   |
| Git            | Cualquiera                       | Control de versiones y hooks de Husky | `git --version` |

Si usas `nvm`, ejecuta `nvm use` en la raíz del proyecto para seleccionar la versión correcta de Node.

> Si no quieres usar Docker, vale cualquier MySQL 8.x accesible. Basta con ajustar `DATABASE_URL`
> (ver el paso 3).

## 2. Instalar dependencias

En la raíz del repositorio:

```bash
npm install
```

Esto instala las dependencias de todos los workspaces (`apps/api` y `packages/shared`) y configura los hooks
de git (Husky):

- `pre-commit` ejecuta lint y Prettier sobre los archivos modificados;
- `commit-msg` valida el formato Conventional Commits.

## 3. Configurar las variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

Edita `apps/api/.env`:

| Variable            | Obligatoria | Descripción                                                                                                                                               | Valor en local                                                 |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `NODE_ENV`          | No          | `development` · `test` · `production`                                                                                                                     | `development`                                                  |
| `PORT`              | No          | Puerto de la API                                                                                                                                          | `3000`                                                         |
| `DATABASE_URL`      | **Sí**      | Cadena de conexión a MySQL                                                                                                                                | `mysql://corner:corner_dev@127.0.0.1:3306/corner`              |
| `CORS_ORIGINS`      | No          | Orígenes permitidos, separados por comas                                                                                                                  | `http://localhost:4200,capacitor://localhost,http://localhost` |
| `JWT_ACCESS_SECRET` | **Sí**      | Secreto del token de acceso (mínimo 32 caracteres)                                                                                                        | Genéralo (ver abajo)                                           |
| `GOOGLE_CLIENT_ID`  | No          | Client IDs de OAuth de Google (web, iOS, Android) separados por comas. Vacío = login con Google desactivado                                               | Vacío                                                          |
| `COOKIE_SECURE`     | No          | Marca la cookie de sesión como `Secure`. **Por defecto `true`**; pon `false` solo en desarrollo local por HTTP. Nunca `false` en producción               | `false`                                                        |
| `TRUST_PROXY_HOPS`  | No          | Número de proxies inversos propios delante de la API. La IP del cliente se toma contando desde la derecha de `X-Forwarded-For`. `0` = ignorar la cabecera | `0`                                                            |

Para generar secretos seguros:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

La API valida estas variables al arrancar. Si falta alguna o no es válida, se detiene con un mensaje como
`Configuración inválida: JWT_ACCESS_SECRET: ...`.

> 🔒 `.env` está en `.gitignore`. Nunca subas secretos al repositorio.

Credenciales de MySQL en Docker: por defecto, el usuario `corner` con contraseña `corner_dev` y la base de datos
`corner`. Para cambiarlas, exporta `MYSQL_PASSWORD` y `MYSQL_ROOT_PASSWORD` antes de arrancar Docker, y
actualiza `DATABASE_URL` para que coincida.

## 4. Arrancar la base de datos

Abre Docker Desktop y, desde la raíz:

```bash
npm run db:up
```

Esto levanta el contenedor `corner-mysql` (MySQL 8.4) en el puerto `3306`, con un volumen persistente
`corner-mysql`. Para comprobar que está listo:

```bash
docker ps --filter name=corner-mysql
docker logs corner-mysql 2>&1 | grep "ready for connections"
```

## 5. Crear el esquema (migraciones)

`prisma migrate dev` crea una base de datos temporal ("shadow") para calcular los cambios, así que el usuario
`corner` necesita permisos para crear bases de datos. **Solo la primera vez y solo en local:**

```bash
docker exec corner-mysql mysql -uroot -proot_dev \
  -e "GRANT CREATE, ALTER, DROP, REFERENCES, INDEX ON *.* TO 'corner'@'%'; FLUSH PRIVILEGES;"
```

> En producción no se da este permiso: allí se usa `prisma migrate deploy` (ver el paso 8).

Después, aplica las migraciones:

```bash
npm run prisma:migrate -w @corner/api
```

Y carga el catálogo base: 5 deportes de striking, 4 de grappling (desactivados) y 11 tipos de material:

```bash
npm run prisma:seed -w @corner/api
```

El seed es idempotente: puedes ejecutarlo varias veces sin duplicar datos.

La primera vez, Prisma pide un nombre para la migración (por ejemplo `init`). Después:

1. crea las tablas en MySQL;
2. guarda la migración en `apps/api/prisma/migrations/` (súbela al repositorio);
3. genera el cliente de Prisma.

Para explorar los datos de forma visual:

```bash
cd apps/api && npx prisma studio
```

## 6. Arrancar la API en desarrollo

```bash
npm run dev -w @corner/api
```

La API se recarga automáticamente cada vez que cambia un archivo. Comprueba que responde:

```bash
curl -i http://localhost:3000/api/v1/health
```

| Respuesta                                     | Significado                                                         |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `200 {"status":"ok","database":"up"}`         | Todo correcto                                                       |
| `503 {"status":"degraded","database":"down"}` | La API funciona, pero no conecta con MySQL (repasa los pasos 4 y 5) |

## 7. Verificar la calidad

Antes de hacer commit, o para comprobar la instalación:

```bash
npm test             # tests unitarios y e2e
npm run lint         # ESLint (incluidas las reglas de capas)
npm run typecheck    # TypeScript
npm run format:check # Prettier
```

Son las mismas comprobaciones que ejecuta el CI (`.github/workflows/ci.yml`) en cada push y pull request.
Los tests no necesitan MySQL: los casos de uso se prueban con dobles de los puertos.

## 8. Compilar y arrancar en producción

```bash
npm run build                      # compila packages/shared y apps/api
npm run start -w @corner/api       # ejecuta apps/api/dist/main.js con apps/api/.env
```

En producción:

- `NODE_ENV=production`;
- secretos robustos y distintos de los de desarrollo;
- `CORS_ORIGINS` solo con los dominios reales;
- servir la API detrás de un proxy inverso con HTTPS (Nginx, Caddy…). La API envía la cabecera HSTS;
- aplicar migraciones sin generar otras nuevas: `cd apps/api && npx prisma migrate deploy`, y después el seed;
- si la API está detrás de un proxy inverso, definir `TRUST_PROXY_HOPS` con el número de proxies (normalmente `1`) para que el rate limit use la IP real del cliente. No lo actives sin proxy: cualquiera podría falsear su IP;
- gestionar el proceso con un supervisor (por ejemplo `pm2` o systemd). La API se cierra limpiamente al
  recibir `SIGTERM` o `SIGINT`.

## 9. Parar y limpiar

```bash
# Detener la API: Ctrl+C
npm run db:down                    # para MySQL (los datos se conservan)
docker volume rm ia_corner_corner-mysql # ⚠️ borra todos los datos locales
```

## 10. Solución de problemas

| Problema                                            | Causa probable                                                                                                                         | Solución                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Configuración inválida: ...`                       | Falta una variable o no es válida en `apps/api/.env`                                                                                   | Revisa el paso 3. Los secretos JWT necesitan 32 caracteres o más       |
| `Cannot connect to the Docker daemon`               | Docker no está arrancado                                                                                                               | Abre Docker Desktop y repite `npm run db:up`                           |
| `Health` devuelve `503`                             | MySQL no está listo o `DATABASE_URL` es incorrecta                                                                                     | Mira `docker logs corner-mysql` y la cadena de conexión                |
| `port 3306 is already allocated`                    | Ya hay otro MySQL local en ese puerto                                                                                                  | Páralo, o cambia el puerto en `docker-compose.yml` y en `DATABASE_URL` |
| `EADDRINUSE :3000`                                  | El puerto 3000 está ocupado                                                                                                            | Cambia `PORT` en `.env` o libera el puerto                             |
| `Cannot resolve environment variable: DATABASE_URL` | Falta `apps/api/.env`, que lee `prisma.config.ts`                                                                                      | Repite el paso 3                                                       |
| `@prisma/client did not initialize yet`             | No se ha generado el cliente                                                                                                           | `npm run prisma:generate -w @corner/api`                               |
| `403 CLIENT_HEADER_REQUIRED`                        | Llamada a `/auth/refresh` o `/auth/logout` sin cabecera anti-CSRF                                                                      | Envía `X-Corner-Client: 1`                                             |
| `403 CORS_FORBIDDEN`                                | Petición desde un origen que no está en la lista                                                                                       | Añádelo a `CORS_ORIGINS`                                               |
| `429 TOO_MANY_REQUESTS`                             | Superado un límite: 300 peticiones/min por IP; 10 intentos/15 min en login, registro, Google y borrado de cuenta; 60/15 min en refresh | Espera los segundos que indica la cabecera `Retry-After`               |
| El commit se rechaza                                | El mensaje no sigue Conventional Commits                                                                                               | Usa el formato `feat(scope): descripción`                              |
