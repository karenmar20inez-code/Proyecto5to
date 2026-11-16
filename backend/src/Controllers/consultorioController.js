const Consultorio = require('../Models/Consultorio');
const Usuario = require('../Models/Usuario');
const Paciente = require('../Models/Paciente');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');
const { tienePermiso } = require('../Services/seguridad/permisos');

// GET /api/consultorios  → con totales de personal y pacientes (consultorios:leer o usuarios:leer)
const listar = controlador(async (req, res) => {
  if (!tienePermiso(req.usuario, 'consultorios:leer') && !tienePermiso(req.usuario, 'usuarios:leer')) {
    throw new ErrorHttp(403, 'No tienes permiso para consultar consultorios');
  }
  // Personal con consultorio asignado: solo ve el suyo
  const filtro = req.usuario.rol !== 'superusuario' && req.usuario.consultorioId ? { _id: req.usuario.consultorioId } : {};
  const [lista, personal, pacientes] = await Promise.all([
    Consultorio.find(filtro).sort({ activo: -1, nombre: 1 }).lean(),
    Usuario.aggregate([{ $match: { consultorioId: { $ne: null }, rol: { $ne: 'paciente' } } }, { $group: { _id: '$consultorioId', total: { $sum: 1 } } }]),
    Paciente.aggregate([{ $match: { consultorioId: { $ne: null } } }, { $group: { _id: '$consultorioId', total: { $sum: 1 } } }]),
  ]);
  const total = (arr, id) => arr.find((x) => String(x._id) === String(id))?.total || 0;
  res.json(lista.map((c) => ({ ...c, totalPersonal: total(personal, c._id), totalPacientes: total(pacientes, c._id) })));
});

const CAMPOS = ['nombre', 'direccion', 'telefono', 'correo'];

// POST /api/consultorios  (consultorios:gestionar)
const crear = controlador(async (req, res) => {
  const datos = tomarCampos(req.body, CAMPOS);
  const consultorio = await Consultorio.create({ ...datos, creadoPor: req.usuario._id });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Consultorio', entidadId: consultorio._id, campos: Object.keys(datos) });
  res.status(201).json(consultorio);
});

// PUT /api/consultorios/:id  { ...datos, activo }  (consultorios:gestionar)
const actualizar = controlador(async (req, res) => {
  exigirId(req.params.id, 'ID de consultorio');
  const consultorio = await Consultorio.findById(req.params.id);
  if (!consultorio) throw new ErrorHttp(404, 'Consultorio no encontrado');
  const datos = tomarCampos(req.body, CAMPOS);
  ['direccion', 'telefono', 'correo'].forEach((c) => { if (req.body?.[c] === '') datos[c] = undefined; });
  if (typeof req.body?.activo === 'boolean') datos.activo = req.body.activo;
  consultorio.set(datos);
  await consultorio.save();
  registrarAuditoria(req, { accion: datos.activo === false ? 'anular' : 'actualizar', entidad: 'Consultorio', entidadId: consultorio._id, campos: Object.keys(datos) });
  res.json(consultorio);
});

module.exports = { listar, crear, actualizar };
