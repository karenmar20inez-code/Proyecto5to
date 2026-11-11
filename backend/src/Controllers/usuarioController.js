const Usuario = require('../Models/Usuario');
const { generarHash, validarPolitica } = require('../Services/seguridad/contrasenas');
const { revocarSesionesDe } = require('../Services/seguridad/sesiones');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');
const { publico } = require('./authController');

// GET /api/usuarios  (administrador) · ?rol=nutriologo para listas de selección
const listar = controlador(async (req, res) => {
  const filtro = {};
  if (req.query.rol) filtro.rol = req.query.rol;
  const usuarios = await Usuario.find(filtro).sort({ nombre: 1 }).lean();
  res.json(usuarios.map((u) => ({ ...publico(u), activo: u.activo, ultimoAcceso: u.ultimoAcceso })));
});

// GET /api/usuarios/profesionales  (cualquier usuario autenticado: para elegir responsable)
const profesionales = controlador(async (req, res) => {
  const lista = await Usuario.find({ rol: 'nutriologo', activo: true }).select('nombre cedulaProfesional').sort({ nombre: 1 }).lean();
  res.json(lista);
});

// POST /api/usuarios  { nombre, correo, rol, cedulaProfesional, contrasenaTemporal }
const crear = controlador(async (req, res) => {
  const datos = tomarCampos(req.body, ['nombre', 'correo', 'rol', 'cedulaProfesional']);
  const errores = validarPolitica(req.body?.contrasenaTemporal);
  if (errores.length) throw new ErrorHttp(400, `Contraseña temporal insegura: ${errores.join(', ')}`, { contrasenaTemporal: errores.join(', ') });
  const usuario = await Usuario.create({
    ...datos,
    contrasenaHash: await generarHash(req.body.contrasenaTemporal),
    debeCambiarContrasena: true,
  });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Usuario', entidadId: usuario._id, campos: Object.keys(datos) });
  res.status(201).json(publico(usuario));
});

// PUT /api/usuarios/:id  { nombre, rol, cedulaProfesional, activo }
const actualizar = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de usuario');
  const datos = tomarCampos(req.body, ['nombre', 'rol', 'cedulaProfesional']);
  if (typeof req.body?.activo === 'boolean') datos.activo = req.body.activo;
  if (String(id) === String(req.usuario._id) && (datos.activo === false || (datos.rol && datos.rol !== 'administrador'))) {
    throw new ErrorHttp(409, 'No puedes desactivarte ni quitarte el rol de administrador');
  }
  const usuario = await Usuario.findByIdAndUpdate(id, { $set: datos }, { returnDocument: 'after', runValidators: true });
  if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado');
  if (datos.activo === false || datos.rol) await revocarSesionesDe(usuario._id);
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Usuario', entidadId: usuario._id, campos: Object.keys(datos) });
  res.json(publico(usuario));
});

module.exports = { listar, profesionales, crear, actualizar };
