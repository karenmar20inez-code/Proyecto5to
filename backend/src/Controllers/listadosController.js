/**
 * Listados transversales para la navegación (Expedientes, Consultas, Laboratorio).
 * Siempre limitados a los expedientes a los que el usuario tiene acceso clínico.
 */
const mongoose = require('mongoose');
const Expediente = require('../Models/Expediente');
const Consulta = require('../Models/Consulta');
const ResultadoLaboratorio = require('../Models/ResultadoLaboratorio');
const { pacientesAccesibles } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, rangoFechas, controlador } = require('../Services/http');

async function ambito(req) {
  if (!tienePermiso(req.usuario, 'clinico:leer')) throw new ErrorHttp(403, 'Tu rol no tiene acceso a información clínica');
  const ids = await pacientesAccesibles(req.usuario);
  return ids ? { pacienteId: { $in: ids } } : {};
}

// GET /api/expedientes  → folio, estado, responsable, última consulta, próxima cita y alertas pendientes
const expedientes = controlador(async (req, res) => {
  const filtro = await ambito(req);
  const ahora = new Date();
  const filas = await Expediente.aggregate([
    { $match: filtro },
    { $lookup: { from: 'pacientes', localField: 'pacienteId', foreignField: '_id', as: 'paciente', pipeline: [{ $project: { nombreCompleto: 1, fechaNacimiento: 1, edad: 1, sexo: 1, estado: 1 } }] } },
    { $lookup: { from: 'usuarios', localField: 'responsableId', foreignField: '_id', as: 'responsable', pipeline: [{ $project: { nombre: 1 } }] } },
    { $lookup: { from: 'consultas', let: { p: '$pacienteId' }, as: 'ultimaConsulta', pipeline: [{ $match: { $expr: { $eq: ['$pacienteId', '$$p'] } } }, { $sort: { fecha: -1 } }, { $limit: 1 }, { $project: { fecha: 1, estado: 1 } }] } },
    { $lookup: { from: 'citas', let: { p: '$pacienteId' }, as: 'proximaCita', pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$pacienteId', '$$p'] }, { $eq: ['$estado', 'programada'] }, { $gte: ['$fechaHora', ahora] }] } } }, { $sort: { fechaHora: 1 } }, { $limit: 1 }, { $project: { fechaHora: 1 } }] } },
    { $lookup: { from: 'alertas', let: { p: '$pacienteId' }, as: 'alertas', pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$pacienteId', '$$p'] }, { $eq: ['$estado', 'pendiente'] }] } } }, { $group: { _id: '$prioridad', n: { $sum: 1 } } }] } },
    {
      $project: {
        folio: 1, estado: 1, fechaIngreso: 1, fechaUltimoActo: 1, pacienteId: 1,
        paciente: { $first: '$paciente' }, responsable: { $first: '$responsable.nombre' },
        ultimaConsulta: { $first: '$ultimaConsulta' }, proximaCita: { $first: '$proximaCita.fechaHora' }, alertas: 1,
      },
    },
    { $sort: { fechaUltimoActo: -1, fechaIngreso: -1 } },
  ]);
  res.json(filas.map((f) => ({ ...f, alertas: Object.fromEntries(f.alertas.map((a) => [a._id, a.n])) })));
});

// GET /api/consultas?estado=borrador&desde&hasta
const consultas = controlador(async (req, res) => {
  const filtro = await ambito(req);
  if (req.query.estado) filtro.estado = req.query.estado;
  if (req.query.mias === '1') filtro.profesionalId = req.usuario._id;
  const rango = rangoFechas(req.query);
  if (rango) filtro.fecha = rango;
  const lista = await Consulta.find(filtro).sort({ fecha: -1 }).limit(300)
    .select('pacienteId fecha tipo motivo estado profesional firma.fecha firma.nombre adendas._id')
    .populate('pacienteId', 'nombreCompleto').lean();
  res.json(lista.map((c) => ({ ...c, adendas: c.adendas?.length || 0 })));
});

// GET /api/laboratorios?fuera=1&desde&hasta
const laboratorios = controlador(async (req, res) => {
  const filtro = { ...(await ambito(req)), vigente: true };
  const rango = rangoFechas(req.query);
  if (rango) filtro.fechaMuestra = rango;
  let lista = await ResultadoLaboratorio.find(filtro).sort({ fechaMuestra: -1 }).limit(500).populate('pacienteId', 'nombreCompleto').lean();
  lista = lista.map((r) => ({ ...r, fueraDeRango: ResultadoLaboratorio.fueraDeRango(r) }));
  if (req.query.fuera === '1') lista = lista.filter((r) => r.fueraDeRango);
  res.json(lista);
});

module.exports = { expedientes, consultas, laboratorios, _oid: mongoose.Types.ObjectId };
