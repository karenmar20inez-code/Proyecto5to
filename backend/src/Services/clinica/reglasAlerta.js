/**
 * Reglas de alerta · funciones PURAS (sin base de datos).
 * Cada regla recibe (regla, contexto) y devuelve candidatas:
 *   { llave, motivo, origen: { coleccion, id, pestana } }
 * Las alertas señalan algo que requiere REVISIÓN PROFESIONAL; no son diagnósticos.
 *
 * La `llave` incluye el "ancla" del evento (id del registro o fecha de la última
 * revisión) para no duplicar alertas ni reabrir las ya revisadas.
 */
const { ANALITOS } = require('./analitos');

const DIA = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PALABRAS_VACIAS = new Set(['alergia', 'alergico', 'alergica', 'intolerancia', 'intolerante', 'al', 'a', 'la', 'el', 'los', 'las', 'de', 'del', 'y', 'o', 'por', 'con', 'sin', 'leve', 'severa', 'grave']);

/** Último resultado vigente de cada analito */
function ultimosPorAnalito(laboratorios = []) {
  const m = new Map();
  [...laboratorios].sort((a, b) => new Date(a.fechaMuestra) - new Date(b.fechaMuestra)).forEach((r) => m.set(r.analito, r));
  return [...m.values()];
}

const rango = (r) => {
  const { min, max } = r.rangoReferencia || {};
  return min != null && max != null ? `${min}–${max}` : min != null ? `≥ ${min}` : max != null ? `≤ ${max}` : '';
};

const REGLAS = {
  laboratorio_fuera_rango_lab(regla, { laboratorios }) {
    return ultimosPorAnalito(laboratorios).flatMap((r) => {
      const { min, max } = r.rangoReferencia || {};
      const lado = min != null && r.valor < min ? 'por debajo' : max != null && r.valor > max ? 'por encima' : null;
      if (!lado) return [];
      return [{
        llave: `${regla.codigo}|${r._id}`,
        motivo: `${r.nombre}: ${r.valor} ${r.unidad} (${iso(r.fechaMuestra)}) ${lado} del rango de referencia del laboratorio (${rango(r)} ${r.unidad}).`,
        origen: { coleccion: 'laboratorios', id: r._id, pestana: 'laboratorios' },
      }];
    });
  },

  laboratorio_umbral(regla, { laboratorios }) {
    const { analito, min, max } = regla.parametros || {};
    if (!analito || (min == null && max == null)) return [];
    const r = ultimosPorAnalito(laboratorios).find((x) => x.analito === analito);
    if (!r) return [];
    const fuera = (min != null && r.valor < min) || (max != null && r.valor > max);
    if (!fuera) return [];
    return [{
      llave: `${regla.codigo}|${r._id}`,
      motivo: `${r.nombre}: ${r.valor} ${r.unidad} fuera del umbral configurado (${min ?? '—'} a ${max ?? '—'}).`,
      origen: { coleccion: 'laboratorios', id: r._id, pestana: 'laboratorios' },
    }];
  },

  cambio_peso(regla, { mediciones }) {
    const { porcentaje = 5, dias = 180 } = regla.parametros || {};
    const pesos = mediciones.filter((m) => m.pesoKg != null).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (pesos.length < 2) return [];
    const ultima = pesos[pesos.length - 1];
    const limite = new Date(ultima.fecha).getTime() - dias * DIA;
    const ventana = pesos.filter((m) => new Date(m.fecha).getTime() >= limite && m !== ultima);
    if (!ventana.length) return [];
    const base = ventana[0];
    const cambio = ((ultima.pesoKg - base.pesoKg) / base.pesoKg) * 100;
    if (Math.abs(cambio) < porcentaje) return [];
    return [{
      llave: `${regla.codigo}|${ultima._id}`,
      motivo: `Cambio de peso de ${cambio > 0 ? '+' : ''}${cambio.toFixed(1)} % (${base.pesoKg} → ${ultima.pesoKg} kg) entre ${iso(base.fecha)} y ${iso(ultima.fecha)}; umbral configurado ${porcentaje} % en ${dias} días.`,
      origen: { coleccion: 'mediciones', id: ultima._id, pestana: 'antropometria' },
    }];
  },

  seguimiento_pendiente(regla, { paciente, expediente, consultas, mediciones, citas, ahora }) {
    const { dias = 30 } = regla.parametros || {};
    if (paciente.estado !== 'activo' || ['alta', 'archivado'].includes(expediente?.estado)) return [];
    if (citas.some((c) => c.estado === 'programada' && new Date(c.fechaHora) >= ahora)) return [];
    const fechas = [...consultas.map((c) => c.fecha), ...mediciones.map((m) => m.fecha)].map((f) => new Date(f).getTime());
    const ultimo = fechas.length ? Math.max(...fechas) : null;
    if (ultimo && ahora - ultimo <= dias * DIA) return [];
    return [{
      llave: `${regla.codigo}|${paciente._id}|${ultimo ? iso(ultimo) : 'sin-registros'}`,
      motivo: ultimo
        ? `Sin cita programada y último registro clínico hace ${Math.floor((ahora - ultimo) / DIA)} días (umbral ${dias}).`
        : 'Sin consultas ni mediciones registradas y sin cita programada.',
      origen: { coleccion: 'pacientes', id: paciente._id, pestana: 'resumen' },
    }];
  },

  objetivo_sin_revision(regla, { objetivos, ahora }) {
    return objetivos.filter((o) => o.estado === 'activo').flatMap((o) => {
      const ultima = o.revisiones?.length ? o.revisiones[o.revisiones.length - 1].fecha : o.createdAt || o.periodo?.inicio;
      const dias = o.frecuenciaRevisionDias || 30;
      if (!ultima || ahora - new Date(ultima).getTime() <= dias * DIA) return [];
      return [{
        llave: `${regla.codigo}|${o._id}|${iso(ultima)}`,
        motivo: `Objetivo «${o.descripcion}» sin revisión desde ${iso(ultima)} (frecuencia: cada ${dias} días).`,
        origen: { coleccion: 'objetivos', id: o._id, pestana: 'objetivos' },
      }];
    });
  },

  datos_incompletos(regla, { paciente, mediciones, antecedentes, consentimientos }) {
    const faltan = [];
    if (!paciente.fechaNacimiento) faltan.push('fecha de nacimiento');
    if (!paciente.sexo) faltan.push('sexo');
    if (!paciente.estatura && !mediciones.some((m) => m.estaturaCm)) faltan.push('estatura');
    if (!antecedentes.some((a) => a.categoria === 'alergia')) faltan.push('registro de alergias (o negación explícita)');
    const consentido = consentimientos.some((c) => c.tipo === 'datos_sensibles' && c.otorgado && !c.revocacion?.fecha);
    if (!consentido) faltan.push('consentimiento expreso para datos de salud');
    if (!faltan.length) return [];
    return [{
      llave: `${regla.codigo}|${paciente._id}|${faltan.join(',')}`,
      motivo: `Información faltante: ${faltan.join('; ')}.`,
      origen: { coleccion: 'pacientes', id: paciente._id, pestana: 'historia' },
    }];
  },

  consulta_no_realizada(regla, { citas, ahora }) {
    const { dias = 30 } = regla.parametros || {};
    return citas.flatMap((c) => {
      const t = new Date(c.fechaHora).getTime();
      if (ahora - t > dias * DIA) return [];
      if (c.estado === 'no_asistio') {
        return [{ llave: `${regla.codigo}|${c._id}`, motivo: `El paciente no asistió a la cita del ${iso(t)}.`, origen: { coleccion: 'citas', id: c._id, pestana: 'consultas' } }];
      }
      if (c.estado === 'programada' && ahora - t > DIA) {
        return [{ llave: `${regla.codigo}|${c._id}`, motivo: `La cita del ${iso(t)} sigue como programada: confirma si se realizó.`, origen: { coleccion: 'citas', id: c._id, pestana: 'consultas' } }];
      }
      return [];
    });
  },

  alergia_en_plan(regla, { planVigente, antecedentes }) {
    if (!planVigente?.alimentos?.length) return [];
    const restricciones = antecedentes.filter((a) => ['alergia', 'intolerancia'].includes(a.categoria) && a.estado === 'activo');
    return restricciones.flatMap((a) => {
      const terminos = normalizar(a.descripcion).split(/[^a-zñ]+/).filter((t) => t.length >= 4 && !PALABRAS_VACIAS.has(t));
      const coincidencias = planVigente.alimentos.filter((al) => terminos.some((t) => normalizar(al).includes(t)));
      if (!coincidencias.length) return [];
      return [{
        llave: `${regla.codigo}|${planVigente._id}|${a.grupoId || a._id}`,
        motivo: `Revisión requerida: el plan «${planVigente.nombre}» incluye ${[...new Set(coincidencias)].slice(0, 5).join(', ')} y hay ${a.categoria} registrada: «${a.descripcion}».`,
        origen: { coleccion: 'planes', id: planVigente._id, pestana: 'plan' },
      }];
    });
  },
};

