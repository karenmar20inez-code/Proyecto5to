# Despliegue en Vercel (preparado, NO desplegado)

NUTRIONIX (antes «La Nutria») se publica como **dos proyectos de Vercel** desde el mismo repositorio:

| Proyecto | Root Directory | Qué publica |
|----------|----------------|-------------|
| `la-nutria-api` | `backend` | Express como función serverless (`api/index.js`) |
| `la-nutria` | `frontend` | React compilado (`build/`) con rutas SPA |

`server.js` sigue siendo el arranque local (`npm run dev`). En Vercel no se usa.

## Archivos preparados

- `backend/api/index.js`: función serverless. Reutiliza `src/app.js` y conserva la conexión
  a MongoDB entre peticiones. Activa `trust proxy` para que el límite de intentos de login use
  la IP real de cada usuaria.
- `backend/vercel.json`: envía todas las rutas a la función.
- `backend/.env.example`: nombres de variables, sin valores.
- `frontend/vercel.json`: compila con `npm run build` (craco) y redirige todas las rutas a
  `index.html` para que React Router funcione al recargar la página.

## Pasos (los haces tú cuando autorices el despliegue)

1. **Sube el código a GitHub.** Hoy `frontend/`, `backend/`, `docs/` y `.claude/` no están en git.
   Revisa antes que `backend/.env` NO aparezca en `git status` (está en `backend/.gitignore`).
2. **MongoDB Atlas, Network Access.** Vercel usa IPs variables. Tienes dos opciones:
   - Permitir `0.0.0.0/0` (cualquier IP). Es lo habitual en Vercel, pero la seguridad queda solo
     en el usuario y la contraseña de la base: usa una contraseña larga y un usuario de Atlas
     con permisos solo sobre `la_nutria`.
   - Usar un hosting con IP fija (Render, Railway con IP estática) para el backend.
   Este cambio lo haces tú en Atlas; el proyecto no modifica la configuración de Atlas.
3. **Proyecto backend** en vercel.com: *Add New → Project →* el repositorio, *Root Directory* `backend`.
   En *Environment Variables* captura:
   - `MONGO_URI`: tu cadena de Atlas.
   - `CLAVE_CIFRADO`: **la misma** que usas en local. Si es distinta, los datos cifrados no se podrán leer.
   - `CORS_ORIGENES`: la URL del frontend (paso 4), por ejemplo `https://la-nutria.vercel.app`.
   - Opcionales: `SESION_HORAS`, `SESION_INACTIVIDAD_MIN`, `ZONA_HORARIA`.
4. **Proyecto frontend**: otro proyecto con *Root Directory* `frontend` y la variable
   `REACT_APP_API_URL` = `https://<tu-backend>.vercel.app/api`.
   Esta variable se integra al compilar: si la cambias, vuelve a desplegar.
5. Cuando tengas la URL definitiva del frontend, actualiza `CORS_ORIGENES` del backend y redespliega.
6. Prueba: abre la URL del frontend, inicia sesión y revisa Dashboard, Pacientes e Historial clínico.

## Limitaciones conocidas en serverless

- El límite de 20 intentos de login por IP vive en memoria. En Vercel cada instancia tiene su
  propio contador, así que el límite es menos estricto. El bloqueo por cuenta (5 intentos) sí
  se guarda en MongoDB y sigue funcionando igual.
- La bitácora agrupa accesos repetidos cada 10 minutos en memoria. En serverless pueden aparecer
  algunos registros de acceso duplicados. No se pierde ningún registro.
- La primera petición tras un rato sin uso tarda más (arranque en frío y conexión a Atlas).
- Los scripts de `backend/scripts` (respaldo, migración, crear administrador) se ejecutan en local, no en Vercel.

## Verificado localmente

- `api/index.js` montado en un servidor local contra `lanutria_pruebas`: `/` devuelve 200;
  `/api/pacientes` sin sesión devuelve 401; un JSON inválido devuelve 400.
- `CI=true npm run build --prefix frontend` compila sin advertencias. Vercel usa `CI=true`,
  y con esa variable las advertencias rompen la compilación.
- `npm test --prefix backend`: 64 pasan, 1 omitida (requiere `MONGO_URI_TEST`).
