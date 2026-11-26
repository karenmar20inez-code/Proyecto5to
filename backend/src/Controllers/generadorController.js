/**
 * Generador de planes alimentarios personalizados.
 *  - Catálogo de platillos (/api/platillos): lectura con dietas:leer, edición con dietas:escribir.
 *  - Preferencias y planes por paciente (/api/pacientes/:pacienteId/...): acceso clínico al expediente;
 *    escribir exige clinico:escribir (lo aplica el router del expediente).
 *  - Portal (/api/portal/...): el paciente captura SUS preferencias y ve solo planes APROBADOS.
 * Seguridad: antes de generar se exigen los datos mínimos; antes de aprobar se vuelve a validar el plan
 * contra las restricciones VIGENTES (si cambió una alergia desde que se generó, no se aprueba).
 */
const crypto = require('crypto');
const Platillo = require('../Models/Platillo');
const PreferenciasAlimentarias = require('../Models/PreferenciasAlimentarias');
const PlanGenerado = require('../Models/PlanGenerado');
const Antecedente = require('../Models/Antecedente');
const Diagnostico = require('../Models/Diagnostico');
const Prescripcion = require('../Models/Prescripcion');
const PlanNutricional = require('../Models/PlanNutricional');
const PLATILLOS_BASE = require('../data/platillos-base.json');
const g = require('../Services/nutricion/generadorDietas');
const { registrarAuditoria } = require('../Services/auditoria');
const { exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');

const ADVERTENCIA = 'Plan orientativo generado automáticamente. Debe ser revisado por un nutriólogo o profesional de la salud antes de seguirlo.';
const AVISO_REPORTADAS = 'El paciente reportó alergias en su portal que aún deben confirmarse en el expediente; ya se excluyeron.';

/* ================= CATÁLOGO DE PLATILLOS ================= */

/* El catálogo inicial se carga una vez; $setOnInsert no sobrescribe platillos ya editados */
let sembrado = null;
function sembrarPlatillos() {
  if (!sembrado) {
    sembrado = Platillo.bulkWrite(PLATILLOS_BASE.map((p) => ({
      updateOne: { filter: { clave: p.clave }, update: { $setOnInsert: { ...p, validado: false, creadoPor: 'Catálogo inicial (pendiente de validación)' } }, upsert: true },
    }))).catch((error) => { sembrado = null; throw error; });
  }
  return sembrado;
}
const conKcal = (p) => ({ ...p, kcal: g.kcalPlatillo(p), clasificacion: (({ vegetariano, vegano }) => ({ vegetariano, vegano }))(g.clasificar(p)) });

// GET /api/platillos?inactivos=1
const listarPlatillos = controlador(async (req, res) => {
  await sembrarPlatillos();
  const filtro = req.query.inactivos === '1' ? {} : { activo: true };
  res.json((await Platillo.find(filtro).sort({ nombre: 1 }).lean()).map(conKcal));
});

const CAMPOS_PLATILLO = ['nombre', 'tiempos', 'proteina', 'ingredientes', 'equivalentes', 'alergenos', 'contiene', 'etiquetas', 'activo', 'validado'];
const claveDesdeNombre = (nombre = '') => String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'platillo';

// POST /api/platillos
const crearPlatillo = controlador(async (req, res) => {
  await sembrarPlatillos();
  const datos = tomarCampos(req.body, CAMPOS_PLATILLO);
  const base = claveDesdeNombre(datos.nombre);
  let clave = base;
  for (let n = 2; await Platillo.exists({ clave }); n += 1) clave = `${base}-${n}`; // eslint-disable-line no-await-in-loop
  const platillo = await Platillo.create({
    ...datos, clave, creadoPor: req.responsable,
    ...(datos.validado ? { validadoPor: req.responsable } : {}),
  });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Platillo', entidadId: platillo._id, campos: Object.keys(datos) });
  res.status(201).json(conKcal(platillo.toObject()));
});

// PUT /api/platillos/:clave   (no se borran: activo = false)
const actualizarPlatillo = controlador(async (req, res) => {
  await sembrarPlatillos();
  const platillo = await Platillo.findOne({ clave: String(req.params.clave).toLowerCase() });
  if (!platillo) throw new ErrorHttp(404, 'Platillo no encontrado');
  const datos = tomarCampos(req.body, CAMPOS_PLATILLO);
  platillo.set(datos);
  if (datos.validado === true) platillo.validadoPor = req.responsable;
  platillo.actualizadoPor = req.responsable;
  await platillo.save();
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Platillo', entidadId: platillo._id, campos: Object.keys(datos) });
  res.json(conKcal(platillo.toObject()));
});

/* ================= CONTEXTO CLÍNICO DEL PACIENTE ================= */

/** Reúne lo que el generador necesita: requerimiento, alergias, diagnósticos y preferencias */
async function contextoPaciente(pacienteId) {
  const [preferencias, antecedentes, diagnosticos, prescripcion, plan] = await Promise.all([
    PreferenciasAlimentarias.findOne({ pacienteId }), // sin lean: descifra notas y alergias reportadas
    Antecedente.find({ pacienteId, vigente: true, categoria: { $in: ['alergia', 'intolerancia'] } }), // sin lean: descifra
    Diagnostico.find({ pacienteId, estado: { $in: ['activo', 'en_mejora'] } }).select('problema codigo').lean(),
    Prescripcion.findOne({ pacienteId, vigente: true }).sort({ fechaInicio: -1 }).select('kcalObjetivo').lean(),
    PlanNutricional.findOne({ pacienteId, estado: 'vigente' }).sort({ updatedAt: -1 }).select('requerimientos').lean(),
  ]);
  const kcal = prescripcion?.kcalObjetivo || plan?.requerimientos?.kcal || null;
  const alergiasActivas = antecedentes.filter((a) => a.estado === 'activo').map((a) => ({ categoria: a.categoria, descripcion: a.descripcion }));
  const reportadas = preferencias?.alergiasReportadas
    ? preferencias.alergiasReportadas.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean).map((descripcion) => ({ categoria: 'alergia', descripcion }))
    : [];
  const prefs = preferencias ? preferencias.toObject() : null;
  return {
    preferencias: prefs,
    kcal,
    origenKcal: prescripcion?.kcalObjetivo ? 'prescripción vigente' : (plan?.requerimientos?.kcal ? 'plan nutricional vigente' : null),
    alergias: [...alergiasActivas, ...reportadas],
    alergiasRegistradas: antecedentes.some((a) => a.categoria === 'alergia' && ['activo', 'negado'].includes(a.estado)),
    alergiasReportadasPendientes: reportadas.length > 0,
    diagnosticos: diagnosticos.map((d) => ({ texto: `${d.problema || ''} ${d.codigo?.texto || ''}`, codigo: d.codigo?.codigo })),
  };
}

