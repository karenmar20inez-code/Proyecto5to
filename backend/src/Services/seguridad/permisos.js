/**
 * Control de acceso basado en roles (RBAC). La autorización SIEMPRE se valida en el backend;
 * el frontend solo usa la lista de permisos efectivos para mostrar u ocultar opciones.
 *
 * Para agregar un rol o un permiso basta con editar CATALOGO_PERMISOS y ROLES:
 * el middleware, la gestión de usuarios y el frontend leen estas tablas.
 *
 * Permisos efectivos de un usuario =
 *   permisos del rol (+ los de su nivel, si el rol tiene niveles)
 *   + permisosExtra (concedidos expresamente a esa cuenta)
 *   − permisosRevocados
 */

/* Catálogo: cada permiso con su descripción (se muestra en Administración) */
const CATALOGO_PERMISOS = {
  'plataforma:administrar': 'Supervisar la plataforma y gestionar administradores',
  administracion: 'Entrar a la sección de Administración',
  'usuarios:leer': 'Consultar cuentas de usuario',
  'usuarios:crear': 'Registrar cuentas de usuario',
  'usuarios:editar': 'Modificar cuentas, roles y permisos asignables',
  'usuarios:estado': 'Activar, suspender o desactivar cuentas',
  'consultorios:leer': 'Consultar consultorios',
  'consultorios:gestionar': 'Crear y modificar consultorios',
  'auditoria:leer': 'Consultar la bitácora de auditoría',
  'configuracion:gestionar': 'Gestionar reglas de alerta y configuración administrativa',
  'pacientes:leer': 'Consultar datos de identificación de pacientes',
  'pacientes:escribir': 'Registrar y editar datos de identificación de pacientes',
  'pacientes:eliminar': 'Eliminar pacientes sin información clínica',
  'clinico:leer': 'Consultar expedientes clínicos (solo los asignados)',
  'clinico:escribir': 'Registrar información clínica (solo en expedientes asignados)',
  'notas:firmar': 'Firmar notas clínicas',
  'alertas:revisar': 'Revisar alertas clínicas',
  'dietas:leer': 'Consultar el catálogo de dietas',
  'dietas:escribir': 'Crear y editar dietas',
  'agenda:leer': 'Consultar la agenda',
  'agenda:escribir': 'Programar y modificar citas',
  'reportes:generar': 'Generar documentos clínicos de pacientes',
  'estadisticas:leer': 'Consultar estadísticas (anónimas si no tiene acceso clínico)',
  'portal:propio': 'Consultar su propia información como paciente',
};

/* Ningún usuario puede conceder estos permisos a otra cuenta como permiso extra
   (portal:propio solo tiene sentido para el rol paciente, ligado a su propio expediente) */
const NO_CONCEDIBLES = ['*', 'plataforma:administrar', 'portal:propio'];

/* Sin dietas: la asignación de dieta es información nutricional (solo personal clínico) */
const RECEPCION = ['pacientes:leer', 'pacientes:escribir', 'agenda:leer', 'agenda:escribir'];

/**
 * Roles. `nivel` define la jerarquía: solo se gestiona a usuarios de nivel inferior.
 * `oculto`: rol heredado que ya no se asigna (se migra).
 */
const ROLES = {
  superusuario: {
    nombre: 'Superusuario', nivel: 100,
    descripcion: 'Control global de la plataforma, incluido el acceso clínico de supervisión (queda en auditoría).',
    permisos: ['*'],
  },
  administrador: {
    nombre: 'Administrador de sistemas', nivel: 80,
    descripcion: 'Administración técnica y operativa. Sin acceso automático a expedientes clínicos.',
    permisos: [
      'administracion', 'usuarios:leer', 'usuarios:crear', 'usuarios:editar', 'usuarios:estado',
      'consultorios:leer', 'auditoria:leer', 'configuracion:gestionar', 'pacientes:leer', 'estadisticas:leer',
    ],
  },
  nutriologo: {
    nombre: 'Nutriólogo(a)', nivel: 50,
    descripcion: 'Atiende pacientes. Solo accede a los expedientes de los que es responsable o integrante del equipo.',
    permisos: [
      'pacientes:leer', 'pacientes:escribir', 'clinico:leer', 'clinico:escribir', 'notas:firmar', 'alertas:revisar',
      'dietas:leer', 'dietas:escribir', 'agenda:leer', 'agenda:escribir', 'reportes:generar', 'estadisticas:leer',
    ],
  },
  docente: {
    nombre: 'Docente', nivel: 30,
    descripcion: 'Supervisión y enseñanza con estadísticas anónimas y el catálogo de dietas. Sin datos clínicos identificables.',
    permisos: ['estadisticas:leer', 'dietas:leer'],
  },
  administrativo: {
    nombre: 'Administrativo', nivel: 30,
    descripcion: 'Apoyo al consultorio según su nivel. Sin acceso a historiales, diagnósticos ni información nutricional privada.',
    permisos: [],
    niveles: {
      recepcion: { nombre: 'Recepción', permisos: RECEPCION },
      gestion: { nombre: 'Gestión', permisos: [...RECEPCION, 'estadisticas:leer'] },
      supervisor: { nombre: 'Supervisor', permisos: [...RECEPCION, 'estadisticas:leer', 'administracion', 'usuarios:leer'] },
    },
    nivelPorOmision: 'recepcion',
  },
  paciente: {
    nombre: 'Paciente', nivel: 10,
    descripcion: 'Consulta únicamente su propia información y lo que su nutriólogo le autorice.',
    permisos: ['portal:propio'],
  },
  /* Heredado: equivale a Administrativo · Recepción hasta ejecutar la migración de roles */
  asistente: { nombre: 'Asistente', nivel: 30, permisos: RECEPCION, oculto: true },
};

