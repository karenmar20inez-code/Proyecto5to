/**
 * Diagnósticos, objetivos, planes nutricionales y consentimientos.
 * Cada vínculo (evidencia, diagnóstico, objetivos, prescripción) se valida
 * contra el MISMO paciente para mantener la integridad referencial.
 */
const Diagnostico = require('../Models/Diagnostico');
const Objetivo = require('../Models/Objetivo');
const PlanNutricional = require('../Models/PlanNutricional');
const Consentimiento = require('../Models/Consentimiento');
const Evaluacion = require('../Models/Evaluacion');
const Medicion = require('../Models/Medicion');
const ResultadoLaboratorio = require('../Models/ResultadoLaboratorio');
const Prescripcion = require('../Models/Prescripcion');
const Consulta = require('../Models/Consulta');
const Paciente = require('../Models/Paciente');
const { INDICADORES } = require('../Models/Objetivo');
const { TIPOS_CONSENTIMIENTO } = require('../Models/Consentimiento');
const { datosLongitudinales, progresoObjetivo, valorActualObjetivo } = require('../Services/clinica/fichaClinica');
const { evaluarEnSegundoPlano } = require('../Services/clinica/alertas');
const { VERSION_FORMULAS } = require('../Services/nutricion/formulas');
const { registrarAuditoria } = require('../Services/auditoria');
const { exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');

const exigirEscritura = (req) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
};

/** Verifica que cada id referenciado pertenezca al paciente */
async function mismoPaciente(Modelo, ids, pacienteId, nombre) {
  const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!lista.length) return;
  lista.forEach((id) => exigirId(id, `ID de ${nombre}`));
  const n = await Modelo.countDocuments({ _id: { $in: lista }, pacienteId });
  if (n !== new Set(lista.map(String)).size) throw new ErrorHttp(400, `${nombre} no pertenece a este paciente`);
}

async function cargar(req, Modelo, id, nombre) {
  exigirId(id, `ID de ${nombre}`);
  const doc = await Modelo.findById(id);
  if (!doc) throw new ErrorHttp(404, `${nombre} no encontrado`);
  await exigirAccesoClinico(req, doc.pacienteId);
  return doc;
}

/* ================= DIAGNÓSTICOS ================= */

const listarDiagnosticos = controlador(async (req, res) => {
  res.json(await Diagnostico.find({ pacienteId: req.params.pacienteId }).sort({ fechaDiagnostico: -1 }).lean());
});

const crearDiagnostico = controlador(async (req, res) => {
  exigirEscritura(req);
  const { pacienteId } = req.params;
  const datos = tomarCampos(req.body, ['tipo', 'problema', 'etiologia', 'signosSintomas', 'codigo', 'fechaDiagnostico', 'consultaId']);
  const ev = req.body?.evidencia || {};
  await mismoPaciente(Consulta, datos.consultaId, pacienteId, 'La consulta');
  await mismoPaciente(Evaluacion, ev.evaluacionId, pacienteId, 'La evaluación');
  await mismoPaciente(Medicion, ev.medicionId, pacienteId, 'La medición');
  await mismoPaciente(ResultadoLaboratorio, ev.laboratorioIds, pacienteId, 'El resultado de laboratorio');

  const d = await Diagnostico.create({
    ...datos, pacienteId, evidencia: { evaluacionId: ev.evaluacionId, medicionId: ev.medicionId, laboratorioIds: ev.laboratorioIds || [] },
    profesionalId: req.usuario._id, profesional: req.usuario.nombre,
    historial: [{ usuario: req.usuario.nombre, estado: 'activo', nota: 'Registro' }],
  });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Diagnostico', entidadId: d._id, pacienteId });
  res.status(201).json(d);
});

// PUT /api/diagnosticos/:id  { estado, nota }
const actualizarDiagnostico = controlador(async (req, res) => {
  exigirEscritura(req);
  const d = await cargar(req, Diagnostico, req.params.id, 'Diagnóstico');
  const { estado, nota } = req.body || {};
  if (!estado) throw new ErrorHttp(400, 'Indica el nuevo estado');
  d.estado = estado;
  if (['resuelto', 'descartado'].includes(estado)) d.fechaResolucion = new Date();
  d.historial.push({ usuario: req.usuario.nombre, estado, nota });
  await d.save();
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Diagnostico', entidadId: d._id, pacienteId: d.pacienteId, campos: ['estado'] });
  res.json(d);
});