const faltantesDe = (ctx) => g.datosFaltantes({ kcal: ctx.kcal, preferencias: ctx.preferencias, alergiasRegistradas: ctx.alergiasRegistradas });
const perfilDe = (ctx) => g.construirPerfil({ kcal: ctx.kcal, preferencias: ctx.preferencias || {}, alergias: ctx.alergias, diagnosticos: ctx.diagnosticos });

/** Resumen seguro del contexto para la pantalla (sin notas clínicas) */
const resumenContexto = (ctx) => ({
  kcal: ctx.kcal,
  origenKcal: ctx.origenKcal,
  alergias: ctx.alergias.map((a) => a.descripcion),
  alergiasRegistradas: ctx.alergiasRegistradas,
  alergiasReportadasPendientes: ctx.alergiasReportadasPendientes,
  restriccionesPorDiagnostico: perfilDe(ctx).excluirEtiquetas,
});

/**
 * Revisa el plan aprobado contra las restricciones VIGENTES. Si ya no cumple (nueva alergia, rechazo,
 * cambio de tipo de alimentación…), se retira (archivado) para que el paciente no lo siga viendo.
 * @returns el plan aprobado si sigue siendo válido; null si no hay o se retiró
 */
async function revisarPlanAprobado(req, pacienteId, ctx) {
  const plan = await PlanGenerado.findOne({ pacienteId, estado: 'aprobado' }).sort({ aprobadoEn: -1 });
  if (!plan) return null;
  const contexto = ctx || await contextoPaciente(pacienteId);
  const incompleto = faltantesDe(contexto).length > 0;
  const v = incompleto ? { valido: false, problemas: ['faltan datos mínimos'] } : g.validarPlan(plan.toObject(), perfilDe(contexto));
  if (v.valido) return plan;
  const retirado = await PlanGenerado.findOneAndUpdate(
    { _id: plan._id, estado: 'aprobado' },
    { $set: { estado: 'archivado' }, $push: { historial: { usuario: 'Sistema', accion: 'retirado', detalle: `Ya no cumple las restricciones vigentes: ${v.problemas.slice(0, 3).join(' ')}` } } },
    { new: true }
  );
  if (retirado) registrarAuditoria(req, { accion: 'retirar', entidad: 'PlanGenerado', entidadId: plan._id, pacienteId, campos: ['restricciones-vigentes'] });
  return null;
}

