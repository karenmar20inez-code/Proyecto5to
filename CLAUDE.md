# La Nutria

Plataforma clínica para nutriólogos: pacientes, expediente clínico, consultas SOAP,
evaluaciones, dietas, cumplimiento, laboratorio, agenda, alertas y reportes.

## Estructura

- `frontend/`: React 19 (Create React App + craco), React Router 7, chart.js /
  react-chartjs-2, recharts, lucide-react. Entrada: `src/App.js`.
- `backend/`: Node 24, Express 5, Mongoose 9, MongoDB Atlas. Entrada: `server.js`,
  aplicación en `src/app.js`. Carpetas `src/Controllers`, `src/Models`, `src/Routes`, `src/Services`.
- `docs/`: `arquitectura-clinica.md`, `puesta-en-marcha.md`, `roles-y-permisos.md` y `despliegue-vercel.md`.

## Comandos

- Backend en desarrollo: `npm run dev --prefix backend` (puerto 5000).
- Frontend: `npm start --prefix frontend` (puerto 3000).
- Pruebas: `npm test --prefix backend` (runner nativo `node --test`).
- Compilación: `npm run build --prefix frontend`.
- Verificación completa: `/verificar-nutria`.
- Respaldo cifrado: `npm run respaldo --prefix backend` (conserva 30 en `backend/respaldos/`, ignorada por git).
  Comprobar uno sin restaurar: `node backend/scripts/respaldo.js --verificar <archivo>`.
  Programado a diario con `backend/scripts/respaldo-programado.cmd` (Programador de tareas de Windows).

## Datos

- Todo dato clínico vive en MongoDB; nada clínico se guarda en el navegador.
- El catálogo de dietas está en la colección `dietas` (API `/api/dietas`). `clave` (p. ej. `semana-2`) es lo que
  guardan `Paciente.dietaId`, `PlanNutricional.dietaId` y `Adherencia.dietaId`: nunca la cambies. Las dietas se archivan, no se borran.

## Reglas obligatorias

- Nunca abras, modifiques ni muestres archivos `.env`. Un hook lo bloquea.
- No publiques contraseñas, credenciales ni cadenas de conexión.
- No cambies la configuración de MongoDB Atlas. Los datos de prueba van en `lanutria_pruebas`, nunca en `la_nutria`.
- No elimines archivos ni funcionalidades existentes. No hagas cambios destructivos.
- No alteres el Dashboard, sus gráficas ni sus tarjetas KPI.
- Conserva React Router y las rutas existentes. Reutiliza componentes; no dupliques menús.
- No instales dependencias sin justificarlas. Verifica que una herramienta exista antes de usarla.
- No despliegues ni publiques sin autorización explícita de la usuaria.
- Antes de modificar archivos, presenta un resumen de los cambios. Trabaja por etapas.

## Convenciones

- Código, nombres y textos de la interfaz en español (`pacienteController`, `colapsado`, `puede('administracion')`).
- JavaScript (no TypeScript). Backend en CommonJS.
- Estilo verde glassmorphic: usa los tokens de `frontend/src/index.css`
  (`--verde`, `--beige`, `--blanco`, `--texto*`, `--exito`, `--aviso`, `--peligro`, `--vidrio-blur`).
  No uses colores fijos nuevos. Estilos compartidos en `frontend/src/styles/modulos.css`.
- Roles y permisos (RBAC) en `backend/src/Services/seguridad/permisos.js` (única fuente):
  superusuario, administrador (sin acceso clínico), nutriologo, docente, administrativo (niveles
  recepcion / gestion / supervisor) y paciente. `asistente` es heredado (se migra con `npm run migrar-roles`).
  Valida siempre en el backend con `exigirPermiso` / `tienePermiso`; nunca compares `rol` a mano para
  decidir acceso. Solo se gestionan cuentas de nivel inferior, nunca la propia; solo se conceden
  permisos que uno tiene. El acceso clínico se valida por expediente (responsable o equipo).
- Consultorios (`Consultorio`): el personal ligado a uno solo ve cuentas y pacientes de ese consultorio.
- Registros clínicos versionados (`grupoId` / `version` / `vigente`). Las notas SOAP firmadas solo admiten adendas.
- No se borran pacientes con datos clínicos (respuesta 409, NOM-004).
- Campos sensibles cifrados con el plugin AES-256-GCM (`CLAVE_CIFRADO`); toda acción clínica queda en `Auditoria`.
- Fechas clínicas en gráficas: formatea con `timeZone: 'UTC'`.

## Agentes del proyecto

- `revisor-seguridad-clinica`: revisa seguridad y NOM-004 después de cambios en el backend.
- `escritor-pruebas`: escribe pruebas con `node --test`.
