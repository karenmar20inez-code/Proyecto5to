const Expediente = require('../Models/Expediente');
const Usuario = require('../Models/Usuario');
const Paciente = require('../Models/Paciente');
const Medicion = require('../Models/Medicion');
const ResultadoLaboratorio = require('../Models/ResultadoLaboratorio');
const { fichaClinica } = require('../Services/clinica/fichaClinica');
const { lineaTiempo, TIPOS_EVENTO } = require('../Services/clinica/lineaTiempo');
const { evaluarPaciente } = require('../Services/clinica/alertas');
const { armarReporte, TIPOS_REPORTE } = require('../Services/reportes');
const fhir = require('../Services/fhir/mapeos');
const { alcanceGlobal } = require('../Services/seguridad/permisos');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, exigirId, controlador } = require('../Services/http');

// GET /api/pacientes/:pacienteId/expediente  → ficha clínica vigente
const ficha = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  await evaluarPaciente(pacienteId); // alertas al día al abrir el expediente
  const datos = await fichaClinica(pacienteId);
  if (!datos) throw new ErrorHttp(404, 'Paciente no encontrado');
  registrarAuditoria(req, { accion: 'consultar', entidad: 'Expediente', pacienteId });
  res.json(datos);
});

// PUT /api/pacientes/:pacienteId/expediente  { estado, responsableId, equipoIds, motivoConsulta }
const actualizar = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const exp = await Expediente.findOne({ pacienteId });
  const campos = [];
  const { estado, responsableId, equipoIds, motivoConsulta } = req.body || {};

  if (estado !== undefined) { exp.estado = estado; campos.push('estado'); }
  if (motivoConsulta !== undefined) { exp.motivoConsulta = motivoConsulta; campos.push('motivoConsulta'); }
  // Portal del paciente: qué secciones puede ver (solo valores booleanos de las claves conocidas)
  if (req.body?.portal && typeof req.body.portal === 'object') {
    Expediente.CLAVES_PORTAL.forEach((k) => { if (typeof req.body.portal[k] === 'boolean') exp.set(`portal.${k}`, req.body.portal[k]); });
    campos.push('portal');
  }
  if (responsableId !== undefined || equipoIds !== undefined) {
    if (!alcanceGlobal(req.usuario) && String(exp.responsableId) !== String(req.usuario._id)) {
      throw new ErrorHttp(403, 'Solo el responsable o el superusuario puede cambiar el equipo');
    }
    if (equipoIds !== undefined && !Array.isArray(equipoIds)) throw new ErrorHttp(400, 'equipoIds debe ser una lista', { equipoIds: 'Formato no válido' });
    const ids = [responsableId, ...(equipoIds || [])].filter(Boolean);
    ids.forEach((id) => exigirId(id, 'ID de profesional'));
    const validos = await Usuario.countDocuments({ _id: { $in: ids }, rol: 'nutriologo', activo: true });
    if (validos !== new Set(ids.map(String)).size) throw new ErrorHttp(400, 'Todos los integrantes deben ser nutriólogos activos');
    if (responsableId) { exp.responsableId = responsableId; campos.push('responsableId'); }
    if (equipoIds) { exp.equipoIds = equipoIds; campos.push('equipoIds'); }
  }
  if (!campos.length) throw new ErrorHttp(400, 'No se enviaron cambios');
  exp.historial.push({ usuarioId: req.usuario._id, campos });
  await exp.save();
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Expediente', entidadId: exp._id, pacienteId, campos });
  res.json(exp);
});

// GET /api/pacientes/:pacienteId/linea-tiempo?tipos=a,b&desde&hasta&profesionalId
const timeline = controlador(async (req, res) => {
  const eventos = await lineaTiempo(req.params.pacienteId, req.query);
  res.json({ tipos: TIPOS_EVENTO, eventos });
});