/* ================= PREFERENCIAS (personal clínico) ================= */

const CAMPOS_PREFERENCIAS = ['tipoAlimentacion', 'numeroComidas', 'restricciones', 'gustos', 'rechazos', 'preparacion', 'alergiasReportadas', 'notas'];

async function guardarPreferencias(req, pacienteId, origen, extra = {}) {
  const datos = tomarCampos(req.body, CAMPOS_PREFERENCIAS);
  ['gustos', 'rechazos'].forEach((c) => {
    if (typeof datos[c] === 'string') datos[c] = datos[c].split(/[,;\n]+/);
    if (Array.isArray(datos[c])) datos[c] = [...new Set(datos[c].map((x) => String(x).trim()).filter(Boolean))];
  });
  if (datos.numeroComidas !== undefined) datos.numeroComidas = Number(datos.numeroComidas);
  // Un texto vacío borra el campo (tomarCampos ignora los vacíos)
  ['alergiasReportadas', 'notas'].forEach((c) => { if (req.body && req.body[c] === '') datos[c] = undefined; });
  let pref = await PreferenciasAlimentarias.findOne({ pacienteId });
  if (!pref) pref = new PreferenciasAlimentarias({ pacienteId });
  pref.set({ ...datos, ...extra, origen, actualizadoPor: req.responsable || req.usuario?.nombre });
  pref.historial.push({ usuario: req.responsable || req.usuario?.nombre, origen, campos: Object.keys({ ...datos, ...extra }) });
  await pref.save();
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'PreferenciasAlimentarias', entidadId: pref._id, pacienteId, campos: Object.keys(datos) });
  return pref;
}

// GET /api/pacientes/:pacienteId/preferencias-alimentarias
const obtenerPreferencias = controlador(async (req, res) => {
  const ctx = await contextoPaciente(req.params.pacienteId);
  await revisarPlanAprobado(req, req.params.pacienteId, ctx);
  registrarAuditoria(req, { accion: 'consultar', entidad: 'PreferenciasAlimentarias', pacienteId: req.params.pacienteId });
  res.json({ preferencias: ctx.preferencias, contexto: resumenContexto(ctx), faltan: faltantesDe(ctx), catalogos: catalogosUI() });
});

// PUT /api/pacientes/:pacienteId/preferencias-alimentarias
const actualizarPreferencias = controlador(async (req, res) => {
  const pref = await guardarPreferencias(req, req.params.pacienteId, 'profesional');
  const ctx = await contextoPaciente(req.params.pacienteId);
  await revisarPlanAprobado(req, req.params.pacienteId, ctx);
  res.json({ preferencias: pref.toObject(), contexto: resumenContexto(ctx), faltan: faltantesDe(ctx) });
});

const catalogosUI = () => ({
  tiposAlimentacion: g.TIPOS_ALIMENTACION, restricciones: g.RESTRICCIONES, alergenos: g.ALERGENOS,
  tiempos: g.TIEMPOS, distribucion: g.DISTRIBUCION, advertencia: ADVERTENCIA,
});

/* ================= PLANES GENERADOS (personal clínico) ================= */

// GET /api/pacientes/:pacienteId/planes-generados
const listarPlanes = controlador(async (req, res) => {
  const planes = await PlanGenerado.find({ pacienteId: req.params.pacienteId })
    .select('estado kcalObjetivo createdAt aprobadoEn aprobadoPor generadoPor semilla')
    .sort({ createdAt: -1 }).limit(50).lean();
  registrarAuditoria(req, { accion: 'consultar', entidad: 'PlanGenerado', pacienteId: req.params.pacienteId, campos: ['lista'] });
  res.json(planes);
});

