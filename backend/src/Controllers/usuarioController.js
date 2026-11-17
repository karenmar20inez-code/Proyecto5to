const Usuario = require('../Models/Usuario');
const Paciente = require('../Models/Paciente');
const Expediente = require('../Models/Expediente');
const Consultorio = require('../Models/Consultorio');
const { generarHash, validarPolitica } = require('../Services/seguridad/contrasenas');
const { revocarSesionesDe } = require('../Services/seguridad/sesiones');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');
const {
  ROLES, CATALOGO_PERMISOS, tienePermiso, alcanceGlobal, nivelDe, rolesAsignables, puedeGestionar, permisosConcedibles,
} = require('../Services/seguridad/permisos');
const { publico } = require('./authController');

const conEstado = (u, extra = {}) => ({ ...publico(u), activo: u.activo, ultimoAcceso: u.ultimoAcceso, createdAt: u.createdAt, ...extra });

/* Ámbito de consultorio: el personal (no superusuario) ligado a un consultorio solo gestiona ese consultorio */
const ambitoDe = (actor) => (actor.rol !== 'superusuario' && actor.consultorioId ? String(actor.consultorioId) : null);

async function validarConsultorio(id) {
  if (!id) return;
  exigirId(id, 'ID de consultorio');
  if (!await Consultorio.exists({ _id: id, activo: true })) throw new ErrorHttp(400, 'El consultorio no existe o está inactivo', { consultorioId: 'No válido' });
}

/* Valida el nutriólogo responsable ANTES de guardar nada (para no dejar cambios a medias) */
async function validarResponsable(req, pacienteId, responsableId) {
  if (!responsableId) return;
  exigirId(responsableId, 'ID de nutriólogo responsable');
  const nutri = await Usuario.findOne({ _id: responsableId, rol: 'nutriologo', activo: true }).lean();
  if (!nutri) throw new ErrorHttp(400, 'El responsable debe ser un nutriólogo activo', { responsableId: 'No válido' });
  const ambito = ambitoDe(req.usuario);
  if (ambito && String(nutri.consultorioId) !== ambito) throw new ErrorHttp(403, 'El nutriólogo debe pertenecer a tu consultorio', { responsableId: 'Fuera de tu consultorio' });
  const expediente = await Expediente.findOne({ pacienteId }).select('responsableId').lean();
  if (!expediente) throw new ErrorHttp(404, 'El paciente no tiene expediente');
  // Cambiar el responsable transfiere el acceso clínico: solo el superusuario (igual que en el expediente)
  if (String(expediente.responsableId) !== String(responsableId) && !alcanceGlobal(req.usuario)) {
    throw new ErrorHttp(403, 'Solo el superusuario o el nutriólogo responsable (desde el expediente) puede transferir el expediente', { responsableId: 'No permitido' });
  }
}

/* Asocia el paciente con su nutriólogo responsable (responsable del expediente). Ya validado. */
async function asignarResponsable(req, pacienteId, responsableId) {
  if (!responsableId) return;
  const r = await Expediente.updateOne({ pacienteId }, { $set: { responsableId } });
  if (!r.matchedCount) throw new ErrorHttp(404, 'El paciente no tiene expediente');
  if (r.modifiedCount) registrarAuditoria(req, { accion: 'actualizar', entidad: 'Expediente', pacienteId, campos: ['responsableId'] });
}
const escaparRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Roles que el usuario puede ver en el listado: los de nivel inferior (el superusuario ve todos).
   El supervisor administrativo además ve al personal administrativo. */
function rolesVisibles(actor) {
  if (actor.rol === 'superusuario') return Object.keys(ROLES);
  const roles = Object.keys(ROLES).filter((r) => nivelDe(r) < nivelDe(actor.rol));
  if (actor.rol === 'administrativo') roles.push('administrativo', 'asistente');
  return roles;
}

