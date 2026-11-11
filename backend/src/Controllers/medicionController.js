const mongoose = require('mongoose');
const Paciente = require('../Models/Paciente');
const Medicion = require('../Models/Medicion');
const Evaluacion = require('../Models/Evaluacion');
const { evaluarYGuardar } = require('../Services/expediente');
const { resultadosConAjustes } = require('../Services/nutricion/evaluacion');
const { registrarAuditoria } = require('../Services/auditoria');
const Consulta = require('../Models/Consulta');
const Expediente = require('../Models/Expediente');
const { evaluarEnSegundoPlano } = require('../Services/clinica/alertas');
const { exigirAccesoClinico, pacientesAccesibles } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, tomarCampos, rangoFechas, controlador } = require('../Services/http');

const { CAMPOS_VALOR, UNIDADES } = Medicion;
const CAMPOS_EDITABLES = ['fecha', ...CAMPOS_VALOR, 'actividadTipo', 'metodos', 'notas', 'consultaId'];

const exigirEscritura = (req) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
};

async function validarConsulta(consultaId, pacienteId) {
  if (!consultaId) return;
  exigirId(consultaId, 'ID de consulta');
  if (!(await Consulta.exists({ _id: consultaId, pacienteId }))) throw new ErrorHttp(400, 'La consulta no pertenece a este paciente');
}

async function exigirPaciente(id) {
  exigirId(id, 'ID de paciente');
  const existe = await Paciente.exists({ _id: id });
  if (!existe) throw new ErrorHttp(404, 'Paciente no encontrado');
}

/** Mediciones vigentes + su evaluación (con ajustes aplicados) en una sola agregación */
async function medicionesConEvaluacion(pacienteId, rango) {
  const match = { pacienteId: new mongoose.Types.ObjectId(pacienteId), vigente: true, anulada: false };
  if (rango) match.fecha = rango;

  const filas = await Medicion.aggregate([
    { $match: match },
    { $sort: { fecha: 1, createdAt: 1 } },
    {
      $lookup: {
        from: 'evaluaciones',
        let: { mid: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$medicionId', '$$mid'] }, { $eq: ['$vigente', true] }] } } },
          { $project: { versionFormulas: 1, resultados: 1, ajustes: 1, entradas: 1, prescripcionId: 1 } },
        ],
        as: 'evaluacion',
      },
    },
    { $set: { evaluacion: { $first: '$evaluacion' } } },
  ]);

  return filas.map((m) => ({
    ...m,
    evaluacion: m.evaluacion && {
      ...m.evaluacion,
      resultadosFinales: resultadosConAjustes(m.evaluacion.resultados, m.evaluacion.ajustes),
    },
  }));
}

// GET /api/pacientes/:pacienteId/mediciones?desde&hasta
const listar = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  await exigirPaciente(pacienteId);
  const mediciones = await medicionesConEvaluacion(pacienteId, rangoFechas(req.query));
  registrarAuditoria(req, { accion: 'consultar', entidad: 'Medicion', pacienteId });
  res.json({ unidades: UNIDADES, mediciones });
});

// POST /api/pacientes/:pacienteId/mediciones
const crear = controlador(async (req, res) => {
  exigirEscritura(req);
  const { pacienteId } = req.params;
  await exigirPaciente(pacienteId);

  const datos = tomarCampos(req.body, CAMPOS_EDITABLES);
  await validarConsulta(datos.consultaId, pacienteId);
  const medicion = await Medicion.create({
    ...datos,
    pacienteId,
    responsable: req.responsable,
    registradoPor: req.usuario._id,
    grupoId: new mongoose.Types.ObjectId(),
    version: 1,
  });
  const evaluacion = await evaluarYGuardar(medicion);
  await Expediente.updateOne({ pacienteId, $or: [{ fechaUltimoActo: null }, { fechaUltimoActo: { $lt: medicion.fecha } }] }, { $set: { fechaUltimoActo: medicion.fecha } });
  evaluarEnSegundoPlano(pacienteId);

  registrarAuditoria(req, {
    accion: 'crear', entidad: 'Medicion', entidadId: medicion._id, pacienteId, campos: Object.keys(datos),
  });
  res.status(201).json({ medicion, evaluacion });
});