/* ================= OBJETIVOS ================= */

const listarObjetivos = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const [objetivos, datos] = await Promise.all([Objetivo.find({ pacienteId }).sort({ createdAt: -1 }).lean(), datosLongitudinales(pacienteId)]);
  res.json({ indicadores: INDICADORES, objetivos: objetivos.map((o) => progresoObjetivo(o, datos)) });
});

const crearObjetivo = controlador(async (req, res) => {
  exigirEscritura(req);
  const { pacienteId } = req.params;
  const datos = tomarCampos(req.body, ['diagnosticoId', 'descripcion', 'indicador', 'analito', 'valorInicial', 'valorMeta', 'unidad', 'periodo', 'frecuenciaRevisionDias']);
  await mismoPaciente(Diagnostico, datos.diagnosticoId, pacienteId, 'El diagnóstico');
  if (datos.indicador && INDICADORES[datos.indicador] && !datos.unidad) datos.unidad = INDICADORES[datos.indicador].unidad;
  // valor inicial: el indicado o el último registro real (nunca inventado)
  if (datos.valorInicial === undefined && datos.indicador !== 'cualitativo') {
    const actual = valorActualObjetivo(datos, await datosLongitudinales(pacienteId));
    if (actual) datos.valorInicial = actual.valor;
  }
  const o = await Objetivo.create({ ...datos, pacienteId, profesionalId: req.usuario._id });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Objetivo', entidadId: o._id, pacienteId });
  evaluarEnSegundoPlano(pacienteId);
  res.status(201).json(o);
});

// POST /api/objetivos/:id/revisiones  { comentario, avance?, estado? }
const revisarObjetivo = controlador(async (req, res) => {
  exigirEscritura(req);
  const o = await cargar(req, Objetivo, req.params.id, 'Objetivo');
  const datos = await datosLongitudinales(o.pacienteId);
  const conProgreso = progresoObjetivo(o.toObject(), datos);
  const avance = o.indicador === 'cualitativo' ? Number(req.body?.avance) : conProgreso.progreso;
  if (o.indicador === 'cualitativo' && !(avance >= 0 && avance <= 100)) throw new ErrorHttp(400, 'Indica el avance (0–100 %)');
  o.revisiones.push({
    usuarioId: req.usuario._id, usuario: req.usuario.nombre, valorObservado: conProgreso.valorActual,
    avance, comentario: req.body?.comentario,
  });
  if (req.body?.estado) o.estado = req.body.estado;
  await o.save();
  registrarAuditoria(req, { accion: 'revisar', entidad: 'Objetivo', entidadId: o._id, pacienteId: o.pacienteId });
  evaluarEnSegundoPlano(o.pacienteId);
  res.json(progresoObjetivo(o.toObject(), datos));
});

/* ================= PLANES NUTRICIONALES ================= */

const listarPlanes = controlador(async (req, res) => {
  res.json(await PlanNutricional.find({ pacienteId: req.params.pacienteId }).sort({ createdAt: -1 }).lean());
});