/* Valida los permisos extra: solo del catálogo y solo los que el actor tiene (sin escalar privilegios) */
function validarPermisos(actor, lista, campo) {
  if (lista === undefined) return undefined;
  if (!Array.isArray(lista)) throw new ErrorHttp(400, `${campo} debe ser una lista`, { [campo]: 'Formato no válido' });
  const unicos = [...new Set(lista.map(String))];
  const desconocidos = unicos.filter((p) => !CATALOGO_PERMISOS[p]);
  if (desconocidos.length) throw new ErrorHttp(400, `Permisos desconocidos: ${desconocidos.join(', ')}`, { [campo]: 'Permiso no válido' });
  if (campo === 'permisosExtra') {
    const concedibles = permisosConcedibles(actor);
    const prohibidos = unicos.filter((p) => !concedibles.includes(p));
    if (prohibidos.length) throw new ErrorHttp(403, `No puedes conceder permisos que no tienes: ${prohibidos.join(', ')}`, { permisosExtra: 'Escalamiento no permitido' });
  }
  return unicos;
}

/* Cuenta de paciente: el paciente debe existir, estar en el ámbito del actor y no tener ya otra cuenta */
async function validarPaciente(pacienteId, excepto, actor) {
  exigirId(pacienteId, 'ID de paciente');
  const paciente = await Paciente.findById(pacienteId).select('consultorioId').lean();
  if (!paciente) throw new ErrorHttp(400, 'El paciente no existe', { pacienteId: 'No válido' });
  const ambito = actor ? ambitoDe(actor) : null;
  if (ambito && String(paciente.consultorioId) !== ambito) throw new ErrorHttp(403, 'Ese paciente no pertenece a tu consultorio', { pacienteId: 'Fuera de tu consultorio' });
  if (await Usuario.exists({ pacienteId, _id: { $ne: excepto } })) {
    throw new ErrorHttp(409, 'Ese paciente ya tiene una cuenta de acceso', { pacienteId: 'Ya tiene cuenta' });
  }
}

// GET /api/usuarios?rol=&buscar=&activo=   (usuarios:leer)
const listar = controlador(async (req, res) => {
  const visibles = rolesVisibles(req.usuario);
  const filtro = { $or: [{ rol: { $in: visibles } }, { _id: req.usuario._id }] };
  if (req.query.rol) {
    if (!visibles.includes(req.query.rol)) return res.json([]);
    filtro.rol = req.query.rol;
  }
  if (req.query.activo === 'true' || req.query.activo === 'false') filtro.activo = req.query.activo === 'true';
  const ambito = ambitoDe(req.usuario);
  if (ambito) filtro.consultorioId = ambito;
  if (req.query.consultorioId) {
    if (ambito && req.query.consultorioId !== ambito) return res.json([]);
    filtro.consultorioId = exigirId(req.query.consultorioId, 'ID de consultorio');
  }
  if (req.query.buscar) {
    const re = new RegExp(escaparRegex(String(req.query.buscar).slice(0, 80)), 'i');
    filtro.$and = [{ $or: [{ nombre: re }, { correo: re }] }];
  }
  const usuarios = await Usuario.find(filtro).sort({ nombre: 1 }).limit(1000).lean();
  // Cuentas de paciente: nutriólogo responsable de su expediente
  const pacienteIds = usuarios.filter((x) => x.pacienteId).map((x) => x.pacienteId);
  const expedientes = pacienteIds.length ? await Expediente.find({ pacienteId: { $in: pacienteIds } }).select('pacienteId responsableId').lean() : [];
  const responsable = (pid) => expedientes.find((e) => String(e.pacienteId) === String(pid))?.responsableId;
  res.json(usuarios.map((x) => conEstado(x, x.pacienteId ? { responsableId: responsable(x.pacienteId) } : {})));
});

