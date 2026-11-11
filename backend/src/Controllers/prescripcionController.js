const Paciente = require('../Models/Paciente');
const Prescripcion = require('../Models/Prescripcion');
const { registrarAuditoria } = require('../Services/auditoria');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { evaluarEnSegundoPlano } = require('../Services/clinica/alertas');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');

const CAMPOS = [
  'fechaInicio', 'pesoObjetivoKg', 'cinturaObjetivoCm', 'grasaObjetivoPct', 'kcalObjetivo',
  'factorActividad', 'proteinasPct', 'carbohidratosPct', 'grasasPct', 'proteinaGKg',
  'aguaMlKg', 'aguaObjetivoMl', 'actividadObjetivoMinSemana', 'notas',
];

// GET /api/pacientes/:pacienteId/prescripciones  (la primera es la vigente)
const listar = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  exigirId(pacienteId, 'ID de paciente');
  const lista = await Prescripcion.find({ pacienteId }).sort({ fechaInicio: -1, createdAt: -1 }).lean();
  registrarAuditoria(req, { accion: 'consultar', entidad: 'Prescripcion', pacienteId });
  res.json(lista);
});

// POST /api/pacientes/:pacienteId/prescripciones  → nueva versión; la anterior queda como histórico
const crear = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  exigirId(pacienteId, 'ID de paciente');
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  if (!(await Paciente.exists({ _id: pacienteId }))) throw new ErrorHttp(404, 'Paciente no encontrado');

  const datos = tomarCampos(req.body, CAMPOS);
  const nueva = await Prescripcion.create({ ...datos, pacienteId, responsable: req.responsable });
  await Prescripcion.updateMany(
    { pacienteId, vigente: true, _id: { $ne: nueva._id } },
    { $set: { vigente: false, reemplazadaPor: nueva._id } }
  );

  registrarAuditoria(req, {
    accion: 'crear', entidad: 'Prescripcion', entidadId: nueva._id, pacienteId, campos: Object.keys(datos),
  });
  evaluarEnSegundoPlano(pacienteId);
  res.status(201).json(nueva);
});

module.exports = { listar, crear };
