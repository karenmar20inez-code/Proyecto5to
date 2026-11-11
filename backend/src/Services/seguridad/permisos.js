/**
 * Permisos por rol. La autorización SIEMPRE se valida en el backend.
 *
 *  administrador → todo, incluida la gestión de usuarios, reglas y auditoría.
 *  nutriologo    → expedientes de los que es responsable o integrante del equipo.
 *  asistente     → datos de identificación y agenda; sin acceso a información clínica.
 */
const PERMISOS = {
  administrador: ['*'],
  nutriologo: [
    'pacientes:leer', 'pacientes:escribir', 'clinico:leer', 'clinico:escribir', 'notas:firmar',
    'agenda:leer', 'agenda:escribir', 'reportes:generar', 'alertas:revisar', 'estadisticas:leer',
  ],
  asistente: ['pacientes:leer', 'pacientes:escribir', 'agenda:leer', 'agenda:escribir'],
};

function tienePermiso(usuario, permiso) {
  const lista = PERMISOS[usuario?.rol] || [];
  return lista.includes('*') || lista.includes(permiso);
}

/** ¿Puede el usuario ver la información clínica de este expediente? */
function accesoClinico(usuario, expediente) {
  if (!usuario || !expediente) return false;
  if (usuario.rol === 'administrador') return true;
  if (usuario.rol !== 'nutriologo') return false;
  const id = String(usuario._id);
  return String(expediente.responsableId) === id || (expediente.equipoIds || []).some((e) => String(e) === id);
}

module.exports = { PERMISOS, tienePermiso, accesoClinico };
