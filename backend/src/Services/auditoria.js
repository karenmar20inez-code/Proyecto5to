const Auditoria = require('../Models/Auditoria');

/**
 * Registra un evento de auditoría sin bloquear ni romper la respuesta.
 * El responsable es el usuario autenticado (req.usuario).
 */
function registrarAuditoria(req, { accion, entidad, entidadId, pacienteId, campos = [], usuario } = {}) {
  const u = usuario || req.usuario;
  Auditoria.create({
    accion,
    entidad,
    entidadId,
    pacienteId,
    campos,
    usuarioId: u?._id,
    responsable: u?.nombre || u?.correo || 'anónimo',
    rol: u?.rol,
    ip: req.ip,
  }).catch((error) => console.error('No se pudo registrar la auditoría:', error.message));
}

module.exports = { registrarAuditoria };
