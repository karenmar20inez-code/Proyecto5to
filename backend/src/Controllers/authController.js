const Usuario = require('../Models/Usuario');
const { verificar, validarPolitica, generarHash } = require('../Services/seguridad/contrasenas');
const sesiones = require('../Services/seguridad/sesiones');
const { permisosDe, ROLES } = require('../Services/seguridad/permisos');
const { tokenDe } = require('../Services/seguridad/middleware');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, controlador } = require('../Services/http');

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60000;

/* Límite por IP (memoria del proceso): 20 intentos cada 15 minutos (LOGIN_MAX_POR_IP lo ajusta, p. ej. en pruebas) */
const MAX_POR_IP = Number(process.env.LOGIN_MAX_POR_IP) || 20;
const intentosPorIp = new Map();
function limitarIp(ip) {
  const ahora = Date.now();
  const reg = intentosPorIp.get(ip) || { n: 0, desde: ahora };
  if (ahora - reg.desde > BLOQUEO_MS) { reg.n = 0; reg.desde = ahora; }
  reg.n += 1;
  intentosPorIp.set(ip, reg);
  if (reg.n > MAX_POR_IP) throw new ErrorHttp(429, 'Demasiados intentos. Espera unos minutos.');
}

/* Datos públicos de la cuenta + permisos efectivos (el frontend los usa solo para mostrar u ocultar opciones) */
const publico = (u) => ({
  _id: u._id, nombre: u.nombre, correo: u.correo, telefono: u.telefono, rol: u.rol, nombreRol: ROLES[u.rol]?.nombre,
  nivel: u.nivel, consultorioId: u.consultorioId, cedulaProfesional: u.cedulaProfesional, especialidad: u.especialidad, pacienteId: u.pacienteId,
  debeCambiarContrasena: u.debeCambiarContrasena, permisos: permisosDe(u),
});

// POST /api/auth/login { correo, contrasena }
const login = controlador(async (req, res) => {
  limitarIp(req.ip);
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  const contrasena = String(req.body?.contrasena || '');
  if (!correo || !contrasena) throw new ErrorHttp(400, 'Escribe tu correo y contraseña');

  const usuario = await Usuario.findOne({ correo }).select('+contrasenaHash +intentosFallidos +bloqueadoHasta');
  const incorrecto = new ErrorHttp(401, 'Correo o contraseña incorrectos');
  if (!usuario || !usuario.activo) {
    registrarAuditoria(req, { accion: 'login_fallido', entidad: 'Sesion', usuario: { nombre: correo } });
    if (!usuario) {
      // ¿Pidió acceso y aún no tiene cuenta? Solo se le informa si la contraseña coincide con la de su solicitud
      const { estadoParaLogin } = require('./solicitudController'); // eslint-disable-line global-require
      const estado = await estadoParaLogin(correo, contrasena, verificar);
      if (estado) throw new ErrorHttp(403, estado);
    }
    throw incorrecto;
  }
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    throw new ErrorHttp(423, 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta en 15 minutos.');
  }
  if (!(await verificar(contrasena, usuario.contrasenaHash))) {
    usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;
    if (usuario.intentosFallidos >= MAX_INTENTOS) {
      usuario.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MS);
      usuario.intentosFallidos = 0;
    }
    await usuario.save();
    registrarAuditoria(req, { accion: 'login_fallido', entidad: 'Sesion', usuario });
    throw incorrecto;
  }

  usuario.intentosFallidos = 0;
  usuario.bloqueadoHasta = undefined;
  usuario.ultimoAcceso = new Date();
  await usuario.save();

  const sesion = await sesiones.crearSesion(usuario, { ip: req.ip, agente: req.get('User-Agent') });
  registrarAuditoria(req, { accion: 'login', entidad: 'Sesion', usuario });
  res.json({ token: sesion.token, expira: sesion.expira, inactividadMin: sesion.inactividadMin, usuario: publico(usuario) });
});

// POST /api/auth/logout
const logout = controlador(async (req, res) => {
  await sesiones.revocarSesion(tokenDe(req));
  registrarAuditoria(req, { accion: 'logout', entidad: 'Sesion' });
  res.json({ mensaje: 'Sesión cerrada' });
});

// GET /api/auth/yo
const yo = controlador(async (req, res) => res.json(publico(req.usuario)));

// POST /api/auth/cambiar-contrasena { actual, nueva }
const cambiarContrasena = controlador(async (req, res) => {
  const { actual, nueva } = req.body || {};
  const usuario = await Usuario.findById(req.usuario._id).select('+contrasenaHash');
  if (!(await verificar(String(actual || ''), usuario.contrasenaHash))) throw new ErrorHttp(400, 'La contraseña actual no es correcta');
  const errores = validarPolitica(nueva);
  if (errores.length) throw new ErrorHttp(400, `Contraseña insegura: ${errores.join(', ')}`);
  usuario.contrasenaHash = await generarHash(nueva);
  usuario.debeCambiarContrasena = false;
  await usuario.save();
  await sesiones.revocarSesionesDe(usuario._id);
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Usuario', entidadId: usuario._id, campos: ['contrasena'] });
  res.json({ mensaje: 'Contraseña actualizada. Inicia sesión de nuevo.' });
});

module.exports = { login, logout, yo, cambiarContrasena, publico };
