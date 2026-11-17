const mongoose = require('mongoose');
const Paciente = require('../Models/Paciente');
const Expediente = require('../Models/Expediente');
const Usuario = require('../Models/Usuario');
const { edadEnFecha } = require('../Models/Paciente');
const { registrarAuditoria } = require('../Services/auditoria');
const { pacientesIdentificables, exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso, alcanceGlobal } = require('../Services/seguridad/permisos');

/* Información nutricional del paciente: solo para personal con acceso clínico */
const CAMPOS_NUTRICIONALES = ['peso', 'estatura', 'dietaId'];
const sinNutricionales = (req, obj) => {
  if (tienePermiso(req.usuario, 'clinico:leer')) return obj;
  const copia = { ...obj };
  CAMPOS_NUTRICIONALES.forEach((c) => delete copia[c]);
  return copia;
};
const { ErrorHttp, exigirId, controlador } = require('../Services/http');

// Solo estos campos pueden venir del cliente
const CAMPOS = [
  'nombreCompleto', 'fechaNacimiento', 'edad', 'curp', 'correo', 'telefono', 'direccion', 'ocupacion',
  'contactoEmergencia', 'sexo', 'objetivo', 'peso', 'estatura', 'fechaRegistro', 'estado', 'dietaId',
];
const OPCIONALES = ['sexo', 'peso', 'estatura', 'curp', 'direccion', 'ocupacion', 'fechaNacimiento'];

/* Colecciones con información clínica: si existe alguna, el paciente no se elimina (NOM-004) */
const COLECCIONES_CLINICAS = ['mediciones', 'consultas', 'antecedentes', 'laboratorios', 'diagnosticos', 'objetivos', 'planes', 'prescripciones', 'adherencias'];

function prepararDatos(body = {}) {
  const set = {};
  const unset = {};
  CAMPOS.forEach((c) => {
    if (!(c in body)) return;
    const v = body[c];
    if ((v === '' || v === null) && OPCIONALES.includes(c)) unset[c] = '';
    else set[c] = v;
  });
  if (set.fechaNacimiento) set.edad = edadEnFecha(set.fechaNacimiento);
  return { set, unset };
}

const conEdad = (p, expediente) => ({
  ...p,
  edadActual: p.fechaNacimiento ? edadEnFecha(p.fechaNacimiento) : p.edad,
  ...(expediente && { expediente: { folio: expediente.folio, estado: expediente.estado, responsableId: expediente.responsableId } }),
});

async function exigirVisible(req, id) {
  exigirId(id, 'ID de paciente');
  const ids = await pacientesIdentificables(req.usuario);
  // personal administrativo: identificación de todos; personal clínico: solo sus expedientes
  if (ids && !ids.some((x) => String(x) === String(id))) {
    throw new ErrorHttp(403, 'No tienes acceso a este paciente');
  }
}

// GET /api/pacientes
const obtenerPacientes = controlador(async (req, res) => {
  const filtro = {};
  const ids = await pacientesIdentificables(req.usuario);
  if (ids) filtro._id = { $in: ids };
  const [pacientes, expedientes] = await Promise.all([
    Paciente.find(filtro).sort({ fechaRegistro: -1 }).lean(),
    Expediente.find(filtro._id ? { pacienteId: filtro._id } : {}).select('pacienteId folio estado responsableId').lean(),
  ]);
  const porPaciente = new Map(expedientes.map((e) => [String(e.pacienteId), e]));
  res.json(pacientes.map((p) => sinNutricionales(req, conEdad(p, porPaciente.get(String(p._id))))));
});

// GET /api/pacientes/:id
const obtenerPaciente = controlador(async (req, res) => {
  await exigirVisible(req, req.params.id);
  const paciente = await Paciente.findById(req.params.id).lean();
  if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado');
  res.json(sinNutricionales(req, conEdad(paciente, await Expediente.findOne({ pacienteId: paciente._id }).lean())));
});

