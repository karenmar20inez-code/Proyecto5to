const crypto = require('crypto');
const Sesion = require('../../Models/Sesion');
const Usuario = require('../../Models/Usuario');

const DURACION_MS = Number(process.env.SESION_HORAS || 12) * 3600000;
const INACTIVIDAD_MS = Number(process.env.SESION_INACTIVIDAD_MIN || 30) * 60000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function crearSesion(usuario, { ip, agente } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  await Sesion.create({
    tokenHash: hashToken(token),
    usuarioId: usuario._id,
    expira: new Date(Date.now() + DURACION_MS),
    ip,
    agente: agente?.slice(0, 300),
  });
  return { token, expira: new Date(Date.now() + DURACION_MS), inactividadMin: INACTIVIDAD_MS / 60000 };
}

/** Devuelve { usuario, sesion } o null. Renueva la actividad (máx. cada minuto). */
async function verificarSesion(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const sesion = await Sesion.findOne({ tokenHash: hashToken(token), revocada: false });
  if (!sesion) return null;
  const ahora = Date.now();
  if (sesion.expira.getTime() < ahora || ahora - sesion.ultimaActividad.getTime() > INACTIVIDAD_MS) {
    sesion.revocada = true;
    await sesion.save();
    return null;
  }
  const usuario = await Usuario.findById(sesion.usuarioId).lean();
  if (!usuario || !usuario.activo) return null;
  if (ahora - sesion.ultimaActividad.getTime() > 60000) {
    await Sesion.updateOne({ _id: sesion._id }, { $set: { ultimaActividad: new Date() } });
  }
  return { usuario, sesion };
}

const revocarSesion = (token) => Sesion.updateOne({ tokenHash: hashToken(token) }, { $set: { revocada: true } });
const revocarSesionesDe = (usuarioId) => Sesion.updateMany({ usuarioId, revocada: false }, { $set: { revocada: true } });

module.exports = { crearSesion, verificarSesion, revocarSesion, revocarSesionesDe, hashToken, INACTIVIDAD_MS };
