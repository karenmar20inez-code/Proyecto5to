/**
 * Solicitudes de acceso: registro por cuenta propia con aprobación.
 *
 *  POST /api/auth/solicitar-acceso  (pública)  → queda "pendiente"; nunca da acceso por sí sola.
 *  GET  /api/solicitudes             (usuarios:crear) → solicitudes que puedo aprobar.
 *  POST /api/solicitudes/:id/aprobar (usuarios:crear) → crea la cuenta con el rol que decida quien aprueba.
 *  POST /api/solicitudes/:id/rechazar(usuarios:crear)
 *
 * Seguridad: la respuesta pública es la misma exista o no el correo (no revela cuentas);
 * límite de solicitudes por IP; la aprobación respeta la jerarquía de roles y el consultorio.
 */
const SolicitudAcceso = require('../Models/SolicitudAcceso');
const Usuario = require('../Models/Usuario');
const { generarHash, validarPolitica } = require('../Services/seguridad/contrasenas');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');
const { rolesAsignables } = require('../Services/seguridad/permisos');
const { publico } = require('./authController');
const ayudas = require('./usuarioController');

const MENSAJE_PUBLICO = 'Tu solicitud fue enviada. Cuando sea aprobada podrás iniciar sesión con tu correo y la contraseña que elegiste.';

/* Límite por IP (memoria del proceso): SOLICITUDES_MAX_POR_IP por hora (5 por omisión) */
const MAX_POR_IP = Number(process.env.SOLICITUDES_MAX_POR_IP) || 5;
const porIp = new Map();
function limitar(ip) {
  const ahora = Date.now();
  const reg = porIp.get(ip) || { n: 0, desde: ahora };
  if (ahora - reg.desde > 3600000) { reg.n = 0; reg.desde = ahora; }
  reg.n += 1;
  porIp.set(ip, reg);
  if (reg.n > MAX_POR_IP) throw new ErrorHttp(429, 'Demasiadas solicitudes desde esta conexión. Intenta más tarde.');
}

// POST /api/auth/solicitar-acceso  { nombre, correo, telefono, rolSolicitado, cedulaProfesional, mensaje, contrasena }
const solicitar = controlador(async (req, res) => {
  limitar(req.ip);
  const datos = tomarCampos(req.body, ['nombre', 'correo', 'telefono', 'rolSolicitado', 'cedulaProfesional', 'mensaje']);
  ['nombre', 'correo', 'telefono', 'rolSolicitado', 'cedulaProfesional', 'mensaje'].forEach((c) => { if (c in datos) datos[c] = String(datos[c]); });
  const errores = validarPolitica(req.body?.contrasena);
  if (errores.length) throw new ErrorHttp(400, `Contraseña insegura: ${errores.join(', ')}`, { contrasena: errores.join(', ') });

  const solicitud = new SolicitudAcceso({ ...datos, contrasenaHash: 'pendiente', ip: req.ip });
  await solicitud.validate(); // errores de formato antes de revisar duplicados

  // Mismo mensaje si el correo ya tiene cuenta o una solicitud pendiente: no se revela quién está registrado
  const yaExiste = await Usuario.exists({ correo: solicitud.correo })
    || await SolicitudAcceso.exists({ correo: solicitud.correo, estado: 'pendiente' });
  if (!yaExiste) {
    solicitud.contrasenaHash = await generarHash(req.body.contrasena);
    await solicitud.save();
    registrarAuditoria(req, { accion: 'crear', entidad: 'SolicitudAcceso', entidadId: solicitud._id, usuario: { nombre: solicitud.correo }, campos: Object.keys(datos) });
  }
  res.status(202).json({ mensaje: MENSAJE_PUBLICO });
});

// GET /api/solicitudes?estado=pendiente|aprobada|rechazada  → solo los tipos de acceso que puedo aprobar
const listar = controlador(async (req, res) => {
  const filtro = { rolSolicitado: { $in: rolesAsignables(req.usuario) } };
  if (req.query.estado) {
    if (!SolicitudAcceso.ESTADOS_SOLICITUD.includes(String(req.query.estado))) throw new ErrorHttp(400, 'Estado no válido');
    filtro.estado = String(req.query.estado);
  }
  const lista = await SolicitudAcceso.find(filtro).sort({ estado: 1, createdAt: -1 }).limit(500).lean();
  res.json(lista);
});

async function cargarPendiente(id) {
  exigirId(id, 'ID de solicitud');
  const s = await SolicitudAcceso.findById(id).select('+contrasenaHash');
  if (!s) throw new ErrorHttp(404, 'Solicitud no encontrada');
  if (s.estado !== 'pendiente') throw new ErrorHttp(409, `La solicitud ya fue ${s.estado}`);
  return s;
}

