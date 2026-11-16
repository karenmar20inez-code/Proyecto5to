/**
 * Portal del paciente (/api/portal). Solo para cuentas con rol paciente.
 *
 * Aislamiento: el paciente SIEMPRE se toma de la sesión (req.usuario.pacienteId), nunca de la URL
 * ni del cuerpo, así que no hay forma de pedir datos de otro paciente.
 * Solo se entrega lo que su nutriólogo autorizó en el expediente (expediente.portal) y nunca
 * notas clínicas, diagnósticos, antecedentes, laboratorios ni comentarios internos.
 */
const Paciente = require('../Models/Paciente');
const Expediente = require('../Models/Expediente');
const Usuario = require('../Models/Usuario');
const Consultorio = require('../Models/Consultorio');
const Cita = require('../Models/Cita');
const Medicion = require('../Models/Medicion');
const PlanNutricional = require('../Models/PlanNutricional');
const Adherencia = require('../Models/Adherencia');
const Dieta = require('../Models/Dieta');
const { sembrarBase } = require('./dietaController');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, controlador } = require('../Services/http');

const ANTROPOMETRIA = ['pesoKg', 'estaturaCm', 'cinturaCm', 'caderaCm', 'grasaPorcentaje', 'masaMuscularKg'];
const CLINICOS = ['presionSistolica', 'presionDiastolica', 'glucosaMgDl', 'colesterolTotalMgDl', 'hdlMgDl', 'ldlMgDl', 'trigliceridosMgDl', 'hba1cPct'];

const imcDe = (peso, estatura) => (peso && estatura ? Math.round((peso / ((estatura / 100) ** 2)) * 10) / 10 : null);

// GET /api/portal  → toda la información visible para el paciente que inició sesión
const miEspacio = controlador(async (req, res) => {
  const pacienteId = req.usuario.pacienteId;
  if (req.usuario.rol !== 'paciente' || !pacienteId) {
    throw new ErrorHttp(404, 'Tu cuenta no está ligada a un paciente. El portal es solo para cuentas de paciente.');
  }
  const [paciente, expediente] = await Promise.all([
    Paciente.findById(pacienteId).lean(),
    Expediente.findOne({ pacienteId }).lean(),
  ]);
  if (!paciente || !expediente) throw new ErrorHttp(404, 'No encontramos tu expediente. Comunícate con tu consultorio.');
  // Solo lo autorizado expresamente por su nutriólogo (lo no definido cuenta como no autorizado)
  const portal = Object.fromEntries(Expediente.CLAVES_PORTAL.map((k) => [k, expediente.portal?.[k] === true]));

  const ahora = new Date();
  if (portal.dieta && paciente.dietaId) await sembrarBase(); // el catálogo inicial existe aunque nadie haya abierto Dietas
  const [responsable, consultorio, citas, mediciones, plan, dieta] = await Promise.all([
    expediente.responsableId ? Usuario.findById(expediente.responsableId).select('nombre cedulaProfesional especialidad correo telefono').lean() : null,
    paciente.consultorioId ? Consultorio.findById(paciente.consultorioId).select('nombre direccion telefono').lean() : null,
    portal.citas ? Cita.find({ pacienteId }).select('fechaHora duracionMin motivo estado').sort({ fechaHora: -1 }).limit(50).lean() : [],
    portal.progreso || portal.indicadoresClinicos
      ? Medicion.find({ pacienteId, vigente: true, anulada: { $ne: true } }).sort({ fecha: 1 }).lean()
      : [],
    portal.recomendaciones ? PlanNutricional.findOne({ pacienteId, estado: 'vigente' }).select('nombre vigencia recomendaciones').sort({ updatedAt: -1 }).lean() : null,
    portal.dieta && paciente.dietaId ? Dieta.findOne({ clave: paciente.dietaId }).lean() : null,
  ]);

  // Mediciones: solo los campos autorizados (nunca notas, responsable ni versiones)
  const campos = [...(portal.progreso ? ANTROPOMETRIA : []), ...(portal.indicadoresClinicos ? CLINICOS : [])];
  let estatura = paciente.estatura || null;
  const progreso = mediciones.map((m) => {
    if (m.estaturaCm) estatura = m.estaturaCm;
    const fila = { fecha: m.fecha };
    campos.forEach((c) => { if (m[c] != null) fila[c] = m[c]; });
    if (portal.progreso && m.pesoKg) fila.imc = imcDe(m.pesoKg, estatura);
    return fila;
  }).filter((f) => Object.keys(f).length > 1);

  const cumplimiento = portal.cumplimiento && dieta
    ? await Adherencia.find({ pacienteId, dietaId: dieta.clave, estado: { $ne: null } }).select('fecha tiempo estado').lean()
    : [];

  registrarAuditoria(req, { accion: 'consultar', entidad: 'PortalPaciente', pacienteId });

  res.json({
    paciente: {
      nombreCompleto: paciente.nombreCompleto, fechaNacimiento: paciente.fechaNacimiento,
      edad: paciente.fechaNacimiento ? Paciente.edadEnFecha(paciente.fechaNacimiento, ahora) : paciente.edad,
      sexo: paciente.sexo, correo: paciente.correo, telefono: paciente.telefono, objetivo: paciente.objetivo,
      estado: paciente.estado, fechaRegistro: paciente.fechaRegistro,
    },
    expediente: { folio: expediente.folio, estado: expediente.estado },
    responsable: responsable && {
      nombre: responsable.nombre, cedulaProfesional: responsable.cedulaProfesional, especialidad: responsable.especialidad,
    },
    consultorio,
    portal,
    citas: citas.map((c) => ({ ...c, _id: String(c._id) })),
    proximaCita: citas.filter((c) => c.estado === 'programada' && new Date(c.fechaHora) >= ahora).sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora))[0] || null,
    progreso,
    plan: plan && { nombre: plan.nombre, vigencia: plan.vigencia, recomendaciones: portal.recomendaciones ? plan.recomendaciones : undefined },
    dieta: dieta && { ...dieta, id: dieta.clave, _id: undefined, creadoPor: undefined, actualizadoPor: undefined },
    cumplimiento,
  });
});

module.exports = { miEspacio };