/** Reglas sugeridas al instalar. Los valores son configurables por el administrador. */
const REGLAS_POR_OMISION = [
  { codigo: 'LAB-RANGO-LAB', tipo: 'laboratorio_fuera_rango_lab', nombre: 'Laboratorio fuera de rango del laboratorio', prioridad: 'media', parametros: {}, nota: 'Usa el rango de referencia capturado del propio reporte de laboratorio.' },
  { codigo: 'PESO-CAMBIO', tipo: 'cambio_peso', nombre: 'Cambio de peso relevante', prioridad: 'media', parametros: { porcentaje: 5, dias: 180 }, nota: 'Valor por omisión inspirado en criterios GLIM (pérdida > 5 % en 6 meses). Ajústelo a su criterio clínico.' },
  { codigo: 'SEGUIMIENTO', tipo: 'seguimiento_pendiente', nombre: 'Seguimiento pendiente', prioridad: 'baja', parametros: { dias: 30 }, nota: 'Umbral operativo de agenda, no clínico.' },
  { codigo: 'OBJ-REVISION', tipo: 'objetivo_sin_revision', nombre: 'Objetivo sin revisión', prioridad: 'baja', parametros: {}, nota: 'Usa la frecuencia de revisión de cada objetivo.' },
  { codigo: 'DATOS-INCOMPLETOS', tipo: 'datos_incompletos', nombre: 'Datos clínicos incompletos', prioridad: 'baja', parametros: {} },
  { codigo: 'CITA-NO-REALIZADA', tipo: 'consulta_no_realizada', nombre: 'Consulta no realizada', prioridad: 'baja', parametros: { dias: 30 } },
  { codigo: 'ALERGIA-PLAN', tipo: 'alergia_en_plan', nombre: 'Alimento del plan coincide con alergia/intolerancia', prioridad: 'alta', parametros: {}, nota: 'Coincidencia por texto: requiere revisión profesional; puede tener falsos positivos y negativos.' },
];

function evaluarReglas(reglas, contexto) {
  return reglas.filter((r) => r.activa !== false && REGLAS[r.tipo]).flatMap((regla) =>
    REGLAS[regla.tipo](regla, contexto).map((c) => ({ ...c, regla })));
}

module.exports = { REGLAS, REGLAS_POR_OMISION, evaluarReglas, ultimosPorAnalito, normalizar, ANALITOS };
