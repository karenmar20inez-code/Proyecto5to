/**
 * Orquestador de alertas: carga el contexto clínico del paciente, evalúa las
 * reglas activas y sincroniza la colección de alertas:
 *  - crea las nuevas (pendiente)
 *  - no reabre las ya revisadas o descartadas
 *  - cierra automáticamente las pendientes cuya condición ya no se cumple
 */
const Paciente = require('../../Models/Paciente');
const Expediente = require('../../Models/Expediente');
const Medicion = require('../../Models/Medicion');
const ResultadoLaboratorio = require('../../Models/ResultadoLaboratorio');
const Cita = require('../../Models/Cita');
const Consulta = require('../../Models/Consulta');
const Objetivo = require('../../Models/Objetivo');
const PlanNutricional = require('../../Models/PlanNutricional');
const Antecedente = require('../../Models/Antecedente');
const Consentimiento = require('../../Models/Consentimiento');
const { Alerta, AlertaRegla } = require('../../Models/Alerta');
const { evaluarReglas, REGLAS_POR_OMISION } = require('./reglasAlerta');

async function asegurarReglasPorOmision() {
  if (await AlertaRegla.estimatedDocumentCount()) return;
  await AlertaRegla.insertMany(REGLAS_POR_OMISION.map((r) => ({ ...r, actualizadoPor: 'instalación' })), { ordered: false }).catch(() => {});
}

async function contextoPaciente(pacienteId) {
  const [paciente, expediente, mediciones, laboratorios, citas, consultas, objetivos, planVigente, antecedentes, consentimientos] = await Promise.all([
    Paciente.findById(pacienteId).lean(),
    Expediente.findOne({ pacienteId }).lean(),
    Medicion.find({ pacienteId, vigente: true, anulada: false }).select('fecha pesoKg estaturaCm').lean(),
    ResultadoLaboratorio.find({ pacienteId, vigente: true }).lean(),
    Cita.find({ pacienteId }).select('fechaHora estado').lean(),
    Consulta.find({ pacienteId }).select('fecha estado').lean(),
    Objetivo.find({ pacienteId, estado: 'activo' }).lean(),
    PlanNutricional.findOne({ pacienteId, estado: 'vigente' }).lean(),
    Antecedente.find({ pacienteId, vigente: true }).lean(),
    Consentimiento.find({ pacienteId }).lean(),
  ]);
  return { paciente, expediente, mediciones, laboratorios, citas, consultas, objetivos, planVigente, antecedentes, consentimientos, ahora: Date.now() };
}

/** Evalúa y sincroniza las alertas de un paciente. Devuelve las pendientes. */
async function evaluarPaciente(pacienteId) {
  await asegurarReglasPorOmision();
  const reglas = await AlertaRegla.find({ activa: true }).lean();
  const ctx = await contextoPaciente(pacienteId);
  if (!ctx.paciente) return [];

  const candidatas = evaluarReglas(reglas, ctx);
  const llaves = new Set(candidatas.map((c) => c.llave));

  await Promise.all(candidatas.map((c) => Alerta.updateOne(
    { llave: c.llave },
    {
      $setOnInsert: {
        pacienteId, reglaId: c.regla._id, codigoRegla: c.regla.codigo, tipo: c.regla.tipo,
        motivo: c.motivo, prioridad: c.regla.prioridad, origen: c.origen, fecha: new Date(), estado: 'pendiente',
      },
    },
    { upsert: true }
  )));

  await Alerta.updateMany(
    { pacienteId, estado: 'pendiente', llave: { $nin: [...llaves] } },
    { $set: { estado: 'cerrada', revision: { usuario: 'sistema', fecha: new Date(), nota: 'La condición ya no se cumple (cierre automático).' } } }
  );

  return Alerta.find({ pacienteId, estado: 'pendiente' }).sort({ prioridad: -1, fecha: -1 }).lean();
}

/** Ejecuta la evaluación sin bloquear la respuesta HTTP */
function evaluarEnSegundoPlano(pacienteId) {
  evaluarPaciente(pacienteId).catch((e) => console.error('Error al evaluar alertas:', e.message));
}

module.exports = { evaluarPaciente, evaluarEnSegundoPlano, asegurarReglasPorOmision, contextoPaciente };