const ROLES_ASIGNABLES = Object.keys(ROLES).filter((r) => !ROLES[r].oculto);

/** Lista de permisos efectivos (sin duplicados) */
function permisosDe(usuario) {
  const rol = ROLES[usuario?.rol];
  if (!rol || usuario.activo === false) return [];
  const base = [...rol.permisos];
  if (rol.niveles) base.push(...(rol.niveles[usuario.nivel] || rol.niveles[rol.nivelPorOmision]).permisos);
  const extra = (usuario.permisosExtra || []).filter((p) => CATALOGO_PERMISOS[p] && !NO_CONCEDIBLES.includes(p));
  const revocados = new Set(usuario.permisosRevocados || []);
  return [...new Set([...base, ...extra])].filter((p) => p === '*' || !revocados.has(p));
}

function tienePermiso(usuario, permiso) {
  const lista = permisosDe(usuario);
  return lista.includes('*') || lista.includes(permiso);
}

/** Alcance global (ve todos los expedientes): solo el superusuario */
const alcanceGlobal = (usuario) => usuario?.rol === 'superusuario' && usuario.activo !== false;

/** Acceso clínico limitado a sus expedientes (nutriólogos o cuentas con permiso clínico expreso) */
const clinicoLimitado = (usuario) => tienePermiso(usuario, 'clinico:leer') && !alcanceGlobal(usuario);

/** ¿Puede ver la información clínica de este expediente? */
function accesoClinico(usuario, expediente) {
  if (!usuario || !expediente || !tienePermiso(usuario, 'clinico:leer')) return false;
  if (alcanceGlobal(usuario)) return true;
  const id = String(usuario._id);
  return String(expediente.responsableId) === id || (expediente.equipoIds || []).some((e) => String(e) === id);
}

const nivelDe = (rol) => ROLES[rol]?.nivel ?? 0;

/** Roles que `actor` puede asignar: siempre de nivel inferior al suyo */
const rolesAsignables = (actor) => ROLES_ASIGNABLES.filter((r) => nivelDe(r) < nivelDe(actor?.rol));

/** ¿Puede `actor` gestionar (editar, activar, desactivar) la cuenta `objetivo`? */
function puedeGestionar(actor, objetivo) {
  if (!actor || !objetivo || String(actor._id) === String(objetivo._id)) return false; // nunca a sí mismo
  return nivelDe(objetivo.rol) < nivelDe(actor.rol);
}

/** Permisos extra que `actor` puede conceder: solo los que él mismo tiene (sin escalar privilegios) */
function permisosConcedibles(actor) {
  const propios = permisosDe(actor);
  return Object.keys(CATALOGO_PERMISOS).filter((p) => !NO_CONCEDIBLES.includes(p) && (propios.includes('*') || propios.includes(p)));
}

/* Compatibilidad: permisos base por rol (usado por pruebas e integraciones anteriores) */
const PERMISOS = Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, r.permisos]));

module.exports = {
  CATALOGO_PERMISOS, ROLES, ROLES_ASIGNABLES, NO_CONCEDIBLES, PERMISOS,
  permisosDe, tienePermiso, alcanceGlobal, clinicoLimitado, accesoClinico,
  nivelDe, rolesAsignables, puedeGestionar, permisosConcedibles,
};
