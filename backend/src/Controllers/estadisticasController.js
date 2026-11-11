const mongoose = require('mongoose');
const Paciente = require('../Models/Paciente');
const Medicion = require('../Models/Medicion');
const Prescripcion = require('../Models/Prescripcion');
const Evaluacion = require('../Models/Evaluacion');
const Cita = require('../Models/Cita');
const Adherencia = require('../Models/Adherencia');
const F = require('../Services/nutricion/formulas');
const { evaluarMedicion } = require('../Services/nutricion/evaluacion');
const { pesoInicial } = require('../Services/expediente');
const { medicionesConEvaluacion } = require('./medicionController');
const { registrarAuditoria } = require('../Services/auditoria');
const { pacientesAccesibles } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, rangoFechas, controlador } = require('../Services/http');

const ZONA = process.env.ZONA_HORARIA || 'America/Mexico_City';
const DIA_MS = 86400000;
const oid = (id) => new mongoose.Types.ObjectId(id);

/* Puntaje de adherencia como expresión de agregación (cumplio 1, parcial 0.5, no 0) */
const PUNTAJE_EXPR = {
  $switch: {
    branches: [
      { case: { $eq: ['$estado', 'cumplio'] }, then: 1 },
      { case: { $eq: ['$estado', 'parcial'] }, then: 0.5 },
    ],
    default: 0,
  },
};

const CAMPOS_SERIE = ['pesoKg', 'cinturaCm', 'caderaCm', 'grasaPorcentaje', 'masaMuscularKg'];
const CAMPOS_LAB = [
  'glucosaMgDl', 'hba1cPct', 'colesterolTotalMgDl', 'hdlMgDl', 'ldlMgDl', 'trigliceridosMgDl',
  'presionSistolica', 'presionDiastolica',
];

/* Último valor registrado de cada campo, con su fecha */
function ultimosValores(mediciones, campos) {
  const r = {};
  mediciones.forEach((m) => {
    campos.forEach((c) => {
      if (m[c] !== undefined && m[c] !== null) r[c] = { valor: m[c], fecha: m.fecha, medicionId: m._id };
    });
  });
  return r;
}

const primerValor = (mediciones, campo) => mediciones.find((m) => m[campo] != null)?.[campo] ?? null;

/* ============================================================
 * GET /api/pacientes/:pacienteId/dashboard?desde&hasta
 * ============================================================ */
