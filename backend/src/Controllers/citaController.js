const Paciente = require('../Models/Paciente');
const Cita = require('../Models/Cita');
const { registrarAuditoria } = require('../Services/auditoria');
const { pacientesIdentificables } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');

/* Agenda: personal administrativo y superusuario ven todo; el personal clínico, solo sus expedientes */
async function exigirAgenda(req, pacienteId, escribir = false) {
  if (!tienePermiso(req.usuario, escribir ? 'agenda:escribir' : 'agenda:leer')) throw new ErrorHttp(403, 'Sin permiso de agenda');
  if (!pacienteId) return;
  const ids = await pacientesIdentificables(req.usuario);
  if (ids && !ids.some((x) => String(x) === String(pacienteId))) throw new ErrorHttp(403, 'No tienes acceso a este paciente');
}
const { ErrorHttp, exigirId, tomarCampos, rangoFechas, controlador } = require('../Services/http');

const { ESTADOS_CITA } = Cita;

// GET /api/citas?desde&hasta&estado   ·   GET /api/pacientes/:pacienteId/citas
const listar = controlador(async (req, res) => {
  const filtro = {};
  if (req.params.pacienteId) filtro.pacienteId = exigirId(req.params.pacienteId, 'ID de paciente');
  await exigirAgenda(req, filtro.pacienteId);
  if (!filtro.pacienteId) {
    const ids = await pacientesIdentificables(req.usuario);
    if (ids) filtro.pacienteId = { $in: ids };
  }
  const rango = rangoFechas(req.query);
  if (rango) filtro.fechaHora = rango;
  if (req.query.estado) {
    if (!ESTADOS_CITA.includes(req.query.estado)) throw new ErrorHttp(400, 'Estado de cita no válido');
    filtro.estado = req.query.estado;
  }
  const citas = await Cita.find(filtro).sort({ fechaHora: -1 }).limit(500)
    .populate('pacienteId', 'nombreCompleto').lean();
  res.json(citas);
});

// POST /api/pacientes/:pacienteId/citas
const crear = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  exigirId(pacienteId, 'ID de paciente');
  await exigirAgenda(req, pacienteId, true);
  if (!(await Paciente.exists({ _id: pacienteId }))) throw new ErrorHttp(404, 'Paciente no encontrado');

  const datos = tomarCampos(req.body, ['fechaHora', 'duracionMin', 'motivo', 'notas', 'estado']);
  const estado = datos.estado || 'programada';
  const cita = await Cita.create({
    ...datos,
    estado,
    pacienteId,
    responsable: req.responsable,
    historialEstados: [{ estado, responsable: req.responsable, motivo: 'Registro inicial' }],
  });

  registrarAuditoria(req, { accion: 'crear', entidad: 'Cita', entidadId: cita._id, pacienteId, campos: Object.keys(datos) });
  res.status(201).json(cita);
});

// PUT /api/citas/:id  { estado?, motivoCambio?, fechaHora?, duracionMin?, motivo?, notas? }
const actualizar = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de cita');
  const cita = await Cita.findById(id);
  if (!cita) throw new ErrorHttp(404, 'Cita no encontrada');
  await exigirAgenda(req, cita.pacienteId, true);

  const datos = tomarCampos(req.body, ['fechaHora', 'duracionMin', 'motivo', 'notas']);
  if (Object.keys(datos).length && cita.estado !== 'programada') {
    throw new ErrorHttp(409, 'Solo se pueden reprogramar citas en estado "programada"');
  }
  cita.set(datos);

  const { estado, motivoCambio } = req.body || {};
  if (estado && estado !== cita.estado) {
    if (!ESTADOS_CITA.includes(estado)) throw new ErrorHttp(400, 'Estado de cita no válido');
    cita.estado = estado;
    cita.historialEstados.push({ estado, responsable: req.responsable, motivo: motivoCambio });
  }
  if (!cita.isModified()) throw new ErrorHttp(400, 'No se enviaron cambios');
  await cita.save();

  registrarAuditoria(req, {
    accion: 'actualizar', entidad: 'Cita', entidadId: cita._id, pacienteId: cita.pacienteId,
    campos: [...Object.keys(datos), ...(estado ? ['estado'] : [])],
  });
  res.json(cita);
});

module.exports = { listar, crear, actualizar };