// GET /api/usuarios/roles  → catálogo para el formulario (solo lo que este usuario puede asignar)
const catalogo = controlador(async (req, res) => {
  const asignables = rolesAsignables(req.usuario);
  res.json({
    roles: Object.entries(ROLES).filter(([k, r]) => !r.oculto).map(([clave, r]) => ({
      clave, nombre: r.nombre, descripcion: r.descripcion, nivel: r.nivel, asignable: asignables.includes(clave),
      niveles: r.niveles ? Object.entries(r.niveles).map(([k, n]) => ({ clave: k, nombre: n.nombre, permisos: n.permisos })) : undefined,
      permisos: r.permisos,
    })),
    permisos: Object.entries(CATALOGO_PERMISOS).map(([clave, descripcion]) => ({ clave, descripcion })),
    concedibles: permisosConcedibles(req.usuario),
  });
});

// GET /api/usuarios/profesionales  (cualquier usuario autenticado: para elegir responsable)
const profesionales = controlador(async (req, res) => {
  const ambito = ambitoDe(req.usuario);
  const lista = await Usuario.find({ rol: 'nutriologo', activo: true, ...(ambito && { consultorioId: ambito }) }).select('nombre cedulaProfesional').sort({ nombre: 1 }).lean();
  res.json(lista);
});

const CAMPOS = ['nombre', 'correo', 'telefono', 'rol', 'nivel', 'cedulaProfesional', 'especialidad', 'pacienteId', 'consultorioId'];

// POST /api/usuarios  { nombre, correo, telefono, rol, nivel?, cedulaProfesional?, especialidad?, pacienteId?, permisosExtra?, permisosRevocados?, contrasenaTemporal }
const crear = controlador(async (req, res) => {
  const datos = tomarCampos(req.body, CAMPOS);
  if (!datos.rol || !rolesAsignables(req.usuario).includes(datos.rol)) {
    throw new ErrorHttp(403, 'No puedes crear cuentas con ese rol', { rol: 'Rol no permitido para tu cuenta' });
  }
  if (datos.rol === 'paciente') await validarPaciente(datos.pacienteId, undefined, req.usuario);
  const ambito = ambitoDe(req.usuario);
  if (ambito) datos.consultorioId = ambito; // el personal de un consultorio solo registra en el suyo
  await validarConsultorio(datos.consultorioId);
  if (datos.rol === 'paciente') await validarResponsable(req, datos.pacienteId, req.body?.responsableId);
  const permisosExtra = validarPermisos(req.usuario, req.body?.permisosExtra, 'permisosExtra');
  const permisosRevocados = validarPermisos(req.usuario, req.body?.permisosRevocados, 'permisosRevocados');

  const errores = validarPolitica(req.body?.contrasenaTemporal);
  if (errores.length) throw new ErrorHttp(400, `Contraseña temporal insegura: ${errores.join(', ')}`, { contrasenaTemporal: errores.join(', ') });

  const usuario = await Usuario.create({
    ...datos,
    ...(permisosExtra && { permisosExtra }),
    ...(permisosRevocados && { permisosRevocados }),
    contrasenaHash: await generarHash(req.body.contrasenaTemporal),
    debeCambiarContrasena: true,
    // Estado inicial de la cuenta (por omisión activa); crearla inactiva requiere permiso de estado
    ...(req.body?.activo === false && tienePermiso(req.usuario, 'usuarios:estado') && { activo: false }),
    creadoPor: req.usuario._id,
  });
  if (datos.rol === 'paciente') await asignarResponsable(req, datos.pacienteId, req.body?.responsableId);
  registrarAuditoria(req, { accion: 'crear', entidad: 'Usuario', entidadId: usuario._id, campos: [...Object.keys(datos), ...(permisosExtra ? ['permisosExtra'] : [])] });
  res.status(201).json(conEstado(usuario.toObject()));
});

