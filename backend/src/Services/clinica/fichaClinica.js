/**
 * Ficha clínica vigente: lo que el profesional necesita ver al abrir un
 * expediente. Se CALCULA a partir de los registros (no se copia ni se duplica).
 * Cada indicador incluye valor, unidad, fecha, origen y método.
 */
const Paciente = require('../../Models/Paciente');
const Expediente = require('../../Models/Expediente');
const Usuario = require('../../Models/Usuario');
const Medicion = require('../../Models/Medicion');
const Evaluacion = require('../../Models/Evaluacion');
const ResultadoLaboratorio = require('../../Models/ResultadoLaboratorio');
const Consulta = require('../../Models/Consulta');
const Cita = require('../../Models/Cita');
const Antecedente = require('../../Models/Antecedente');
const Diagnostico = require('../../Models/Diagnostico');
const Objetivo = require('../../Models/Objetivo');
const PlanNutricional = require('../../Models/PlanNutricional');
const Consentimiento = require('../../Models/Consentimiento');
const Adherencia = require('../../Models/Adherencia');
const { Alerta } = require('../../Models/Alerta');
const F = require('../nutricion/formulas');
const { resultadosConAjustes } = require('../nutricion/evaluacion');
const { edadEnFecha } = require('../../Models/Paciente');

const DIA = 86400000;
const METODOS_TEXTO = {
  bascula_digital: 'Báscula digital', bascula_mecanica: 'Báscula mecánica', bioimpedancia: 'Bioimpedancia',
  autorreporte: 'Autorreporte', plicometria: 'Plicometría', dexa: 'DEXA', cinta_metrica: 'Cinta métrica', otro: 'Otro',
};

/** Últimos dos valores de un campo (para mostrar cambio respecto a la anterior) */
function ultimosDos(mediciones, campo) {
  const con = mediciones.filter((m) => m[campo] != null);
  return [con[con.length - 1] || null, con[con.length - 2] || null];
}

function indicadorMedido(mediciones, campo, unidad, claveMetodo) {
  const [act, ant] = ultimosDos(mediciones, campo);
  if (!act) return { valor: null, unidad, origen: 'medido', faltante: true };
  return {
    valor: act[campo], unidad, fecha: act.fecha, origen: 'medido',
    metodo: METODOS_TEXTO[act.metodos?.[claveMetodo]] || 'No especificado',
    registradoPor: act.responsable, medicionId: act._id,
    anterior: ant ? { valor: ant[campo], fecha: ant.fecha, delta: Math.round((act[campo] - ant[campo]) * 100) / 100 } : null,
  };
}

/** Valor actual del indicador de un objetivo, a partir de registros reales */
function valorActualObjetivo(obj, { mediciones, evaluaciones, laboratorios, adherencia }) {
  if (['pesoKg', 'cinturaCm', 'grasaPorcentaje', 'masaMuscularKg'].includes(obj.indicador)) {
    const [act] = ultimosDos(mediciones, obj.indicador);
    return act ? { valor: act[obj.indicador], fecha: act.fecha } : null;
  }
  if (obj.indicador === 'imc') {
    const ev = [...evaluaciones].reverse().find((e) => e.resultados?.imc?.valor != null);
    return ev ? { valor: ev.resultados.imc.valor, fecha: ev.fecha } : null;
  }
  if (obj.indicador === 'laboratorio') {
    const r = laboratorios.filter((l) => l.analito === obj.analito).sort((a, b) => new Date(a.fechaMuestra) - new Date(b.fechaMuestra)).pop();
    return r ? { valor: r.valor, fecha: r.fechaMuestra } : null;
  }
  if (obj.indicador === 'adherencia') {
    const desde = obj.periodo?.inicio ? new Date(obj.periodo.inicio).toISOString().slice(0, 10) : '0000';
    const a = F.adherenciaPlan(adherencia.filter((r) => r.fecha >= desde));
    return a.valor ? { valor: a.valor.porcentaje, fecha: new Date() } : null;
  }
  const rev = obj.revisiones?.[obj.revisiones.length - 1];
  return rev?.avance != null ? { valor: rev.avance, fecha: rev.fecha } : null;
}

function progresoObjetivo(obj, datos) {
  const actual = valorActualObjetivo(obj, datos);
  let progreso = null;
  if (obj.indicador === 'cualitativo') progreso = actual?.valor ?? null;
  else if (actual && obj.valorInicial != null && obj.valorMeta != null) {
    progreso = F.progresoHaciaObjetivo({ valorInicial: obj.valorInicial, valorActual: actual.valor, valorObjetivo: obj.valorMeta }).valor;
  }
  const ultimaRevision = obj.revisiones?.length ? obj.revisiones[obj.revisiones.length - 1].fecha : null;
  return { ...obj, valorActual: actual?.valor ?? null, fechaValorActual: actual?.fecha ?? null, progreso, ultimaRevision };
}

async function datosLongitudinales(pacienteId) {
  const [mediciones, evaluaciones, laboratorios, adherencia] = await Promise.all([
    Medicion.find({ pacienteId, vigente: true, anulada: false }).sort({ fecha: 1 }).lean(),
    Evaluacion.find({ pacienteId, vigente: true }).sort({ fecha: 1 }).lean(),
    ResultadoLaboratorio.find({ pacienteId, vigente: true }).sort({ fechaMuestra: 1 }).lean(),
    Adherencia.find({ pacienteId, estado: { $ne: null } }).select('fecha estado tiempo dietaId').lean(),
  ]);
  return { mediciones, evaluaciones, laboratorios, adherencia };
}

