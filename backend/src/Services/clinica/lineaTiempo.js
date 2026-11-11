/**
 * Línea de tiempo clínica: integra eventos de todas las colecciones del
 * expediente en orden cronológico. Cada evento conserva la referencia al
 * registro original ({ coleccion, id, pestana }) para poder abrirlo.
 */
const Consulta = require('../../Models/Consulta');
const Medicion = require('../../Models/Medicion');
const ResultadoLaboratorio = require('../../Models/ResultadoLaboratorio');
const Diagnostico = require('../../Models/Diagnostico');
const Objetivo = require('../../Models/Objetivo');
const PlanNutricional = require('../../Models/PlanNutricional');
const Antecedente = require('../../Models/Antecedente');
const Cita = require('../../Models/Cita');
const { Alerta } = require('../../Models/Alerta');
const { CATEGORIAS } = require('../../Models/Antecedente');

const TIPOS_EVENTO = {
  primera_consulta: 'Primera consulta',
  consulta: 'Consulta',
  adenda: 'Nota de seguimiento / adenda',
  medicion: 'Medición antropométrica',
  laboratorio: 'Resultado de laboratorio',
  diagnostico: 'Diagnóstico',
  objetivo: 'Objetivo',
  revision_objetivo: 'Revisión de objetivo',
  plan: 'Plan nutricional',
  tratamiento: 'Cambio de tratamiento',
  antecedente: 'Antecedente',
  alerta_revisada: 'Alerta revisada',
  cita: 'Cita',
  proxima_cita: 'Próxima consulta',
};

const id = (v) => (v ? String(v) : null);