// GET /api/pacientes/:pacienteId/comparacion?a=<consultaId|fecha>&b=<consultaId|fecha>
// Compara las mediciones y laboratorios de dos consultas (por omisión, la última vs la anterior)
const comparacion = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const mediciones = await Medicion.find({ pacienteId, vigente: true, anulada: false }).sort({ fecha: 1 }).lean();
  const labs = await ResultadoLaboratorio.find({ pacienteId, vigente: true }).sort({ fechaMuestra: 1 }).lean();

  const porConsulta = (consultaId) => mediciones.filter((m) => String(m.consultaId) === String(consultaId));
  const elegir = (clave, porDefecto) => {
    if (!clave) return porDefecto;
    const lista = porConsulta(clave);
    return lista.length ? lista[lista.length - 1] : mediciones.find((m) => String(m._id) === String(clave)) || null;
  };
  const actual = elegir(req.query.a, mediciones[mediciones.length - 1]);
  const anterior = elegir(req.query.b, actual ? [...mediciones].reverse().find((m) => new Date(m.fecha) < new Date(actual.fecha)) : null);

  const CAMPOS = ['pesoKg', 'cinturaCm', 'caderaCm', 'grasaPorcentaje', 'masaMuscularKg', 'presionSistolica', 'presionDiastolica', 'consumoKcal'];
  const filas = CAMPOS.map((c) => ({
    campo: c, unidad: Medicion.UNIDADES[c],
    actual: actual?.[c] ?? null, anterior: anterior?.[c] ?? null,
    delta: actual?.[c] != null && anterior?.[c] != null ? Math.round((actual[c] - anterior[c]) * 100) / 100 : null,
  }));

  const ultimosDos = {};
  labs.forEach((l) => { (ultimosDos[l.analito] = ultimosDos[l.analito] || []).push(l); });
  const laboratorio = Object.values(ultimosDos).map((lista) => {
    const [ant, act] = lista.slice(-2).length === 2 ? lista.slice(-2) : [null, lista[lista.length - 1]];
    return { analito: act.analito, nombre: act.nombre, unidad: act.unidad, actual: { valor: act.valor, fecha: act.fechaMuestra }, anterior: ant && { valor: ant.valor, fecha: ant.fechaMuestra }, delta: ant ? Math.round((act.valor - ant.valor) * 100) / 100 : null };
  });

  res.json({
    actual: actual && { _id: actual._id, fecha: actual.fecha, consultaId: actual.consultaId },
    anterior: anterior && { _id: anterior._id, fecha: anterior.fecha, consultaId: anterior.consultaId },
    filas,
    laboratorio,
  });
});

// GET /api/pacientes/:pacienteId/reportes/:tipo?terceros=1&consultaId=
const reporte = controlador(async (req, res) => {
  const { pacienteId, tipo } = req.params;
  const terceros = ['1', 'true'].includes(String(req.query.terceros));
  if (req.query.consultaId) exigirId(req.query.consultaId, 'ID de consulta');
  const datos = await armarReporte(tipo, pacienteId, { terceros, consultaId: req.query.consultaId, usuario: req.usuario });
  registrarAuditoria(req, { accion: 'exportar', entidad: `Reporte:${tipo}${terceros ? ':terceros' : ''}`, pacienteId });
  res.json(datos);
});

const tiposReporte = controlador(async (req, res) => res.json(TIPOS_REPORTE));

// GET /api/fhir/Patient/:pacienteId  ·  GET /api/fhir/Observation?patient=:pacienteId
const fhirPaciente = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const [p, exp] = await Promise.all([Paciente.findById(pacienteId).lean(), Expediente.findOne({ pacienteId }).lean()]);
  if (!p) throw new ErrorHttp(404, 'Paciente no encontrado');
  registrarAuditoria(req, { accion: 'exportar', entidad: 'FHIR:Patient', pacienteId });
  res.type('application/fhir+json').json(fhir.paciente(p, exp));
});

const fhirObservaciones = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const [mediciones, labs] = await Promise.all([
    Medicion.find({ pacienteId, vigente: true, anulada: false }).lean(),
    ResultadoLaboratorio.find({ pacienteId, vigente: true }).lean(),
  ]);
  registrarAuditoria(req, { accion: 'exportar', entidad: 'FHIR:Observation', pacienteId });
  res.type('application/fhir+json').json(fhir.bundle([...mediciones.flatMap(fhir.observacionesDeMedicion), ...labs.map(fhir.observacionLaboratorio)]));
});

module.exports = { ficha, actualizar, timeline, comparacion, reporte, tiposReporte, fhirPaciente, fhirObservaciones };
