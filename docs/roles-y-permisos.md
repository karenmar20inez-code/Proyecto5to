# Roles, permisos y portal del paciente

La Nutria es multiusuario. Cada cuenta tiene **un rol**, y el rol trae un conjunto de **permisos**.
La autorización se valida siempre en el backend (middleware de Express); el frontend solo oculta
lo que el rol no puede usar. La única fuente de verdad es
`backend/src/Services/seguridad/permisos.js`: para agregar un rol o un permiso basta con editar esa tabla.

## Roles

| Rol | Nivel | Para qué sirve | Acceso clínico |
|---|---|---|---|
| **Superusuario** | 100 | Control global, consultorios, administradores. Supervisión clínica (queda en auditoría). | Todos los expedientes |
| **Administrador de sistemas** | 80 | Crear, editar, activar y desactivar cuentas de nivel inferior; auditoría; reglas de alerta. | No (Dashboard anónimo) |
| **Nutriólogo(a)** | 50 | Pacientes, consultas, evaluaciones, dietas, cumplimiento, reportes. | Solo sus expedientes (responsable o equipo) |
| **Docente** | 30 | Estadísticas anónimas y catálogo de dietas, en solo lectura. | No |
| **Administrativo · Recepción** | 30 | Identificación de pacientes y agenda. | No |
| **Administrativo · Gestión** | 30 | Lo anterior y estadísticas anónimas. | No |
| **Administrativo · Supervisor** | 30 | Lo anterior y consulta de personal administrativo. | No |
| **Paciente** | 10 | Su portal ("Mi espacio"). | Solo lo que su nutriólogo le comparte |

`asistente` es un rol heredado: equivale a Administrativo · Recepción y se convierte con `npm run migrar-roles --prefix backend`.

## Reglas de seguridad

- **Jerarquía:** solo se crean, ven y gestionan cuentas de **nivel inferior** al propio. Nadie modifica su propia cuenta
  (rol, permisos ni estado) desde Administración, y ninguna cuenta crea superusuarios desde la aplicación.
- **Permisos por cuenta:** se puede retirar un permiso del rol o conceder uno adicional, pero solo los que quien lo
  concede ya tiene. Nunca se conceden `*`, `plataforma:administrar` ni `portal:propio`.
- **Contraseñas:** se guardan con hash (scrypt). La contraseña temporal **obliga** a cambiarla. Hasta entonces la
  cuenta solo puede usar "Mi perfil", y el servidor bloquea el resto (`CAMBIO_CONTRASENA`).
- **Asignar contraseña (solo superusuario):** en Usuarios y roles, botón **Cambiar contraseña** de cada cuenta
  (`usuarios:contrasena`). Por omisión la persona debe cambiarla al iniciar sesión. Se desbloquea la cuenta y se
  cierran sus sesiones. La propia contraseña se cambia en "Mi perfil".
- **Eliminar cuentas (solo superusuario):** botón **Eliminar cuenta** (`usuarios:eliminar`). Si la persona es
  responsable de expedientes, primero hay que transferirlos (409). Si no tiene actividad clínica, la cuenta se borra por
  completo; si la tiene, desaparece de la lista y ya no puede entrar, pero sus registros **conservan su nombre como autor**
  (NOM-004). En ambos casos el correo queda libre y la acción queda en la bitácora.
- **Sesiones:** se cierran al cambiar rol, permisos, estado, consultorio o contraseña.
- **Información nutricional del paciente** (peso, estatura, dieta asignada): solo el personal con acceso clínico la ve o la modifica.
- **Transferir un expediente** (cambiar su nutriólogo responsable) es tarea del superusuario o del propio responsable,
  desde el expediente. Cambiarlo transfiere el acceso clínico.
- **Consultorios:** el personal ligado a un consultorio solo ve y gestiona cuentas, pacientes y estadísticas de ese
  consultorio. El personal sin consultorio conserva el ámbito general.
- **Auditoría:** toda acción administrativa y clínica, incluidas las consultas al portal, queda en la bitácora.
- **Límite de inicio de sesión:** 5 intentos fallidos bloquean la cuenta 15 min. Además hay un máximo de 20 intentos
  por IP cada 15 min (variable `LOGIN_MAX_POR_IP`).

## Solicitudes de acceso (registro por cuenta propia)

- En la pantalla de inicio de sesión, **"¿No tienes cuenta? Solicitar acceso"**: la persona escribe su nombre, correo,
  teléfono, **su propia contraseña** y el tipo de acceso (nutriólogo, administrativo, docente o paciente).
- La solicitud queda **pendiente**: no entra hasta que alguien con permiso para crear cuentas (superusuario o
  administrador) la apruebe en **Configuración → Administración → Solicitudes** (con contador de pendientes).
- Al aprobar se elige el rol definitivo (solo de nivel inferior al de quien aprueba), nivel y consultorio; si es paciente,
  se liga a su expediente. La persona entra con el correo y la contraseña que eligió (sin contraseña temporal).
- Si intenta entrar antes, ve "pendiente" o "rechazada" (con el motivo) solo si escribe su contraseña correcta.
- Nadie puede solicitar ser superusuario ni administrador. La respuesta es la misma aunque el correo ya exista
  (no se revelan cuentas) y hay un máximo de 5 solicitudes por hora por conexión (`SOLICITUDES_MAX_POR_IP`).
- Toda aprobación o rechazo queda en la bitácora.

## Portal del paciente ("Mi espacio")

- La cuenta de paciente se crea desde **Pacientes**, con el botón de llave **Dar acceso al portal** de cada paciente
  (un paciente, una cuenta). "Registrar usuario" ya no ofrece el rol Paciente.

## Eliminar pacientes

- En **Pacientes**, el botón **Eliminar** borra al paciente solo si no tiene historial clínico (y también su cuenta del
  portal). Si tiene historial, la NOM-004 obliga a conservarlo: se ofrece **Darlo de baja** en su lugar.
- El filtro **Activos / Dados de baja / Todos** oculta por omisión a los pacientes dados de baja.
- El paciente se toma **siempre de la sesión**: no hay forma de pedir datos de otro paciente.
- **Todo está oculto por omisión.** El nutriólogo decide qué compartir en el expediente del paciente, en
  **Resumen clínico → Portal del paciente**: dieta, recomendaciones, citas, progreso (antropometría), cumplimiento e
  indicadores clínicos.
- Nunca se muestran notas clínicas, diagnósticos, antecedentes, laboratorios ni comentarios internos.

## Comandos

- `npm run migrar-roles --prefix backend` hace una simulación; con `-- --aplicar` aplica los cambios. Es segura y se puede repetir.
- `npm run crear-administrador --prefix backend -- --correo ... --nombre "..."` crea la primera cuenta (superusuario).