// POST /api/pacientes  { ...datos, responsableId?, motivoConsulta? }
const crearPaciente = controlador(async (req, res) => {
  const { set } = prepararDatos(sinNutricionales(req, req.body || {}));

  let responsableId = req.body?.responsableId;
  if (req.usuario.rol === 'nutriologo') responsableId = req.usuario._id; // el nutriólogo registra pacientes para sí mismo
  if (!responsableId) throw new ErrorHttp(400, 'Indica el profesional responsable del expediente', { responsableId: 'Obligatorio' });
  exigirId(responsableId, 'ID de responsable');
  const responsable = await Usuario.findOne({ _id: responsableId, rol: 'nutriologo', activo: true }).lean();
  // El responsable siempre es un nutriólogo activo (el superusuario puede quedar como responsable de supervisión)
  if (!responsable && !(alcanceGlobal(req.usuario) && String(responsableId) === String(req.usuario._id))) {
    throw new ErrorHttp(400, 'El responsable debe ser un nutriólogo activo', { responsableId: 'No válido' });
  }

  // Consultorio: el de quien registra (si tiene uno) o el del nutriólogo responsable
  const consultorioId = req.usuario.consultorioId || responsable?.consultorioId;
  const paciente = await Paciente.create({ ...set, ...(consultorioId && { consultorioId }) });
  try {
    const expediente = await Expediente.create({
      pacienteId: paciente._id,
      folio: await Expediente.siguienteFolio(),
      responsableId,
      motivoConsulta: req.body?.motivoConsulta,
      fechaIngreso: set.fechaRegistro || new Date(),
    });
    registrarAuditoria(req, { accion: 'crear', entidad: 'Paciente', entidadId: paciente._id, pacienteId: paciente._id, campos: Object.keys(set) });
    res.status(201).json(sinNutricionales(req, conEdad(paciente.toObject(), expediente)));
  } catch (error) {
    await Paciente.deleteOne({ _id: paciente._id }); // no dejar pacientes sin expediente
    throw error;
  }
});

// PUT /api/pacientes/:id
const actualizarPaciente = controlador(async (req, res) => {
  const { id } = req.params;
  await exigirVisible(req, id);
  const { set, unset } = prepararDatos(sinNutricionales(req, req.body || {}));
  if (!Object.keys(set).length && !Object.keys(unset).length) throw new ErrorHttp(400, 'No se enviaron campos para actualizar');

  const cambios = {};
  if (Object.keys(set).length) cambios.$set = set;
  if (Object.keys(unset).length) cambios.$unset = unset;
  const paciente = await Paciente.findByIdAndUpdate(id, cambios, { returnDocument: 'after', runValidators: true });
  if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado');

  registrarAuditoria(req, {
    accion: 'actualizar', entidad: 'Paciente', entidadId: paciente._id, pacienteId: paciente._id,
    campos: [...Object.keys(set), ...Object.keys(unset)],
  });
  res.json(conEdad(paciente.toObject(), await Expediente.findOne({ pacienteId: id }).lean()));
});

// DELETE /api/pacientes/:id  (solo administrador y solo sin información clínica)
const eliminarPaciente = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de paciente');
  if (!tienePermiso(req.usuario, '*')) throw new ErrorHttp(403, 'Solo un administrador puede eliminar pacientes');

  const db = mongoose.connection.db;
  const conRegistros = [];
  for (const c of COLECCIONES_CLINICAS) {
    // eslint-disable-next-line no-await-in-loop
    if (await db.collection(c).countDocuments({ pacienteId: new mongoose.Types.ObjectId(id) }, { limit: 1 })) conRegistros.push(c);
  }
  if (conRegistros.length) {
    throw new ErrorHttp(409, 'El paciente tiene información clínica: por conservación del expediente (NOM-004-SSA3-2012) no se elimina. Cambia su estado a "baja".');
  }

  const paciente = await Paciente.findByIdAndDelete(id);
  if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado');
  await Expediente.deleteOne({ pacienteId: id });
  // Su cuenta del portal (si tenía) deja de existir
  const { eliminarCuenta } = require('./usuarioController'); // eslint-disable-line global-require
  const cuentas = await Usuario.find({ pacienteId: id, eliminado: { $ne: true } });
  for (const cuenta of cuentas) await eliminarCuenta(req, cuenta); // eslint-disable-line no-await-in-loop
  registrarAuditoria(req, { accion: 'eliminar', entidad: 'Paciente', entidadId: paciente._id, pacienteId: paciente._id });
  res.json({ mensaje: 'Paciente eliminado correctamente', id });
});

module.exports = {
  obtenerPacientes, obtenerPaciente, crearPaciente, actualizarPaciente, eliminarPaciente, exigirAccesoClinico,
};