// PUT /api/mediciones/:id  → crea una NUEVA versión; la anterior se conserva
const actualizar = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de medición');
  const motivo = (req.body.motivoCambio || '').trim();
  if (!motivo) throw new ErrorHttp(400, 'Indica el motivo de la corrección', { motivoCambio: 'Obligatorio' });

  exigirEscritura(req);
  const anterior = await Medicion.findById(id);
  if (!anterior) throw new ErrorHttp(404, 'Medición no encontrada');
  await exigirAccesoClinico(req, anterior.pacienteId);
  await validarConsulta(req.body?.consultaId, anterior.pacienteId);
  if (!anterior.vigente || anterior.anulada) {
    throw new ErrorHttp(409, 'Solo se puede corregir la versión vigente de una medición');
  }

  const base = anterior.toObject();
  const cambios = {};
  CAMPOS_EDITABLES.forEach((c) => {
    if (!(c in req.body)) return;
    const v = req.body[c];
    cambios[c] = v === '' || v === null ? undefined : v; // vaciar un campo
  });
  if (!Object.keys(cambios).length) throw new ErrorHttp(400, 'No se enviaron cambios');

  const nueva = new Medicion({
    ...Object.fromEntries(CAMPOS_EDITABLES.map((c) => [c, base[c]])),
    ...cambios,
    pacienteId: anterior.pacienteId,
    grupoId: anterior.grupoId,
    version: anterior.version + 1,
    responsable: req.responsable,
    registradoPor: req.usuario._id,
    motivoCambio: motivo,
  });
  await nueva.save();

  await Medicion.updateOne({ _id: anterior._id }, { $set: { vigente: false, reemplazadaPor: nueva._id } });
  await Evaluacion.updateMany({ medicionId: anterior._id }, { $set: { vigente: false } });
  const evaluacion = await evaluarYGuardar(nueva);
  evaluarEnSegundoPlano(anterior.pacienteId);

  registrarAuditoria(req, {
    accion: 'actualizar', entidad: 'Medicion', entidadId: nueva._id, pacienteId: anterior.pacienteId,
    campos: Object.keys(cambios),
  });
  res.json({ medicion: nueva, evaluacion, versionAnterior: anterior._id });
});

// DELETE /api/mediciones/:id  → anulación lógica (no se borra)
const anular = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de medición');
  const motivo = String(req.body?.motivo || req.query.motivo || '').trim();
  if (!motivo) throw new ErrorHttp(400, 'Indica el motivo de la anulación', { motivo: 'Obligatorio' });

  exigirEscritura(req);
  const medicion = await Medicion.findById(id);
  if (!medicion) throw new ErrorHttp(404, 'Medición no encontrada');
  await exigirAccesoClinico(req, medicion.pacienteId);
  if (medicion.anulada) throw new ErrorHttp(409, 'La medición ya estaba anulada');

  medicion.set({
    vigente: false,
    anulada: true,
    anulacion: { fecha: new Date(), responsable: req.responsable, motivo },
  });
  await medicion.save({ validateBeforeSave: false });
  await Evaluacion.updateMany({ medicionId: medicion._id }, { $set: { vigente: false } });
  evaluarEnSegundoPlano(medicion.pacienteId);

  registrarAuditoria(req, { accion: 'anular', entidad: 'Medicion', entidadId: medicion._id, pacienteId: medicion.pacienteId });
  res.json({ mensaje: 'Medición anulada', id });
});

// GET /api/mediciones/:id/versiones
const versiones = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de medición');
  const medicion = await Medicion.findById(id).select('grupoId pacienteId').lean();
  if (!medicion) throw new ErrorHttp(404, 'Medición no encontrada');
  await exigirAccesoClinico(req, medicion.pacienteId);
  const lista = await Medicion.find({ grupoId: medicion.grupoId }).sort({ version: 1 }).lean();
  registrarAuditoria(req, { accion: 'consultar', entidad: 'Medicion', entidadId: id, pacienteId: medicion.pacienteId });
  res.json(lista);
});

// GET /api/mediciones/ultimas  → último peso y total de mediciones por paciente
const ultimas = controlador(async (req, res) => {
  const accesibles = await pacientesAccesibles(req.usuario);
  const filas = await Medicion.aggregate([
    { $match: { vigente: true, anulada: false, ...(accesibles && { pacienteId: { $in: accesibles } }) } },
    { $sort: { fecha: -1 } },
    {
      $group: {
        _id: '$pacienteId',
        total: { $sum: 1 },
        ultimaFecha: { $first: '$fecha' },
        pesos: { $push: { $cond: [{ $ifNull: ['$pesoKg', false] }, { kg: '$pesoKg', fecha: '$fecha' }, '$$REMOVE'] } },
      },
    },
    {
      $project: {
        _id: 0, pacienteId: '$_id', total: 1, ultimaFecha: 1,
        ultimoPeso: { $first: '$pesos' },
      },
    },
  ]);
  res.json(filas);
});

module.exports = { listar, crear, actualizar, anular, versiones, ultimas, medicionesConEvaluacion };
