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
- **Sesiones:** se cierran al cambiar rol, permisos, estado, consultorio o contraseña.
- **Información nutricional del paciente** (peso, estatura, dieta asignada): solo el personal con acceso clínico la ve o la modifica.
- **Transferir un expediente** (cambiar su nutriólogo responsable) es tarea del superusuario o del propio responsable,
  desde el expediente. Cambiarlo transfiere el acceso clínico.
- **Consultorios:** el personal ligado a un consultorio solo ve y gestiona cuentas, pacientes y estadísticas de ese
  consultorio. El personal sin consultorio conserva el ámbito general.
- **Auditoría:** toda acción administrativa y clínica, incluidas las consultas al portal, queda en la bitácora.
- **Límite de inicio de sesión:** 5 intentos fallidos bloquean la cuenta 15 min. Además hay un máximo de 20 intentos
  por IP cada 15 min (variable `LOGIN_MAX_POR_IP`).

## Portal del paciente ("Mi espacio")

- La cuenta de paciente se crea en **Configuración → Usuarios y roles → Registrar usuario → rol Paciente**, ligada a
  un paciente existente (un paciente, una cuenta).
- El paciente se toma **siempre de la sesión**: no hay forma de pedir datos de otro paciente.
- **Todo está oculto por omisión.** El nutriólogo decide qué compartir en el expediente del paciente, en
  **Resumen clínico → Portal del paciente**: dieta, recomendaciones, citas, progreso (antropometría), cumplimiento e
  indicadores clínicos.
- Nunca se muestran notas clínicas, diagnósticos, antecedentes, laboratorios ni comentarios internos.

## Comandos

- `npm run migrar-roles --prefix backend` hace una simulación; con `-- --aplicar` aplica los cambios. Es segura y se puede repetir.
- `npm run crear-administrador --prefix backend -- --correo ... --nombre "..."` crea la primera cuenta (superusuario).