async function fichaClinica(pacienteId) {
  const ahora = new Date();
  const [paciente, expediente, datos, consultas, proximaCita, antecedentes, diagnosticos, objetivos, plan, consentimientos, alertas] = await Promise.all([
    Paciente.findById(pacienteId).lean(),
    Expediente.findOne({ pacienteId }).lean(),
    datosLongitudinales(pacienteId),
    Consulta.find({ pacienteId }).sort({ fecha: -1 }).select('fecha tipo estado profesional motivo').lean(),
    Cita.findOne({ pacienteId, estado: 'programada', fechaHora: { $gte: ahora } }).sort({ fechaHora: 1 }).lean(),
    Antecedente.find({ pacienteId, vigente: true }).sort({ categoria: 1, fechaInicio: -1 }).lean(),
    Diagnostico.find({ pacienteId, estado: { $in: ['activo', 'en_mejora'] } }).sort({ fechaDiagnostico: -1 }).lean(),
    Objetivo.find({ pacienteId, estado: 'activo' }).sort({ createdAt: -1 }).lean(),
    PlanNutricional.findOne({ pacienteId, estado: 'vigente' }).lean(),
    Consentimiento.find({ pacienteId }).sort({ fecha: -1 }).lean(),
    Alerta.find({ pacienteId, estado: 'pendiente' }).sort({ fecha: -1 }).lean(),
  ]);
  if (!paciente) return null;

  const responsable = expediente?.responsableId ? await Usuario.findById(expediente.responsableId).select('nombre cedulaProfesional').lean() : null;
  const { mediciones, evaluaciones } = datos;
  const ultimaEval = evaluaciones[evaluaciones.length - 1];
  const res = ultimaEval ? resultadosConAjustes(ultimaEval.resultados, ultimaEval.ajustes) : {};
  const activos = (cats) => antecedentes.filter((a) => cats.includes(a.categoria) && a.estado === 'activo');
  const objetivosConProgreso = objetivos.map((o) => progresoObjetivo(o, datos));
  const conProgreso = objetivosConProgreso.filter((o) => o.progreso != null);
  const hace30 = new Date(ahora - 30 * DIA).toISOString().slice(0, 10);
  const ultimaConsulta = consultas[0] || null;

  let estadoSeguimiento = 'sin_registros';
  if (alertas.some((a) => a.tipo === 'seguimiento_pendiente')) estadoSeguimiento = 'pendiente';
  else if (proximaCita) estadoSeguimiento = 'programado';
  else if (ultimaConsulta || mediciones.length) estadoSeguimiento = 'al_dia';

  return {
    paciente: { ...paciente, edadActual: paciente.fechaNacimiento ? edadEnFecha(paciente.fechaNacimiento) : paciente.edad },
    expediente: { ...expediente, responsable },
    encabezado: {
      ultimaConsulta: ultimaConsulta && { fecha: ultimaConsulta.fecha, profesional: ultimaConsulta.profesional, estado: ultimaConsulta.estado },
      proximaCita: proximaCita && { fecha: proximaCita.fechaHora, motivo: proximaCita.motivo },
      estadoSeguimiento,
      totalConsultas: consultas.length,
    },
    indicadores: {
      peso: indicadorMedido(mediciones, 'pesoKg', 'kg', 'peso'),
      cintura: indicadorMedido(mediciones, 'cinturaCm', 'cm', 'circunferencias'),
      grasa: indicadorMedido(mediciones, 'grasaPorcentaje', '%', 'composicion'),
      masaMuscular: indicadorMedido(mediciones, 'masaMuscularKg', 'kg', 'composicion'),
      imc: res.imc ? { ...res.imc, fecha: ultimaEval.fecha, metodo: 'peso / estatura²', versionFormulas: ultimaEval.versionFormulas } : { valor: null, faltante: true },
      requerimientoEnergetico: res.get ? {
        ...res.get, fecha: ultimaEval.fecha, versionFormulas: ultimaEval.versionFormulas,
        metodo: res.get.origen === 'ajustado' ? `Ajuste profesional: ${res.get.ajuste?.motivo}` : 'Mifflin-St Jeor × factor de actividad',
      } : { valor: null, faltante: true },
      adherencia: { ...F.adherenciaPlan(datos.adherencia.filter((r) => r.fecha >= hace30)), periodo: 'últimos 30 días' },
      progresoObjetivos: {
        valor: conProgreso.length ? Math.round(conProgreso.reduce((t, o) => t + Math.min(100, Math.max(0, o.progreso)), 0) / conProgreso.length) : null,
        unidad: '%', origen: 'calculado', metodo: 'Promedio del avance de objetivos activos (acotado 0–100)', objetivos: conProgreso.length,
      },
    },
    ficha: {
      alergias: activos(['alergia', 'intolerancia']),
      alergiasNegadas: antecedentes.some((a) => a.categoria === 'alergia' && a.estado === 'negado'),
      medicamentos: activos(['medicamento', 'suplemento']),
      enfermedades: activos(['enfermedad', 'personal_patologico']),
      diagnosticos,
      objetivos: objetivosConProgreso,
      planVigente: plan,
      consentimientos: {
        datosSensibles: consentimientos.find((c) => c.tipo === 'datos_sensibles' && c.otorgado && !c.revocacion?.fecha) || null,
        avisoPrivacidad: consentimientos.find((c) => c.tipo === 'aviso_privacidad' && c.otorgado && !c.revocacion?.fecha) || null,
      },
    },
    alertas,
    versionFormulas: F.VERSION_FORMULAS,
  };
}

module.exports = { fichaClinica, datosLongitudinales, progresoObjetivo, valorActualObjetivo };
