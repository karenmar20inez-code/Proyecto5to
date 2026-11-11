const mongoose = require('mongoose');
const Antecedente = require('../Models/Antecedente');
const Consulta = require('../Models/Consulta');
const { CATEGORIAS } = require('../Models/Antecedente');
const { evaluarEnSegundoPlano } = require('../Services/clinica/alertas');
const { registrarAuditoria } = require('../Services/auditoria');
const { exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');

const CAMPOS = ['categoria', 'descripcion', 'codigo', 'detalle', 'fechaInicio', 'fechaFin', 'estado', 'observaciones', 'consultaId'];

const exigirEscritura = (req) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'No tienes permiso para modificar la historia clínica');
};

async function validarConsulta(consultaId, pacienteId) {
  if (!consultaId) return;
  exigirId(consultaId, 'ID de consulta');
  if (!(await Consulta.exists({ _id: consultaId, pacienteId }))) throw new ErrorHttp(400, 'La consulta no pertenece a este paciente');
}

// GET /api/pacientes/:pacienteId/antecedentes?historico=1
const listar = controlador(async (req, res) => {
  const filtro = { pacienteId: req.params.pacienteId };
  if (!['1', 'true'].includes(String(req.query.historico))) filtro.vigente = true;
  const lista = await Antecedente.find(filtro).sort({ categoria: 1, version: -1, fechaInicio: -1 }).lean();
  res.json({ categorias: CATEGORIAS, antecedentes: lista });
});

// POST /api/pacientes/:pacienteId/antecedentes
const crear = controlador(async (req, res) => {
  exigirEscritura(req);
  const { pacienteId } = req.params;
  const datos = tomarCampos(req.body, CAMPOS);
  await validarConsulta(datos.consultaId, pacienteId);
  const a = await Antecedente.create({
    ...datos, pacienteId, registradoPor: req.usuario._id, registradoPorNombre: req.usuario.nombre,
    grupoId: new mongoose.Types.ObjectId(), version: 1,
  });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Antecedente', entidadId: a._id, pacienteId, campos: Object.keys(datos) });
  evaluarEnSegundoPlano(pacienteId);
  res.status(201).json(a);
});

// PUT /api/antecedentes/:id  → nueva versión (la anterior se conserva)
const actualizar = controlador(async (req, res) => {
  exigirEscritura(req);
  exigirId(req.params.id, 'ID de antecedente');
  const anterior = await Antecedente.findById(req.params.id);
  if (!anterior) throw new ErrorHttp(404, 'Antecedente no encontrado');
  await exigirAccesoClinico(req, anterior.pacienteId);
  if (!anterior.vigente) throw new ErrorHttp(409, 'Solo se actualiza la versión vigente');

  const cambios = tomarCampos(req.body, CAMPOS.filter((c) => c !== 'categoria'));
  if (!Object.keys(cambios).length) throw new ErrorHttp(400, 'No se enviaron cambios');
  await validarConsulta(cambios.consultaId, anterior.pacienteId);

  const base = anterior.toObject();
  const nueva = await Antecedente.create({
    ...Object.fromEntries(CAMPOS.map((c) => [c, base[c]])),
    ...cambios,
    pacienteId: anterior.pacienteId,
    grupoId: anterior.grupoId,
    version: anterior.version + 1,
    registradoPor: req.usuario._id,
    registradoPorNombre: req.usuario.nombre,
    motivoCambio: String(req.body?.motivoCambio || '').trim() || undefined,
  });
  await Antecedente.updateOne({ _id: anterior._id }, { $set: { vigente: false } });

  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Antecedente', entidadId: nueva._id, pacienteId: anterior.pacienteId, campos: Object.keys(cambios) });
  evaluarEnSegundoPlano(anterior.pacienteId);
  res.json(nueva);
});

// GET /api/antecedentes/:id/versiones
const versiones = controlador(async (req, res) => {
  exigirId(req.params.id, 'ID de antecedente');
  const a = await Antecedente.findById(req.params.id).select('grupoId pacienteId').lean();
  if (!a) throw new ErrorHttp(404, 'Antecedente no encontrado');
  await exigirAccesoClinico(req, a.pacienteId);
  res.json(await Antecedente.find({ grupoId: a.grupoId }).sort({ version: 1 }).lean());
});

module.exports = { listar, crear, actualizar, versiones };