const dashboardPaciente = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  exigirId(pacienteId, 'ID de paciente');
  const paciente = await Paciente.findById(pacienteId).lean();
  if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado');

  const rango = rangoFechas(req.query);
  const filtroAdh = { pacienteId: oid(pacienteId), estado: { $ne: null } };
  if (req.query.desde) filtroAdh.fecha = { ...(filtroAdh.fecha || {}), $gte: String(req.query.desde).slice(0, 10) };
  if (req.query.hasta) filtroAdh.fecha = { ...(filtroAdh.fecha || {}), $lte: String(req.query.hasta).slice(0, 10) };

  const [todas, prescripciones, adherencia, citas, inicial] = await Promise.all([
    medicionesConEvaluacion(pacienteId, null),
    Prescripcion.find({ pacienteId }).sort({ fechaInicio: -1, createdAt: -1 }).lean(),
    Adherencia.find(filtroAdh).select('dietaId fecha tiempo estado').sort({ fecha: 1 }).lean(),
    Cita.find({ pacienteId, ...(rango && { fechaHora: rango }) }).sort({ fechaHora: -1 }).lean(),
    pesoInicial(paciente),
  ]);

  const enRango = rango
    ? todas.filter((m) => (!rango.$gte || m.fecha >= rango.$gte) && (!rango.$lte || m.fecha <= rango.$lte))
    : todas;
  const vigente = prescripciones[0] || null;
  const ultimos = ultimosValores(todas, [...CAMPOS_SERIE, ...CAMPOS_LAB, 'estaturaCm']);
  const pesoActual = ultimos.pesoKg?.valor ?? null;

  /* Evaluación con los datos más recientes y la prescripción vigente (no se guarda) */
  const evaluacionActual = evaluarMedicion({
    paciente,
    medicion: {
      pesoKg: pesoActual,
      estaturaCm: ultimos.estaturaCm?.valor,
      cinturaCm: ultimos.cinturaCm?.valor,
      caderaCm: ultimos.caderaCm?.valor,
      grasaPorcentaje: ultimos.grasaPorcentaje?.valor,
    },
    prescripcion: vigente,
    pesoInicialKg: inicial.valor,
  });

  const serie = (campo) => todas.filter((m) => m[campo] != null).map((m) => ({ fecha: m.fecha, valor: m[campo] }));
  const variaciones = Object.fromEntries(
    CAMPOS_SERIE.map((c) => [c, { semanal: F.variacionPeriodo(serie(c), 7), mensual: F.variacionPeriodo(serie(c), 30) }])
  );

  /* Hidratación y actividad dentro del periodo */
  const conAgua = enRango.filter((m) => m.aguaMl != null);
  const conActividad = enRango.filter((m) => m.actividadMinutos != null);
  const diasPeriodo = rango?.$gte
    ? Math.max(1, Math.round(((rango.$lte || new Date()) - rango.$gte) / DIA_MS))
    : enRango.length > 1
      ? Math.max(1, Math.round((enRango[enRango.length - 1].fecha - enRango[0].fecha) / DIA_MS))
      : null;
  const minutosTotales = conActividad.reduce((t, m) => t + m.actividadMinutos, 0);

  const resumen = {
    pesoInicial: { valor: inicial.valor, origen: 'medido', fuente: inicial.fuente, unidad: 'kg' },
    pesoActual: { valor: pesoActual, origen: 'medido', fecha: ultimos.pesoKg?.fecha ?? null, unidad: 'kg' },
    pesoObjetivo: { valor: vigente?.pesoObjetivoKg ?? null, origen: 'prescrito', unidad: 'kg' },
    cumplimientoObjetivos: F.cumplimientoObjetivos([
      { nombre: 'Peso', valorInicial: inicial.valor, valorActual: pesoActual, valorObjetivo: vigente?.pesoObjetivoKg },
      { nombre: 'Cintura', valorInicial: primerValor(todas, 'cinturaCm'), valorActual: ultimos.cinturaCm?.valor, valorObjetivo: vigente?.cinturaObjetivoCm },
      { nombre: '% grasa', valorInicial: primerValor(todas, 'grasaPorcentaje'), valorActual: ultimos.grasaPorcentaje?.valor, valorObjetivo: vigente?.grasaObjetivoPct },
    ]),
    variaciones,
    consumo: {
      promedio: F.promedioConsumoCalorico(enRango.map((m) => m.consumoKcal)),
      objetivo: { valor: vigente?.kcalObjetivo ?? null, origen: 'prescrito', unidad: 'kcal/día' },
    },
    adherencia: F.adherenciaPlan(adherencia),
    hidratacion: {
      promedioMl: conAgua.length ? Math.round(conAgua.reduce((t, m) => t + m.aguaMl, 0) / conAgua.length) : null,
      registros: conAgua.length,
      objetivoPrescritoMl: vigente?.aguaObjetivoMl ?? null,
      estimado: evaluacionActual.hidratacion,
    },
    actividad: {
      minutosTotales: conActividad.length ? minutosTotales : null,
      promedioSemanalMin: conActividad.length && diasPeriodo ? Math.round((minutosTotales / diasPeriodo) * 7) : null,
      registros: conActividad.length,
      objetivoSemanalMin: vigente?.actividadObjetivoMinSemana ?? null,
    },
    laboratorio: Object.fromEntries(CAMPOS_LAB.filter((c) => ultimos[c]).map((c) => [c, ultimos[c]])),
  };

  registrarAuditoria(req, { accion: 'consultar', entidad: 'DashboardPaciente', pacienteId });

  res.json({
    versionFormulas: F.VERSION_FORMULAS,
    unidades: Medicion.UNIDADES,
    paciente,
    prescripcionVigente: vigente,
    prescripciones,
    mediciones: enRango,
    adherencia,
    citas,
    evaluacionActual,
    resumen,
  });
});

/* ============================================================
 * GET /api/estadisticas/resumen?anio=AAAA
 * ============================================================ */
