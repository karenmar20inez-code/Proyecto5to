/**
 * Arma el contenido de los documentos clínicos. El frontend solo da formato
 * (impresión / PDF). La minimización para terceros se aplica AQUÍ, en el
 * servidor, para que no dependa de la interfaz.
 */
const Usuario = require('../Models/Usuario');
const Consulta = require('../Models/Consulta');
const Antecedente = require('../Models/Antecedente');
const Diagnostico = require('../Models/Diagnostico');
const PlanNutricional = require('../Models/PlanNutricional');
const { CATEGORIAS } = require('../Models/Antecedente');
const { fichaClinica, datosLongitudinales } = require('./clinica/fichaClinica');
const { resultadosConAjustes } = require('./nutricion/evaluacion');
const { ErrorHttp } = require('./http');

const TIPOS_REPORTE = {
  historia_clinica: { titulo: 'Historia clínica nutricional', terceros: false },
  resumen_consulta: { titulo: 'Resumen de consulta', terceros: true },
  evaluacion_nutricional: { titulo: 'Evaluación nutricional', terceros: true },
  plan_alimenticio: { titulo: 'Plan alimenticio', terceros: true },
  evolucion: { titulo: 'Reporte de evolución', terceros: true },
  antropometria: { titulo: 'Resultados antropométricos', terceros: true },
  objetivos: { titulo: 'Seguimiento de objetivos', terceros: true },
};

async function armarReporte(tipo, pacienteId, { terceros = false, consultaId, usuario } = {}) {
  const def = TIPOS_REPORTE[tipo];
  if (!def) throw new ErrorHttp(400, 'Tipo de reporte no válido');
  if (terceros && !def.terceros) throw new ErrorHttp(400, 'La historia clínica completa no se emite para terceros');

  const ficha = await fichaClinica(pacienteId);
  if (!ficha) throw new ErrorHttp(404, 'Paciente no encontrado');
  const { paciente, expediente } = ficha;

  const identificacion = terceros
    ? { nombreCompleto: paciente.nombreCompleto, edad: paciente.edadActual, folio: expediente.folio }
    : {
        nombreCompleto: paciente.nombreCompleto, edad: paciente.edadActual, folio: expediente.folio, sexo: paciente.sexo,
        fechaNacimiento: paciente.fechaNacimiento, curp: paciente.curp, telefono: paciente.telefono, correo: paciente.correo,
        ocupacion: paciente.ocupacion, contactoEmergencia: paciente.contactoEmergencia,
      };

  const documento = {
    tipo, titulo: def.titulo, paraTerceros: !!terceros, generado: new Date(),
    generadoPor: usuario && { nombre: usuario.nombre, cedulaProfesional: usuario.cedulaProfesional },
    profesionalResponsable: expediente.responsable,
    versionFormulas: ficha.versionFormulas,
  };
  const secciones = {};
  const datos = await datosLongitudinales(pacienteId);
  const mediciones = datos.mediciones.map((m) => ({
    _id: m._id, fecha: m.fecha, version: m.version, pesoKg: m.pesoKg, estaturaCm: m.estaturaCm, cinturaCm: m.cinturaCm,
    caderaCm: m.caderaCm, grasaPorcentaje: m.grasaPorcentaje, masaMuscularKg: m.masaMuscularKg, metodos: m.metodos, responsable: m.responsable,
  }));

  if (tipo === 'historia_clinica') {
    const antecedentes = await Antecedente.find({ pacienteId, vigente: true }).sort({ categoria: 1 }).lean();
    secciones.antecedentes = Object.entries(CATEGORIAS).map(([clave, nombre]) => ({
      categoria: nombre, registros: antecedentes.filter((a) => a.categoria === clave),
    })).filter((s) => s.registros.length);
    secciones.diagnosticos = await Diagnostico.find({ pacienteId }).sort({ fechaDiagnostico: -1 }).lean();
    secciones.indicadores = ficha.indicadores;
    secciones.consentimientos = ficha.ficha.consentimientos;
    documento.version = `Antecedentes vigentes al ${new Date().toISOString().slice(0, 10)}`;
  }

  if (tipo === 'resumen_consulta') {
    const consulta = consultaId
      ? await Consulta.findOne({ _id: consultaId, pacienteId }).lean()
      : await Consulta.findOne({ pacienteId }).sort({ fecha: -1 }).lean();
    if (!consulta) throw new ErrorHttp(404, 'No hay consultas registradas');
    secciones.consulta = {
      fecha: consulta.fecha, tipo: consulta.tipo, motivo: consulta.motivo, profesional: consulta.profesional,
      estado: consulta.estado, firma: consulta.firma,
      // Para terceros solo se comparte el plan; el razonamiento clínico queda en el expediente
      soap: terceros ? { plan: consulta.soap.plan } : consulta.soap,
      adendas: terceros ? [] : consulta.adendas,
    };
    secciones.mediciones = mediciones.filter((m) => String(datos.mediciones.find((x) => String(x._id) === String(m._id))?.consultaId) === String(consulta._id));
    documento.version = consulta.estado === 'firmada' ? `Nota firmada · ${consulta.firma.hash.slice(0, 12)}` : 'BORRADOR — sin firma';
  }

  if (tipo === 'evaluacion_nutricional') {
    const ev = datos.evaluaciones[datos.evaluaciones.length - 1];
    secciones.indicadores = ficha.indicadores;
    secciones.evaluacion = ev ? { fecha: ev.fecha, versionFormulas: ev.versionFormulas, resultados: resultadosConAjustes(ev.resultados, ev.ajustes) } : null;
    secciones.diagnosticos = terceros ? [] : ficha.ficha.diagnosticos;
    documento.version = ev ? `Evaluación ${ev._id} · fórmulas v${ev.versionFormulas}` : 'Sin evaluación';
  }

  if (tipo === 'plan_alimenticio') {
    const plan = ficha.ficha.planVigente || await PlanNutricional.findOne({ pacienteId }).sort({ createdAt: -1 }).lean();
    if (!plan) throw new ErrorHttp(404, 'No hay plan nutricional registrado');
    secciones.plan = plan;
    secciones.objetivos = ficha.ficha.objetivos.filter((o) => (plan.objetivoIds || []).some((id) => String(id) === String(o._id)));
    secciones.alergias = ficha.ficha.alergias.map((a) => ({ categoria: a.categoria, descripcion: a.descripcion }));
    documento.version = `Plan ${plan._id} · ${plan.estado} · actualizado ${new Date(plan.updatedAt).toISOString().slice(0, 10)}`;
  }

  if (tipo === 'evolucion' || tipo === 'antropometria') {
    secciones.mediciones = mediciones;
    secciones.indicadores = ficha.indicadores;
    if (tipo === 'evolucion') {
      secciones.objetivos = ficha.ficha.objetivos;
      secciones.laboratorios = terceros ? [] : datos.laboratorios;
    }
    documento.version = `${mediciones.length} mediciones vigentes`;
  }

  if (tipo === 'objetivos') {
    secciones.objetivos = ficha.ficha.objetivos;
    documento.version = `${secciones.objetivos.length} objetivos activos`;
  }

  if (!documento.profesionalResponsable && expediente.responsableId) {
    documento.profesionalResponsable = await Usuario.findById(expediente.responsableId).select('nombre cedulaProfesional').lean();
  }
  return { documento, paciente: identificacion, secciones };
}

module.exports = { armarReporte, TIPOS_REPORTE };