/**
 * POST /api/pacientes/:pacienteId/planes-generados
 * { basePlanId?, regenerar?: { dia?: 0-6, comida?: n }, fijar?: ['d-m', ...] }
 *  - Sin basePlanId: plan nuevo.
 *  - Con basePlanId: se conservan todas las comidas del plan base excepto el día o la comida a regenerar
 *    (o solo las comidas indicadas en `fijar`). El borrador base pasa a archivado.
 */
const generar = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  const ctx = await contextoPaciente(pacienteId);
  const faltan = faltantesDe(ctx);
  if (faltan.length) {
    return res.status(422).json({ mensaje: 'Faltan datos para generar un plan seguro.', faltan });
  }
  const perfil = perfilDe(ctx);
  await sembrarPlatillos();
  const platillos = await Platillo.find({ activo: true }).lean();

  let fijadas = {};
  let base = null;
  const { basePlanId, regenerar, fijar } = req.body || {};
  if (basePlanId) {
    exigirId(basePlanId, 'ID de plan');
    base = await PlanGenerado.findOne({ _id: basePlanId, pacienteId });
    if (!base) throw new ErrorHttp(404, 'Plan base no encontrado');
    base.dias.forEach((d, di) => d.comidas.forEach((c, mi) => {
      const clave = `${di}-${mi}`;
      const tocaRegenerar = regenerar && regenerar.dia === di && (regenerar.comida === undefined || regenerar.comida === mi);
      const conservar = Array.isArray(fijar) ? fijar.includes(clave) : (regenerar ? !tocaRegenerar : false);
      if (conservar) fijadas[clave] = c.platilloClave;
    }));
  }
  if (!Object.keys(fijadas).length) fijadas = {};

  const semilla = crypto.randomInt(1, 2 ** 31 - 1);
  const r = g.generarPlanValido({ platillos, perfil, semilla, fijadas });
  if (!r.ok) {
    registrarAuditoria(req, { accion: 'rechazar', entidad: 'PlanGenerado', pacienteId, campos: ['sin-opciones'] });
    return res.status(422).json({ mensaje: r.motivo, problemas: r.problemas, detalle: r.detalle });
  }
  const plan = await PlanGenerado.create({
    ...r.plan,
    pacienteId,
    advertencias: [ADVERTENCIA, ...(ctx.alergiasReportadasPendientes ? [AVISO_REPORTADAS] : []), ...r.plan.advertencias],
    perfil: {
      tipoAlimentacion: perfil.tipoAlimentacion, numeroComidas: perfil.numeroComidas, restricciones: perfil.restricciones,
      alergenos: perfil.alergenos, terminosRestringidos: perfil.terminosRestringidos, rechazos: perfil.rechazos, gustos: perfil.gustos,
      excluirEtiquetas: perfil.excluirEtiquetas, origenKcal: ctx.origenKcal,
    },
    generadoPor: { usuarioId: req.usuario._id, nombre: req.responsable },
    historial: [{ usuario: req.responsable, accion: base ? 'regenerado' : 'generado', detalle: base ? `A partir del plan ${base._id}` : undefined }],
  });
  if (base && base.estado === 'borrador') {
    base.estado = 'archivado';
    base.historial.push({ usuario: req.responsable, accion: 'archivado', detalle: `Reemplazado por ${plan._id}` });
    await base.save();
  }
  registrarAuditoria(req, { accion: 'crear', entidad: 'PlanGenerado', entidadId: plan._id, pacienteId, campos: base ? ['regenerado'] : ['generado'] });
  res.status(201).json({ ...plan.toObject(), listaCompras: g.listaCompras(plan) });
});

/** Carga un plan verificando el acceso clínico a su paciente */
async function cargarPlan(req) {
  exigirId(req.params.id, 'ID de plan');
  const plan = await PlanGenerado.findById(req.params.id);
  if (!plan) throw new ErrorHttp(404, 'Plan no encontrado');
  await exigirAccesoClinico(req, plan.pacienteId);
  return plan;
}

// GET /api/planes-generados/:id
const obtenerPlan = controlador(async (req, res) => {
  const plan = await cargarPlan(req);
  registrarAuditoria(req, { accion: 'consultar', entidad: 'PlanGenerado', entidadId: plan._id, pacienteId: plan.pacienteId });
  res.json({ ...plan.toObject(), listaCompras: g.listaCompras(plan) });
});