const resumenAdministrativo = controlador(async (req, res) => {
  const anio = Number(req.query.anio) || new Date().getFullYear();
  if (anio < 2000 || anio > 2100) throw new ErrorHttp(400, 'Año no válido');
  if (!tienePermiso(req.usuario, 'estadisticas:leer')) throw new ErrorHttp(403, 'Sin permiso para estadísticas clínicas');
  // Ámbito: el administrador ve todo; el nutriólogo, solo sus expedientes
  const ambito = await pacientesAccesibles(req.usuario);
  const mP = ambito ? { _id: { $in: ambito } } : {};
  const mR = ambito ? { pacienteId: { $in: ambito } } : {};
  const inicio = new Date(Date.UTC(anio, 0, 1));
  const fin = new Date(Date.UTC(anio + 1, 0, 1));
  const ahora = new Date();
  const hace14 = new Date(ahora - 14 * DIA_MS).toISOString().slice(0, 10);
  const hace30 = new Date(ahora - 30 * DIA_MS);
  const mes = (campo) => ({ $month: { date: campo, timezone: ZONA } });

  const [
    estados, nuevosPorMes, citasPorMes, objetivos, adherenciaPorMes,
    indicadoresPorMes, ultimasEvaluaciones, adherenciaPorPaciente, mapaCalor,
    medicionesPorMes, seguimiento, proximas,
  ] = await Promise.all([
    Paciente.aggregate([{ $match: mP }, { $group: { _id: '$estado', total: { $sum: 1 } } }]),

    Paciente.aggregate([
      { $match: { ...mP, fechaRegistro: { $gte: inicio, $lt: fin } } },
      { $group: { _id: mes('$fechaRegistro'), total: { $sum: 1 } } },
    ]),

    Cita.aggregate([
      { $match: { ...mR, fechaHora: { $gte: inicio, $lt: fin } } },
      { $group: { _id: { mes: mes('$fechaHora'), estado: '$estado' }, total: { $sum: 1 } } },
    ]),

    Paciente.aggregate([
      { $match: mP },
      { $group: { _id: { $ifNull: ['$objetivo', 'Sin objetivo'] }, total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),

    Adherencia.aggregate([
      { $match: { ...mR, estado: { $ne: null }, fecha: { $regex: `^${anio}-` } } },
      { $group: { _id: { $toInt: { $substrCP: ['$fecha', 5, 2] } }, promedio: { $avg: PUNTAJE_EXPR }, registros: { $sum: 1 } } },
    ]),

    Evaluacion.aggregate([
      { $match: { ...mR, vigente: true, fecha: { $gte: inicio, $lt: fin } } },
      {
        $group: {
          _id: mes('$fecha'),
          imcPromedio: { $avg: '$resultados.imc.valor' },
          cambioPesoPromedio: { $avg: '$resultados.cambioPeso.valor' },
          evaluaciones: { $sum: 1 },
        },
      },
    ]),

    Evaluacion.aggregate([
      { $match: { ...mR, vigente: true } },
      { $sort: { fecha: -1 } },
      {
        $group: {
          _id: '$pacienteId',
          imc: { $first: '$resultados.imc.valor' },
          cambioPeso: { $first: '$resultados.cambioPeso.valor' },
          fecha: { $first: '$fecha' },
        },
      },
    ]),

    Adherencia.aggregate([
      { $match: { ...mR, estado: { $ne: null } } },
      { $group: { _id: '$pacienteId', promedio: { $avg: PUNTAJE_EXPR }, registros: { $sum: 1 } } },
    ]),

    Cita.aggregate([
      { $match: { ...mR, fechaHora: { $gte: inicio, $lt: fin }, estado: { $in: ['programada', 'realizada'] } } },
      {
        $group: {
          _id: { dia: { $dayOfWeek: { date: '$fechaHora', timezone: ZONA } }, hora: { $hour: { date: '$fechaHora', timezone: ZONA } } },
          total: { $sum: 1 },
        },
      },
    ]),

    Medicion.aggregate([
      { $match: { ...mR, vigente: true, anulada: false, fecha: { $gte: inicio, $lt: fin } } },
      { $group: { _id: mes('$fecha'), total: { $sum: 1 } } },
    ]),

    /* Seguimiento: un documento por paciente activo con sus banderas */
    Paciente.aggregate([
      { $match: { ...mP, estado: 'activo' } },
      {
        $lookup: {
          from: 'mediciones',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$pacienteId', '$$pid'] }, vigente: true, anulada: false } },
            { $sort: { fecha: -1 } }, { $limit: 1 }, { $project: { fecha: 1 } },
          ],
          as: 'ultimaMedicion',
        },
      },
      {
        $lookup: {
          from: 'citas',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$pacienteId', '$$pid'] } } },
            {
              $group: {
                _id: null,
                proximas: { $sum: { $cond: [{ $and: [{ $eq: ['$estado', 'programada'] }, { $gte: ['$fechaHora', ahora] }] }, 1, 0] } },
                inasistencias30: { $sum: { $cond: [{ $and: [{ $eq: ['$estado', 'no_asistio'] }, { $gte: ['$fechaHora', hace30] }] }, 1, 0] } },
              },
            },
          ],
          as: 'citas',
        },
      },
      {
        $lookup: {
          from: 'prescripciones',
          let: { pid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$pacienteId', '$$pid'] }, vigente: true } }, { $limit: 1 }, { $project: { _id: 1 } }],
          as: 'prescripcion',
        },
      },
      {
        $lookup: {
          from: 'adherencias',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$pacienteId', '$$pid'] }, estado: { $ne: null }, fecha: { $gte: hace14 } } },
            { $group: { _id: null, promedio: { $avg: PUNTAJE_EXPR }, registros: { $sum: 1 } } },
          ],
          as: 'adherencia14',
        },
      },
      {
        $project: {
          nombreCompleto: 1,
          ultimaMedicion: { $first: '$ultimaMedicion.fecha' },
          proximas: { $ifNull: [{ $first: '$citas.proximas' }, 0] },
          inasistencias30: { $ifNull: [{ $first: '$citas.inasistencias30' }, 0] },
          tienePrescripcion: { $gt: [{ $size: '$prescripcion' }, 0] },
          adherencia14: { $first: '$adherencia14' },
        },
      },
    ]),

    Cita.countDocuments({ ...mR, estado: 'programada', fechaHora: { $gte: ahora } }),
  ]);

  /* --- Ensamblado de series mensuales (1..12) --- */
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const porMes = (filas, campo = 'total') => meses.map((m) => filas.find((f) => f._id === m)?.[campo] ?? 0);
  const citasEstado = (estado) => meses.map((m) => citasPorMes.find((f) => f._id.mes === m && f._id.estado === estado)?.total ?? 0);

  const citas = {
    programada: citasEstado('programada'),
    realizada: citasEstado('realizada'),
    cancelada: citasEstado('cancelada'),
    no_asistio: citasEstado('no_asistio'),
  };
  const suma = (a) => a.reduce((x, y) => x + y, 0);
  const asistenciaMes = meses.map((_, i) => {
    const base = citas.realizada[i] + citas.no_asistio[i];
    return base ? Math.round((citas.realizada[i] / base) * 1000) / 10 : null;
  });
  const baseAnual = suma(citas.realizada) + suma(citas.no_asistio);

  /* --- Alertas de seguimiento (banderas, no diagnósticos) --- */
  const alertas = [];
  const pendientes = [];
  seguimiento.forEach((p) => {
    const dias = p.ultimaMedicion ? Math.floor((ahora - p.ultimaMedicion) / DIA_MS) : null;
    const banderas = [];
    if (dias === null) banderas.push({ tipo: 'sin_mediciones', texto: 'Sin mediciones registradas' });
    else if (dias > 30) banderas.push({ tipo: 'medicion_antigua', texto: `Última medición hace ${dias} días` });
    if (!p.proximas) banderas.push({ tipo: 'sin_cita', texto: 'Sin cita programada' });
    if (p.inasistencias30) banderas.push({ tipo: 'inasistencia', texto: `${p.inasistencias30} inasistencia(s) en 30 días` });
    if (!p.tienePrescripcion) banderas.push({ tipo: 'sin_prescripcion', texto: 'Sin prescripción registrada' });
    if (p.adherencia14 && p.adherencia14.registros >= 3 && p.adherencia14.promedio < 0.5) {
      banderas.push({ tipo: 'adherencia_baja', texto: `Adherencia registrada ${Math.round(p.adherencia14.promedio * 100)} % (14 días)` });
    }
    if (banderas.length) alertas.push({ pacienteId: p._id, nombreCompleto: p.nombreCompleto, banderas });
    if (!p.proximas && (dias === null || dias > 30)) {
      pendientes.push({ pacienteId: p._id, nombreCompleto: p.nombreCompleto, diasSinMedicion: dias });
    }
  });

  /* --- Distribución de IMC (histograma) y dispersión adherencia vs cambio de peso --- */
  const bins = [
    { etiqueta: '< 18.5', min: 0, max: 18.5 },
    { etiqueta: '18.5–24.9', min: 18.5, max: 25 },
    { etiqueta: '25–29.9', min: 25, max: 30 },
    { etiqueta: '30–34.9', min: 30, max: 35 },
    { etiqueta: '35–39.9', min: 35, max: 40 },
    { etiqueta: '≥ 40', min: 40, max: Infinity },
  ];
  const conImc = ultimasEvaluaciones.filter((e) => typeof e.imc === 'number');
  const histogramaImc = bins.map((b) => ({ ...b, max: Number.isFinite(b.max) ? b.max : null, total: conImc.filter((e) => e.imc >= b.min && e.imc < b.max).length }));

  const adhMap = new Map(adherenciaPorPaciente.map((a) => [String(a._id), a]));
  const dispersion = ultimasEvaluaciones
    .filter((e) => typeof e.cambioPeso === 'number' && adhMap.has(String(e._id)))
    .map((e) => ({
      pacienteId: e._id,
      adherencia: Math.round(adhMap.get(String(e._id)).promedio * 1000) / 10,
      cambioPeso: e.cambioPeso,
    }));

  const estadoTotal = (e) => estados.find((x) => x._id === e)?.total ?? 0;
  const adhAnual = adherenciaPorMes.reduce((t, f) => ({ p: t.p + f.promedio * f.registros, n: t.n + f.registros }), { p: 0, n: 0 });

  registrarAuditoria(req, { accion: 'consultar', entidad: 'EstadisticasAdministrativas' });

  res.json({
    anio,
    zonaHoraria: ZONA,
    generado: ahora,
    kpis: {
      activos: estadoTotal('activo'),
      inactivos: estadoTotal('baja'),
      nuevosAnio: suma(porMes(nuevosPorMes)),
      citasProximas: proximas,
      citasRealizadasAnio: suma(citas.realizada),
      citasCanceladasAnio: suma(citas.cancelada),
      asistenciaAnio: baseAnual ? Math.round((suma(citas.realizada) / baseAnual) * 1000) / 10 : null,
      adherenciaAnio: adhAnual.n ? Math.round((adhAnual.p / adhAnual.n) * 1000) / 10 : null,
      pendientesSeguimiento: pendientes.length,
      medicionesAnio: suma(porMes(medicionesPorMes)),
    },
    mensual: {
      nuevosPacientes: porMes(nuevosPorMes),
      citas,
      asistencia: asistenciaMes,
      adherencia: meses.map((m) => {
        const f = adherenciaPorMes.find((x) => x._id === m);
        return f ? Math.round(f.promedio * 1000) / 10 : null;
      }),
      imcPromedio: meses.map((m) => {
        const f = indicadoresPorMes.find((x) => x._id === m);
        return f && f.imcPromedio != null ? Math.round(f.imcPromedio * 10) / 10 : null;
      }),
      cambioPesoPromedio: meses.map((m) => {
        const f = indicadoresPorMes.find((x) => x._id === m);
        return f && f.cambioPesoPromedio != null ? Math.round(f.cambioPesoPromedio * 100) / 100 : null;
      }),
      mediciones: porMes(medicionesPorMes),
    },
    objetivos: objetivos.map((o) => ({ objetivo: o._id, total: o.total })),
    histogramaImc,
    dispersion,
    mapaCalor: mapaCalor.map((c) => ({ dia: c._id.dia, hora: c._id.hora, total: c.total })),
    pendientes,
    alertas,
  });
});

module.exports = { dashboardPaciente, resumenAdministrativo };
