const Paciente = require('../Models/Paciente');
const Adherencia = require('../Models/Adherencia');
const { registrarAuditoria } = require('../Services/auditoria');
const { pacientesAccesibles } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, controlador } = require('../Services/http');

const { ESTADOS_ADHERENCIA } = Adherencia;

// GET /api/adherencia?pacienteId=...   (solo registros con estado)
const listar = controlador(async (req, res) => {
  const filtro = { estado: { $ne: null } };
  if (!tienePermiso(req.usuario, 'clinico:leer')) return res.json([]);
  const accesibles = await pacientesAccesibles(req.usuario);
  if (accesibles) filtro.pacienteId = { $in: accesibles };
  if (req.query.pacienteId) {
    exigirId(req.query.pacienteId, 'ID de paciente');
    if (accesibles && !accesibles.some((x) => String(x) === String(req.query.pacienteId))) throw new ErrorHttp(403, 'No tienes acceso a este paciente');
    filtro.pacienteId = req.query.pacienteId;
  }
  if (req.params.pacienteId) filtro.pacienteId = exigirId(req.params.pacienteId, 'ID de paciente');
  const registros = await Adherencia.find(filtro)
    .select('pacienteId dietaId fecha tiempo estado updatedAt')
    .sort({ fecha: 1 })
    .lean();
  res.json(registros);
});

// PUT /api/pacientes/:pacienteId/adherencia  { dietaId, fecha, tiempo, estado | null }
const marcar = controlador(async (req, res) => {
  const { pacienteId } = req.params;
  exigirId(pacienteId, 'ID de paciente');
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  const { dietaId, fecha, tiempo } = req.body || {};
  const estado = req.body?.estado || null;

  if (!dietaId || !fecha || !tiempo) {
    throw new ErrorHttp(400, 'dietaId, fecha y tiempo son obligatorios');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ErrorHttp(400, 'La fecha debe tener formato AAAA-MM-DD');
  if (estado !== null && !ESTADOS_ADHERENCIA.includes(estado)) {
    throw new ErrorHttp(400, 'Estado no válido (cumplio, parcial, no o vacío)');
  }
  if (!(await Paciente.exists({ _id: pacienteId }))) throw new ErrorHttp(404, 'Paciente no encontrado');

  const registro = await Adherencia.findOneAndUpdate(
    { pacienteId, dietaId, fecha, tiempo },
    { $set: { estado }, $push: { historial: { estado, responsable: req.responsable } } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );

  registrarAuditoria(req, { accion: 'actualizar', entidad: 'Adherencia', entidadId: registro._id, pacienteId, campos: ['estado'] });
  res.json(registro);
});

module.exports = { listar, marcar };