// POST /api/solicitudes/:id/aprobar  { rol, nivel, consultorioId, cedulaProfesional, especialidad, pacienteId, responsableId }
const aprobar = controlador(async (req, res) => {
  const s = await cargarPendiente(req.params.id);
  const datos = tomarCampos(req.body, ['rol', 'nivel', 'consultorioId', 'cedulaProfesional', 'especialidad', 'pacienteId']);
  const rol = datos.rol || s.rolSolicitado; // quien aprueba puede asignar otro rol (si le está permitido)
  if (!rolesAsignables(req.usuario).includes(rol) || !rolesAsignables(req.usuario).includes(s.rolSolicitado)) {
    throw new ErrorHttp(403, 'No puedes aprobar esta solicitud con ese rol', { rol: 'Rol no permitido para tu cuenta' });
  }
  if (await Usuario.exists({ correo: s.correo })) throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo');

  const ambito = ayudas.ambitoDe(req.usuario);
  const consultorioId = ambito || datos.consultorioId;
  await ayudas.validarConsultorio(consultorioId);
  if (rol === 'paciente') {
    await ayudas.validarPaciente(datos.pacienteId, undefined, req.usuario);
    await ayudas.validarResponsable(req, datos.pacienteId, req.body?.responsableId);
  }

  const usuario = await Usuario.create({
    nombre: s.nombre,
    correo: s.correo,
    telefono: s.telefono,
    rol,
    ...(rol === 'administrativo' && datos.nivel && { nivel: datos.nivel }),
    ...(consultorioId && rol !== 'paciente' && { consultorioId }),
    ...(rol === 'nutriologo' && { cedulaProfesional: datos.cedulaProfesional || s.cedulaProfesional, especialidad: datos.especialidad }),
    ...(rol === 'paciente' && { pacienteId: datos.pacienteId }),
    contrasenaHash: s.contrasenaHash, // la contraseña que la persona eligió (ya con hash)
    debeCambiarContrasena: false,
    creadoPor: req.usuario._id,
  });
  if (rol === 'paciente') await ayudas.asignarResponsable(req, datos.pacienteId, req.body?.responsableId);

  s.set({ estado: 'aprobada', usuarioId: usuario._id, revisadoPor: req.usuario._id, revisadoPorNombre: req.usuario.nombre, revisadoEn: new Date() });
  await s.save();
  registrarAuditoria(req, { accion: 'revisar', entidad: 'SolicitudAcceso', entidadId: s._id, campos: ['aprobada', rol] });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Usuario', entidadId: usuario._id, campos: ['rol', 'desde solicitud'] });
  res.status(201).json({ solicitud: s.toObject({ transform: (d, r) => { delete r.contrasenaHash; return r; } }), usuario: publico(usuario) });
});

// POST /api/solicitudes/:id/rechazar  { motivo }
const rechazar = controlador(async (req, res) => {
  const s = await cargarPendiente(req.params.id);
  if (!rolesAsignables(req.usuario).includes(s.rolSolicitado)) throw new ErrorHttp(403, 'No puedes revisar esta solicitud');
  s.set({
    estado: 'rechazada', motivoRechazo: req.body?.motivo ? String(req.body.motivo).slice(0, 300) : undefined,
    revisadoPor: req.usuario._id, revisadoPorNombre: req.usuario.nombre, revisadoEn: new Date(),
  });
  await s.save();
  registrarAuditoria(req, { accion: 'revisar', entidad: 'SolicitudAcceso', entidadId: s._id, campos: ['rechazada'] });
  res.json({ mensaje: 'Solicitud rechazada' });
});

/* Inicio de sesión de alguien cuya solicitud aún no tiene cuenta: solo si la contraseña coincide
   se le informa el estado (así no se revela nada a quien no conoce la contraseña). */
async function estadoParaLogin(correo, contrasena, verificar) {
  const s = await SolicitudAcceso.findOne({ correo, estado: { $in: ['pendiente', 'rechazada'] } }).sort({ createdAt: -1 }).select('+contrasenaHash').lean();
  if (!s || !(await verificar(contrasena, s.contrasenaHash))) return null;
  return s.estado === 'pendiente'
    ? 'Tu solicitud de acceso aún está pendiente de aprobación.'
    : `Tu solicitud de acceso fue rechazada${s.motivoRechazo ? `: ${s.motivoRechazo}` : ''}. Comunícate con el consultorio.`;
}

module.exports = { solicitar, listar, aprobar, rechazar, estadoParaLogin, MENSAJE_PUBLICO };