// PUT /api/planes-generados/:id/aprobar  { nota?, confirmarNoValidados? }
const aprobarPlan = controlador(async (req, res) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  const plan = await cargarPlan(req);
  if (plan.estado !== 'borrador') throw new ErrorHttp(409, 'Solo se aprueba un plan en borrador');
  // Revalidación con las restricciones VIGENTES (pudieron cambiar desde que se generó)
  const ctx = await contextoPaciente(plan.pacienteId);
  const faltan = faltantesDe(ctx);
  const v = faltan.length ? { valido: false, problemas: [] } : g.validarPlan(plan.toObject(), perfilDe(ctx));
  if (!v.valido) {
    registrarAuditoria(req, { accion: 'rechazar', entidad: 'PlanGenerado', entidadId: plan._id, pacienteId: plan.pacienteId, campos: [faltan.length ? 'faltan-datos' : 'restricciones-vigentes'] });
    return faltan.length
      ? res.status(422).json({ mensaje: 'Faltan datos del paciente para aprobar el plan.', faltan })
      : res.status(422).json({ mensaje: 'El plan ya no cumple las restricciones vigentes del paciente. Genera uno nuevo.', problemas: v.problemas });
  }
  // Platillos del catálogo que ningún profesional ha validado: se exige confirmación explícita
  const noValidados = [...new Set(plan.dias.flatMap((d) => d.comidas).filter((c) => c.validado !== true).map((c) => c.nombre))];
  if (noValidados.length && req.body?.confirmarNoValidados !== true) {
    return res.status(422).json({
      mensaje: `El plan incluye ${noValidados.length} platillo(s) del catálogo que aún no han sido validados por un profesional. Revisa sus ingredientes y confirma para aprobar.`,
      noValidados, requiereConfirmacion: true,
    });
  }
  const advertencias = [...plan.advertencias];
  // Alergias reportadas por el paciente después de generar el plan: la advertencia se añade al aprobar
  if (ctx.alergiasReportadasPendientes && !advertencias.includes(AVISO_REPORTADAS)) advertencias.push(AVISO_REPORTADAS);
  const nota = req.body?.nota ? String(req.body.nota).slice(0, 2000) : undefined;
  // Antes de aprobar, se archivan el aprobado anterior y los borradores superados (índice único: un aprobado por paciente)
  await PlanGenerado.updateMany({ pacienteId: plan.pacienteId, estado: { $in: ['aprobado', 'borrador'] }, _id: { $ne: plan._id } }, {
    $set: { estado: 'archivado' }, $push: { historial: { usuario: req.responsable, accion: 'archivado', detalle: `Reemplazado por ${plan._id}` } },
  });
  // Cambio atómico: solo si sigue en borrador (evita aprobar dos veces o "revivir" un plan archivado)
  let aprobado;
  try {
    aprobado = await PlanGenerado.findOneAndUpdate(
      { _id: plan._id, estado: 'borrador' },
      {
        $set: { estado: 'aprobado', aprobadoPor: { usuarioId: req.usuario._id, nombre: req.responsable }, aprobadoEn: new Date(), advertencias, ...(nota ? { notaRevision: nota } : {}) },
        $push: { historial: { usuario: req.responsable, accion: 'aprobado', detalle: noValidados.length ? `Confirmó ${noValidados.length} platillo(s) sin validar` : undefined } },
      },
      { new: true }
    );
  } catch (error) {
    if (error?.code === 11000) throw new ErrorHttp(409, 'Otro plan se aprobó al mismo tiempo. Recarga e inténtalo de nuevo.');
    throw error;
  }
  if (!aprobado) throw new ErrorHttp(409, 'El plan cambió mientras se aprobaba. Recarga e inténtalo de nuevo.');
  await PreferenciasAlimentarias.updateOne({ pacienteId: plan.pacienteId }, { $unset: { solicitudPlan: 1 } });
  registrarAuditoria(req, { accion: 'aprobar', entidad: 'PlanGenerado', entidadId: plan._id, pacienteId: plan.pacienteId, campos: noValidados.length ? ['confirmo-no-validados'] : [] });
  res.json({ ...aprobado.toObject(), listaCompras: g.listaCompras(aprobado) });
});

