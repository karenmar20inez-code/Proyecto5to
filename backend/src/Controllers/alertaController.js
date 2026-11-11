const { Alerta, AlertaRegla, TIPOS_REGLA, PRIORIDADES } = require('../Models/Alerta');
const Paciente = require('../Models/Paciente');
const { evaluarPaciente, asegurarReglasPorOmision } = require('../Services/clinica/alertas');
const { pacientesAccesibles, exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { registrarAuditoria } = require('../Services/auditoria');
const { ErrorHttp, exigirId, tomarCampos, controlador } = require('../Services/http');

// GET /api/alertas?estado=pendiente&prioridad=&pacienteId=
const listar = controlador(async (req, res) => {
  const filtro = { estado: req.query.estado || 'pendiente' };
  if (req.query.prioridad) filtro.prioridad = req.query.prioridad;
  const accesibles = await pacientesAccesibles(req.usuario);
  if (req.query.pacienteId) {
    await exigirAccesoClinico(req, req.query.pacienteId);
    filtro.pacienteId = req.query.pacienteId;
  } else if (accesibles) filtro.pacienteId = { $in: accesibles };

  const alertas = await Alerta.find(filtro).sort({ fecha: -1 }).limit(500).populate('pacienteId', 'nombreCompleto').lean();
  const orden = { alta: 0, media: 1, baja: 2 };
  res.json(alertas.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]));
});

// PUT /api/alertas/:id  { estado: 'revisada' | 'descartada', nota }
const revisar = controlador(async (req, res) => {
  exigirId(req.params.id, 'ID de alerta');
  const alerta = await Alerta.findById(req.params.id);
  if (!alerta) throw new ErrorHttp(404, 'Alerta no encontrada');
  await exigirAccesoClinico(req, alerta.pacienteId);
  const { estado, nota } = req.body || {};
  if (!['revisada', 'descartada'].includes(estado)) throw new ErrorHttp(400, 'Estado no válido (revisada o descartada)');
  if (estado === 'descartada' && !String(nota || '').trim()) throw new ErrorHttp(400, 'Indica por qué se descarta', { nota: 'Obligatorio' });
  alerta.estado = estado;
  alerta.revision = { usuarioId: req.usuario._id, usuario: req.usuario.nombre, fecha: new Date(), nota };
  await alerta.save();
  registrarAuditoria(req, { accion: 'revisar', entidad: 'Alerta', entidadId: alerta._id, pacienteId: alerta.pacienteId, campos: [estado] });
  res.json(alerta);
});

// POST /api/alertas/evaluar  { pacienteId? }  → re-evalúa (todos los accesibles si no se indica)
const evaluar = controlador(async (req, res) => {
  let ids;
  if (req.body?.pacienteId) {
    await exigirAccesoClinico(req, req.body.pacienteId);
    ids = [req.body.pacienteId];
  } else {
    const accesibles = await pacientesAccesibles(req.usuario);
    ids = accesibles || (await Paciente.find({ estado: 'activo' }).select('_id').lean()).map((p) => p._id);
  }
  let pendientes = 0;
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    pendientes += (await evaluarPaciente(id)).length;
  }
  res.json({ pacientesEvaluados: ids.length, alertasPendientes: pendientes });
});

/* ---------- Reglas (administrador) ---------- */

const listarReglas = controlador(async (req, res) => {
  await asegurarReglasPorOmision();
  res.json({ tipos: TIPOS_REGLA, prioridades: PRIORIDADES, reglas: await AlertaRegla.find().sort({ tipo: 1 }).lean() });
});

const crearRegla = controlador(async (req, res) => {
  const datos = tomarCampos(req.body, ['codigo', 'tipo', 'nombre', 'descripcion', 'parametros', 'prioridad', 'activa', 'nota']);
  const regla = await AlertaRegla.create({ ...datos, actualizadoPor: req.usuario.nombre });
  registrarAuditoria(req, { accion: 'crear', entidad: 'AlertaRegla', entidadId: regla._id, campos: Object.keys(datos) });
  res.status(201).json(regla);
});

const actualizarRegla = controlador(async (req, res) => {
  exigirId(req.params.id, 'ID de regla');
  const datos = tomarCampos(req.body, ['nombre', 'descripcion', 'parametros', 'prioridad', 'nota']);
  if (typeof req.body?.activa === 'boolean') datos.activa = req.body.activa;
  const regla = await AlertaRegla.findByIdAndUpdate(req.params.id, { $set: { ...datos, actualizadoPor: req.usuario.nombre } }, { returnDocument: 'after', runValidators: true });
  if (!regla) throw new ErrorHttp(404, 'Regla no encontrada');
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'AlertaRegla', entidadId: regla._id, campos: Object.keys(datos) });
  res.json(regla);
});

module.exports = { listar, revisar, evaluar, listarReglas, crearRegla, actualizarRegla };