// PUT /api/usuarios/:id  { nombre, correo, telefono, rol, nivel, cedulaProfesional, especialidad, pacienteId, permisosExtra, permisosRevocados, activo }
const actualizar = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de usuario');
  if (String(id) === String(req.usuario._id)) {
    throw new ErrorHttp(403, 'No puedes modificar tu propia cuenta desde Administración (rol, permisos ni estado). Usa "Mi perfil".');
  }
  const usuario = await Usuario.findById(id);
  if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado');
  if (!puedeGestionar(req.usuario, usuario)) throw new ErrorHttp(403, 'No puedes gestionar una cuenta de tu mismo nivel o superior');
  const ambito = ambitoDe(req.usuario);
  if (ambito && String(usuario.consultorioId) !== ambito) throw new ErrorHttp(403, 'Esa cuenta no pertenece a tu consultorio');

  const datos = tomarCampos(req.body, CAMPOS);
  const soloEstado = Object.keys(datos).length === 0 && req.body?.permisosExtra === undefined
    && req.body?.permisosRevocados === undefined && !req.body?.responsableId;
  if (!soloEstado && !tienePermiso(req.usuario, 'usuarios:editar')) throw new ErrorHttp(403, 'No tienes permiso para modificar cuentas');
  if (typeof req.body?.activo === 'boolean') {
    if (!tienePermiso(req.usuario, 'usuarios:estado')) throw new ErrorHttp(403, 'No tienes permiso para activar o desactivar cuentas');
    datos.activo = req.body.activo;
  }
  if (datos.rol && datos.rol !== usuario.rol && !rolesAsignables(req.usuario).includes(datos.rol)) {
    throw new ErrorHttp(403, 'No puedes asignar ese rol', { rol: 'Rol no permitido para tu cuenta' });
  }
  if ('consultorioId' in datos) {
    if (ambito && String(datos.consultorioId) !== ambito) throw new ErrorHttp(403, 'No puedes mover cuentas a otro consultorio', { consultorioId: 'Fuera de tu consultorio' });
    await validarConsultorio(datos.consultorioId);
  }
  if (req.body?.consultorioId === '' && !ambito) datos.consultorioId = undefined; // quitar consultorio (ámbito general)
  const rolFinal = datos.rol || usuario.rol;
  // Re-ligar una cuenta existente a OTRO paciente: solo el superusuario (queda en auditoría)
  if (datos.pacienteId && usuario.pacienteId && String(datos.pacienteId) !== String(usuario.pacienteId) && !alcanceGlobal(req.usuario)) {
    throw new ErrorHttp(403, 'Solo el superusuario puede ligar la cuenta a otro paciente', { pacienteId: 'No permitido' });
  }
  if (rolFinal === 'paciente' && (datos.pacienteId || datos.rol === 'paciente')) await validarPaciente(datos.pacienteId || usuario.pacienteId, usuario._id, req.usuario);
  const permisosExtra = validarPermisos(req.usuario, req.body?.permisosExtra, 'permisosExtra');
  const permisosRevocados = validarPermisos(req.usuario, req.body?.permisosRevocados, 'permisosRevocados');
  if (permisosExtra) datos.permisosExtra = permisosExtra;
  if (permisosRevocados) datos.permisosRevocados = permisosRevocados;

  if (rolFinal === 'paciente') await validarResponsable(req, datos.pacienteId || usuario.pacienteId, req.body?.responsableId);
  usuario.set(datos);
  await usuario.save();
  if (rolFinal === 'paciente' && req.body?.responsableId) await asignarResponsable(req, usuario.pacienteId, req.body.responsableId);
  // Cambios de acceso: se cierran sus sesiones para que entren con los permisos nuevos
  if (['activo', 'rol', 'nivel', 'permisosExtra', 'permisosRevocados', 'correo', 'consultorioId'].some((c) => c in datos)) await revocarSesionesDe(usuario._id);
  registrarAuditoria(req, {
    accion: datos.activo === false ? 'anular' : 'actualizar', entidad: 'Usuario', entidadId: usuario._id, campos: Object.keys(datos),
  });
  res.json(conEstado(usuario.toObject()));
});

module.exports = {
  listar, catalogo, profesionales, crear, actualizar, rolesVisibles,
  // reutilizadas al aprobar solicitudes de acceso
  ambitoDe, validarConsultorio, validarPaciente, validarResponsable, asignarResponsable,
};
