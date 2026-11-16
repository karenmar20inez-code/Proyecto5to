/**
 * Middleware de autenticación y autorización.
 * Todas las rutas /api (salvo /api/auth/login) pasan por `autenticar`.
 */
const mongoose = require('mongoose');
const sesiones = require('./sesiones');
const { tienePermiso, accesoClinico, alcanceGlobal, clinicoLimitado } = require('./permisos');
const Expediente = require('../../Models/Expediente');
const Paciente = require('../../Models/Paciente');
const { registrarAuditoria } = require('../auditoria');
const { ErrorHttp, idValido, manejarError } = require('../http');

function tokenDe(req) {
  const h = req.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

async function autenticar(req, res, next) {
  try {
    const r = await sesiones.verificarSesion(tokenDe(req));
    if (!r) return res.status(401).json({ mensaje: 'Sesión no válida o expirada. Inicia sesión de nuevo.' });
    req.usuario = r.usuario;
    req.sesion = r.sesion;
    req.responsable = r.usuario.nombre;
    return next();
  } catch (error) {
    return manejarError(res, error);
  }
}

const exigirPermiso = (permiso) => (req, res, next) => (
  tienePermiso(req.usuario, permiso)
    ? next()
    : res.status(403).json({ mensaje: 'No tienes permiso para realizar esta acción' })
);

/* Evita llenar la bitácora: un evento de acceso por usuario-paciente cada 10 min */
const ultimosAccesos = new Map();
function auditarAcceso(req, pacienteId) {
  const llave = `${req.usuario._id}|${pacienteId}`;
  const ahora = Date.now();
  if (ahora - (ultimosAccesos.get(llave) || 0) < 600000) return;
  ultimosAccesos.set(llave, ahora);
  registrarAuditoria(req, { accion: 'acceso', entidad: 'Expediente', pacienteId });
}

/** Carga el expediente y verifica acceso clínico. Lanza ErrorHttp. */
async function exigirAccesoClinico(req, pacienteId) {
  if (!idValido(pacienteId)) throw new ErrorHttp(400, 'ID de paciente inválido');
  if (!tienePermiso(req.usuario, 'clinico:leer')) throw new ErrorHttp(403, 'Tu rol no tiene acceso a información clínica');
  const expediente = await Expediente.findOne({ pacienteId }).lean();
  if (!expediente) throw new ErrorHttp(404, 'Expediente no encontrado');
  if (!accesoClinico(req.usuario, expediente)) throw new ErrorHttp(403, 'No tienes acceso a este expediente');
  auditarAcceso(req, pacienteId);
  return expediente;
}

/** Middleware para rutas /api/pacientes/:pacienteId/... */
async function accesoPaciente(req, res, next) {
  try {
    req.expediente = await exigirAccesoClinico(req, req.params.pacienteId);
    next();
  } catch (error) {
    manejarError(res, error);
  }
}

/* IDs de los expedientes de los que el usuario es responsable o integrante del equipo */
async function idsDeSusExpedientes(usuario) {
  const lista = await Expediente.find({ $or: [{ responsableId: usuario._id }, { equipoIds: usuario._id }] })
    .select('pacienteId').lean();
  return lista.map((e) => new mongoose.Types.ObjectId(e.pacienteId));
}

/**
 * IDs de pacientes visibles para el usuario en información CLÍNICA:
 * null = todos (superusuario); [] = ninguno (sin permiso clínico).
 */
async function pacientesAccesibles(usuario) {
  if (alcanceGlobal(usuario)) return null;
  if (!tienePermiso(usuario, 'clinico:leer')) return [];
  return idsDeSusExpedientes(usuario);
}

/**
 * IDs de pacientes visibles en datos de IDENTIFICACIÓN (lista de pacientes, agenda):
 * null = todos (superusuario y personal administrativo con pacientes:leer);
 * personal clínico = solo sus expedientes; [] = sin permiso.
 */
async function pacientesIdentificables(usuario) {
  if (alcanceGlobal(usuario)) return null;
  if (clinicoLimitado(usuario)) return idsDeSusExpedientes(usuario);
  if (tienePermiso(usuario, 'pacientes:leer') || tienePermiso(usuario, 'agenda:leer')) {
    // Personal ligado a un consultorio: solo los pacientes de su consultorio
    if (!usuario.consultorioId) return null;
    const lista = await Paciente.find({ consultorioId: usuario.consultorioId }).select('_id').lean();
    return lista.map((p) => p._id);
  }
  return [];
}

/**
 * Ámbito de las ESTADÍSTICAS: el personal clínico ve las de sus expedientes; quien no tiene
 * acceso clínico (administración, docentes) ve agregados de todo el consultorio, anonimizados.
 */
async function ambitoEstadistico(usuario) {
  if (alcanceGlobal(usuario)) return null;
  if (tienePermiso(usuario, 'clinico:leer')) return idsDeSusExpedientes(usuario);
  // Sin acceso clínico: agregados del consultorio propio (o de todos si no tiene consultorio asignado)
  if (!usuario.consultorioId) return null;
  const lista = await Paciente.find({ consultorioId: usuario.consultorioId }).select('_id').lean();
  return lista.map((p) => p._id);
}

/**
 * Contraseña temporal: mientras no la cambie, la cuenta solo puede usar /api/auth
 * (ver su sesión y cambiar la contraseña). Evita que quien creó la cuenta la siga usando.
 */
function exigirCambioContrasena(req, res, next) {
  if (!req.usuario?.debeCambiarContrasena) return next();
  return res.status(403).json({ mensaje: 'Debes cambiar tu contraseña temporal antes de continuar', codigo: 'CAMBIO_CONTRASENA' });
}

/**
 * Cuentas de paciente: solo pueden usar su portal (/api/portal) y su propia sesión.
 * Defensa adicional a los permisos: aunque una ruta no exija permiso, un paciente no entra.
 */
function soloPortalParaPacientes(req, res, next) {
  if (req.usuario?.rol !== 'paciente' || req.path.startsWith('/portal')) return next();
  return res.status(403).json({ mensaje: 'Tu cuenta solo puede consultar tu propia información' });
}

module.exports = {
  autenticar, exigirPermiso, exigirAccesoClinico, accesoPaciente, pacientesAccesibles,
  pacientesIdentificables, ambitoEstadistico, soloPortalParaPacientes, exigirCambioContrasena, tokenDe,
};