async function lineaTiempo(pacienteId, { tipos, desde, hasta, profesionalId } = {}) {
  const [consultas, mediciones, labs, diagnosticos, objetivos, planes, antecedentes, citas, alertas] = await Promise.all([
    Consulta.find({ pacienteId }).sort({ fecha: 1 }).lean(),
    Medicion.find({ pacienteId, vigente: true, anulada: false }).sort({ fecha: 1 }).lean(),
    ResultadoLaboratorio.find({ pacienteId, vigente: true }).lean(),
    Diagnostico.find({ pacienteId }).lean(),
    Objetivo.find({ pacienteId }).lean(),
    PlanNutricional.find({ pacienteId }).lean(),
    Antecedente.find({ pacienteId }).lean(),
    Cita.find({ pacienteId }).lean(),
    Alerta.find({ pacienteId, estado: { $in: ['revisada', 'descartada'] } }).lean(),
  ]);

  const eventos = [];
  const agregar = (e) => eventos.push(e);

  consultas.forEach((c, i) => {
    agregar({
      tipo: i === 0 || c.tipo === 'primera_vez' ? 'primera_consulta' : 'consulta',
      fecha: c.fecha,
      titulo: `${i === 0 || c.tipo === 'primera_vez' ? 'Primera consulta' : 'Consulta subsecuente'}${c.motivo ? ` · ${c.motivo}` : ''}`,
      detalle: c.estado === 'firmada' ? `Nota firmada por ${c.firma?.nombre}` : 'Nota en borrador',
      profesional: c.profesional, profesionalId: id(c.profesionalId),
      ref: { coleccion: 'consultas', id: c._id, pestana: 'consultas' },
    });
    (c.adendas || []).forEach((a) => agregar({
      tipo: 'adenda', fecha: a.fecha, titulo: `Adenda (${a.tipo}) a la consulta del ${new Date(c.fecha).toLocaleDateString('es-MX')}`,
      detalle: a.texto?.slice(0, 160), profesional: a.autor, profesionalId: id(a.autorId),
      ref: { coleccion: 'consultas', id: c._id, pestana: 'consultas' },
    }));
  });

  let pesoAnterior = null;
  mediciones.forEach((m) => {
    const partes = [];
    if (m.pesoKg != null) {
      partes.push(`Peso ${m.pesoKg} kg${pesoAnterior != null ? ` (${m.pesoKg - pesoAnterior > 0 ? '+' : ''}${(m.pesoKg - pesoAnterior).toFixed(1)} kg)` : ''}`);
      pesoAnterior = m.pesoKg;
    }
    if (m.cinturaCm != null) partes.push(`cintura ${m.cinturaCm} cm`);
    if (m.grasaPorcentaje != null) partes.push(`grasa ${m.grasaPorcentaje} %`);
    agregar({
      tipo: 'medicion', fecha: m.fecha, titulo: 'Medición antropométrica', detalle: partes.join(' · ') || 'Registro de hábitos',
      profesional: m.responsable, profesionalId: id(m.registradoPor), version: m.version,
      ref: { coleccion: 'mediciones', id: m._id, pestana: 'antropometria' },
    });
  });

  labs.forEach((r) => agregar({
    tipo: 'laboratorio', fecha: r.fechaMuestra, titulo: r.nombre,
    detalle: `${r.valor} ${r.unidad}${r.rangoReferencia?.min != null || r.rangoReferencia?.max != null ? ` (ref. ${r.rangoReferencia.min ?? ''}–${r.rangoReferencia.max ?? ''})` : ''} · ${r.procedencia}`,
    profesional: r.registradoPorNombre, profesionalId: id(r.registradoPor),
    ref: { coleccion: 'laboratorios', id: r._id, pestana: 'laboratorios' },
  }));

  diagnosticos.forEach((d) => agregar({
    tipo: 'diagnostico', fecha: d.fechaDiagnostico, titulo: d.problema, detalle: `Estado: ${d.estado}${d.etiologia ? ` · relacionado con ${d.etiologia}` : ''}`,
    profesional: d.profesional, profesionalId: id(d.profesionalId), ref: { coleccion: 'diagnosticos', id: d._id, pestana: 'diagnosticos' },
  }));

  objetivos.forEach((o) => {
    agregar({
      tipo: 'objetivo', fecha: o.periodo?.inicio || o.createdAt, titulo: `Objetivo: ${o.descripcion}`,
      detalle: o.valorMeta != null ? `Meta ${o.valorMeta} ${o.unidad || ''}` : 'Objetivo cualitativo',
      profesionalId: id(o.profesionalId), ref: { coleccion: 'objetivos', id: o._id, pestana: 'objetivos' },
    });
    (o.revisiones || []).forEach((r) => agregar({
      tipo: 'revision_objetivo', fecha: r.fecha, titulo: `Revisión: ${o.descripcion}`,
      detalle: [r.avance != null && `avance ${r.avance} %`, r.comentario].filter(Boolean).join(' · '),
      profesional: r.usuario, profesionalId: id(r.usuarioId), ref: { coleccion: 'objetivos', id: o._id, pestana: 'objetivos' },
    }));
  });

  planes.forEach((p) => agregar({
    tipo: 'plan', fecha: p.vigencia?.inicio || p.createdAt, titulo: `Plan: ${p.nombre}`,
    detalle: `Estado: ${p.estado}${p.requerimientos?.kcal ? ` · ${p.requerimientos.kcal} kcal/día` : ''}`,
    profesional: p.profesional, profesionalId: id(p.profesionalId), ref: { coleccion: 'planes', id: p._id, pestana: 'plan' },
  }));

  antecedentes.forEach((a) => {
    const tratamiento = ['medicamento', 'suplemento'].includes(a.categoria);
    agregar({
      tipo: tratamiento ? 'tratamiento' : 'antecedente', fecha: a.createdAt,
      titulo: `${CATEGORIAS[a.categoria]}: ${a.descripcion}`,
      detalle: a.version > 1 ? `Actualización v${a.version}${a.motivoCambio ? ` · ${a.motivoCambio}` : ''} · ${a.estado}` : `Registro · ${a.estado}`,
      profesional: a.registradoPorNombre, profesionalId: id(a.registradoPor),
      ref: { coleccion: 'antecedentes', id: a._id, pestana: 'historia' },
    });
  });

  const ahora = new Date();
  citas.forEach((c) => {
    const futura = c.estado === 'programada' && new Date(c.fechaHora) >= ahora;
    if (!futura && c.estado === 'realizada') return; // ya aparece como consulta
    agregar({
      tipo: futura ? 'proxima_cita' : 'cita', fecha: c.fechaHora, titulo: futura ? 'Próxima consulta' : `Cita ${c.estado.replace('_', ' ')}`,
      detalle: c.motivo || '', profesional: c.responsable, ref: { coleccion: 'citas', id: c._id, pestana: 'consultas' },
    });
  });

  alertas.forEach((a) => agregar({
    tipo: 'alerta_revisada', fecha: a.revision?.fecha || a.updatedAt, titulo: `Alerta ${a.estado}: ${a.motivo.slice(0, 90)}`,
    detalle: a.revision?.nota || '', profesional: a.revision?.usuario, profesionalId: id(a.revision?.usuarioId),
    ref: { coleccion: 'alertas', id: a._id, pestana: 'resumen' },
  }));

  const listaTipos = tipos ? String(tipos).split(',') : null;
  const d = desde ? new Date(desde) : null;
  const h = hasta ? new Date(`${String(hasta).slice(0, 10)}T23:59:59.999Z`) : null;
  return eventos
    .filter((e) => e.fecha)
    .filter((e) => !listaTipos || listaTipos.includes(e.tipo))
    .filter((e) => (!d || new Date(e.fecha) >= d) && (!h || new Date(e.fecha) <= h))
    .filter((e) => !profesionalId || e.profesionalId === String(profesionalId))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

module.exports = { lineaTiempo, TIPOS_EVENTO };