// POST /api/pacientes/:pacienteId/planes
const crearPlan = controlador(async (req, res) => {
  exigirEscritura(req);
  const { pacienteId } = req.params;
  const datos = tomarCampos(req.body, ['nombre', 'vigencia', 'objetivoIds', 'prescripcionId', 'dietaId', 'alimentos', 'recomendaciones', 'consultaId']);
  await mismoPaciente(Objetivo, datos.objetivoIds, pacienteId, 'El objetivo');
  await mismoPaciente(Consulta, datos.consultaId, pacienteId, 'La consulta');

  // Requerimientos: snapshot de la prescripción indicada (o la vigente) y del GET estimado
  const prescripcion = datos.prescripcionId
    ? await Prescripcion.findOne({ _id: datos.prescripcionId, pacienteId }).lean()
    : await Prescripcion.findOne({ pacienteId, vigente: true }).lean();
  if (datos.prescripcionId && !prescripcion) throw new ErrorHttp(400, 'La prescripción no pertenece a este paciente');
  const ultimaEval = await Evaluacion.findOne({ pacienteId, vigente: true }).sort({ fecha: -1 }).lean();

  const plan = await PlanNutricional.create({
    ...datos,
    pacienteId,
    prescripcionId: prescripcion?._id,
    requerimientos: prescripcion ? {
      kcal: prescripcion.kcalObjetivo, proteinasPct: prescripcion.proteinasPct, carbohidratosPct: prescripcion.carbohidratosPct,
      grasasPct: prescripcion.grasasPct, proteinaGKg: prescripcion.proteinaGKg, aguaObjetivoMl: prescripcion.aguaObjetivoMl,
      getEstimadoKcal: ultimaEval?.resultados?.get?.valor ?? undefined, versionFormulas: ultimaEval?.versionFormulas || VERSION_FORMULAS,
      fechaCalculo: new Date(),
    } : undefined,
    profesionalId: req.usuario._id,
    profesional: req.usuario.nombre,
    historial: [{ usuario: req.usuario.nombre, accion: 'creación', campos: Object.keys(datos) }],
  });
  registrarAuditoria(req, { accion: 'crear', entidad: 'PlanNutricional', entidadId: plan._id, pacienteId });
  res.status(201).json(plan);
});

// POST /api/planes/:id/activar  → vigente; el anterior queda "reemplazado"
const activarPlan = controlador(async (req, res) => {
  exigirEscritura(req);
  const plan = await cargar(req, PlanNutricional, req.params.id, 'Plan');
  if (plan.estado === 'vigente') throw new ErrorHttp(409, 'El plan ya está vigente');
  await PlanNutricional.updateMany(
    { pacienteId: plan.pacienteId, estado: 'vigente' },
    { $set: { estado: 'reemplazado' }, $push: { historial: { usuario: req.usuario.nombre, accion: `reemplazado por ${plan._id}` } } }
  );
  plan.estado = 'vigente';
  plan.historial.push({ usuario: req.usuario.nombre, accion: 'activación' });
  await plan.save();
  if (plan.dietaId) await Paciente.updateOne({ _id: plan.pacienteId }, { $set: { dietaId: plan.dietaId } }); // vínculo con Cumplimiento
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'PlanNutricional', entidadId: plan._id, pacienteId: plan.pacienteId, campos: ['estado'] });
  evaluarEnSegundoPlano(plan.pacienteId);
  res.json(plan);
});

/* ================= CONSENTIMIENTOS ================= */

const listarConsentimientos = controlador(async (req, res) => {
  res.json({ tipos: TIPOS_CONSENTIMIENTO, consentimientos: await Consentimiento.find({ pacienteId: req.params.pacienteId }).sort({ fecha: -1 }).lean() });
});

const crearConsentimiento = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const datos = tomarCampos(req.body, ['tipo', 'versionDocumento', 'fecha', 'medio', 'observaciones']);
  const c = await Consentimiento.create({ ...datos, pacienteId, otorgado: true, registradoPor: req.usuario._id });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Consentimiento', entidadId: c._id, pacienteId, campos: [datos.tipo] });
  evaluarEnSegundoPlano(pacienteId);
  res.status(201).json(c);
});

// POST /api/consentimientos/:id/revocar  { motivo }
const revocarConsentimiento = controlador(async (req, res) => {
  const c = await cargar(req, Consentimiento, req.params.id, 'Consentimiento');
  if (c.revocacion?.fecha) throw new ErrorHttp(409, 'Ya estaba revocado');
  c.otorgado = false;
  c.revocacion = { fecha: new Date(), motivo: req.body?.motivo, usuario: req.usuario.nombre };
  await c.save();
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Consentimiento', entidadId: c._id, pacienteId: c.pacienteId, campos: ['revocacion'] });
  evaluarEnSegundoPlano(c.pacienteId);
  res.json(c);
});

module.exports = {
  listarDiagnosticos, crearDiagnostico, actualizarDiagnostico,
  listarObjetivos, crearObjetivo, revisarObjetivo,
  listarPlanes, crearPlan, activarPlan,
  listarConsentimientos, crearConsentimiento, revocarConsentimiento,
};
