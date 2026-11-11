/**
 * Middleware de autenticación y autorización.
 * Todas las rutas /api (salvo /api/auth/login) pasan por `autenticar`.
 */
const mongoose = require('mongoose');
const sesiones = require('./sesiones');
const { tienePermiso, accesoClinico } = require('./permisos');
const Expediente = require('../../Models/Expediente');
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

/**
 * IDs de pacientes visibles para el usuario en información clínica:
 * null = todos (administrador); [] = ninguno.
 */
async function pacientesAccesibles(usuario) {
  if (usuario.rol === 'administrador') return null;
  if (usuario.rol !== 'nutriologo') return [];
  const lista = await Expediente.find({ $or: [{ responsableId: usuario._id }, { equipoIds: usuario._id }] })
    .select('pacienteId').lean();
  return lista.map((e) => new mongoose.Types.ObjectId(e.pacienteId));
}

module.exports = { autenticar, exigirPermiso, exigirAccesoClinico, accesoPaciente, pacientesAccesibles, tokenDe };