// PUT /api/planes-generados/:id/archivar
const archivarPlan = controlador(async (req, res) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  const plan = await cargarPlan(req);
  const archivado = await PlanGenerado.findOneAndUpdate(
    { _id: plan._id, estado: { $ne: 'archivado' } },
    { $set: { estado: 'archivado' }, $push: { historial: { usuario: req.responsable, accion: 'archivado' } } },
    { new: true }
  );
  if (!archivado) throw new ErrorHttp(409, 'El plan ya está archivado');
  registrarAuditoria(req, { accion: 'archivar', entidad: 'PlanGenerado', entidadId: plan._id, pacienteId: plan.pacienteId });
  res.json(archivado.toObject());
});

/* ================= PORTAL DEL PACIENTE ================= */

const pacienteDeSesion = (req) => {
  const pacienteId = req.usuario.pacienteId;
  if (req.usuario.rol !== 'paciente' || !pacienteId) throw new ErrorHttp(404, 'Tu cuenta no está ligada a un paciente.');
  return pacienteId;
};

/** Lo que el paciente ve de su plan: solo platillos, porciones y advertencias (sin perfil interno) */
const planParaPaciente = (plan) => plan && ({
  _id: plan._id, aprobadoEn: plan.aprobadoEn, aprobadoPor: plan.aprobadoPor?.nombre, kcalObjetivo: plan.kcalObjetivo,
  distribucion: plan.distribucion,
  // Solo advertencias para el paciente (no las que delatan diagnósticos ni los avisos internos del equipo)
  advertencias: (plan.advertencias || []).filter((a) => a === ADVERTENCIA || /^(Halal|Kosher):/.test(a)),
  notaRevision: plan.notaRevision,
  dias: plan.dias.map((d) => ({ dia: d.dia, comidas: d.comidas.map((c) => ({ etiquetaTiempo: c.etiquetaTiempo, nombre: c.nombre, porcion: c.porcion, kcal: c.kcal, ingredientes: c.ingredientes })) })),
  listaCompras: g.listaCompras(plan),
});

// GET /api/portal/plan-alimentario
const portalPlan = controlador(async (req, res) => {
  const pacienteId = pacienteDeSesion(req);
  const vigente = await revisarPlanAprobado(req, pacienteId); // nunca muestra un plan que ya no cumple
  const [pref, borrador] = await Promise.all([
    PreferenciasAlimentarias.findOne({ pacienteId }),
    PlanGenerado.exists({ pacienteId, estado: 'borrador' }),
  ]);
  const plan = vigente ? vigente.toObject() : null;
  registrarAuditoria(req, { accion: 'consultar', entidad: 'PortalPlanAlimentario', pacienteId });
  const p = pref ? pref.toObject() : null;
  res.json({
    preferencias: p && tomarCampos(p, [...CAMPOS_PREFERENCIAS.filter((c) => c !== 'notas'), 'solicitudPlan', 'updatedAt']),
    plan: planParaPaciente(plan),
    enRevision: Boolean(borrador) || Boolean(p?.solicitudPlan),
    catalogos: catalogosUI(),
  });
});

// PUT /api/portal/preferencias  { ...preferencias, solicitarPlan?: true }
const portalPreferencias = controlador(async (req, res) => {
  const pacienteId = pacienteDeSesion(req);
  delete req.body?.notas; // las notas son del profesional
  const extra = req.body?.solicitarPlan ? { solicitudPlan: new Date() } : {};
  const pref = await guardarPreferencias(req, pacienteId, 'paciente', extra);
  await revisarPlanAprobado(req, pacienteId); // si reportó una alergia nueva, el plan aprobado se retira
  const p = pref.toObject();
  res.json({ preferencias: tomarCampos(p, [...CAMPOS_PREFERENCIAS.filter((c) => c !== 'notas'), 'solicitudPlan', 'updatedAt']), enRevision: Boolean(p.solicitudPlan) });
});

module.exports = {
  ADVERTENCIA, sembrarPlatillos, contextoPaciente,
  listarPlatillos, crearPlatillo, actualizarPlatillo,
  obtenerPreferencias, actualizarPreferencias,
  listarPlanes, generar, obtenerPlan, aprobarPlan, archivarPlan,
  portalPlan, portalPreferencias,
};
