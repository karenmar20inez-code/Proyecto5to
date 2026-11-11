const crypto = require('crypto');
const Consulta = require('../Models/Consulta');
const Cita = require('../Models/Cita');
const Expediente = require('../Models/Expediente');
const Medicion = require('../Models/Medicion');
const ResultadoLaboratorio = require('../Models/ResultadoLaboratorio');
const { evaluarEnSegundoPlano } = require('../Services/clinica/alertas');
const { registrarAuditoria } = require('../Services/auditoria');
const { exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, controlador } = require('../Services/http');

const SECCIONES = ['subjetivo', 'objetivo', 'analisis', 'plan'];
const MAX_SECCION = 20000;
const MAX_VERSIONES = 50;

/** Hash de integridad del contenido firmado (detecta alteraciones posteriores) */
function hashNota(c) {
  const contenido = JSON.stringify({
    pacienteId: String(c.pacienteId), fecha: new Date(c.fecha).toISOString(), soap: SECCIONES.map((s) => c.soap?.[s] || ''),
    firmante: String(c.firma?.usuarioId || ''), fechaFirma: c.firma?.fecha ? new Date(c.firma.fecha).toISOString() : '',
  });
  return crypto.createHash('sha256').update(contenido).digest('hex');
}

const exigirEscritura = (req) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'No tienes permiso para documentar consultas');
};

async function cargar(req, id) {
  exigirId(id, 'ID de consulta');
  const c = await Consulta.findById(id);
  if (!c) throw new ErrorHttp(404, 'Consulta no encontrada');
  await exigirAccesoClinico(req, c.pacienteId);
  return c;
}

// GET /api/pacientes/:pacienteId/consultas
const listar = controlador(async (req, res) => {
  res.json(await Consulta.find({ pacienteId: req.params.pacienteId }).sort({ fecha: -1 }).lean());
});

// POST /api/pacientes/:pacienteId/consultas  { fecha, tipo, motivo, citaId }
const crear = controlador(async (req, res) => {
  exigirEscritura(req);
  const { pacienteId } = req.params;
  const { fecha, motivo, citaId } = req.body || {};
  if (citaId) {
    exigirId(citaId, 'ID de cita');
    if (!(await Cita.exists({ _id: citaId, pacienteId }))) throw new ErrorHttp(400, 'La cita no pertenece a este paciente');
  }
  const previas = await Consulta.countDocuments({ pacienteId });
  const consulta = await Consulta.create({
    pacienteId, citaId, fecha: fecha || new Date(), motivo,
    tipo: req.body?.tipo || (previas ? 'subsecuente' : 'primera_vez'),
    profesionalId: req.usuario._id, profesional: req.usuario.nombre,
    versiones: [{ numero: 1, fecha: new Date(), usuarioId: req.usuario._id, campos: ['creacion'] }],
  });
  if (citaId) {
    await Cita.updateOne({ _id: citaId, estado: 'programada' }, {
      $set: { estado: 'realizada' }, $push: { historialEstados: { estado: 'realizada', responsable: req.usuario.nombre, motivo: 'Consulta iniciada' } },
    });
  }
  await Expediente.updateOne({ pacienteId }, { $set: { fechaUltimoActo: consulta.fecha, estado: 'en_seguimiento' } });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Consulta', entidadId: consulta._id, pacienteId });
  evaluarEnSegundoPlano(pacienteId);
  res.status(201).json(consulta);
});

// GET /api/consultas/:id  → incluye mediciones y laboratorios vinculados
const obtener = controlador(async (req, res) => {
  const c = await cargar(req, req.params.id);
  const [mediciones, laboratorios] = await Promise.all([
    Medicion.find({ consultaId: c._id, vigente: true, anulada: false }).lean(),
    ResultadoLaboratorio.find({ consultaId: c._id, vigente: true }).lean(),
  ]);
  const integra = c.estado !== 'firmada' || hashNota(c) === c.firma.hash;
  res.json({ ...c.toObject(), mediciones, laboratorios, integridad: c.estado === 'firmada' ? (integra ? 'verificada' : 'ALTERADA') : null });
});

// PUT /api/consultas/:id/borrador  { soap: {...}, motivo, autoguardado }
const guardarBorrador = controlador(async (req, res) => {
  exigirEscritura(req);
  const c = await cargar(req, req.params.id);
  if (c.estado === 'firmada') throw new ErrorHttp(409, 'La nota está firmada: usa una adenda para aclaraciones o correcciones');
  if (String(c.profesionalId) !== String(req.usuario._id) && req.usuario.rol !== 'administrador') {
    throw new ErrorHttp(403, 'Solo el autor puede editar el borrador');
  }
  const campos = [];
  SECCIONES.forEach((s) => {
    const v = req.body?.soap?.[s];
    if (typeof v !== 'string') return;
    if (v.length > MAX_SECCION) throw new ErrorHttp(400, `La sección ${s} excede ${MAX_SECCION} caracteres`);
    if (v !== c.soap[s]) { c.soap[s] = v; campos.push(s); }
  });
  if (typeof req.body?.motivo === 'string' && req.body.motivo !== c.motivo) { c.motivo = req.body.motivo; campos.push('motivo'); }
  if (!campos.length) return res.json({ ...c.toObject(), sinCambios: true });

  const autoguardado = !!req.body?.autoguardado;
  const ultima = c.versiones[c.versiones.length - 1];
  // los autoguardados consecutivos se agrupan en una sola versión
  if (autoguardado && ultima?.autoguardado && String(ultima.usuarioId) === String(req.usuario._id)) {
    ultima.fecha = new Date();
    ultima.campos = [...new Set([...ultima.campos, ...campos])];
  } else {
    c.versiones.push({ numero: (ultima?.numero || 0) + 1, fecha: new Date(), usuarioId: req.usuario._id, campos, autoguardado });
  }
  if (c.versiones.length > MAX_VERSIONES) c.versiones.splice(0, c.versiones.length - MAX_VERSIONES);
  c.markModified('versiones');
  await c.save();
  if (!autoguardado) registrarAuditoria(req, { accion: 'actualizar', entidad: 'Consulta', entidadId: c._id, pacienteId: c.pacienteId, campos });
  res.json(c);
});

// POST /api/consultas/:id/firmar  { confirmacion: true }
const firmar = controlador(async (req, res) => {
  if (!tienePermiso(req.usuario, 'notas:firmar')) throw new ErrorHttp(403, 'Tu rol no puede firmar notas clínicas');
  const c = await cargar(req, req.params.id);
  if (c.estado === 'firmada') throw new ErrorHttp(409, 'La nota ya estaba firmada');
  if (String(c.profesionalId) !== String(req.usuario._id)) throw new ErrorHttp(403, 'Solo el autor de la nota puede firmarla');
  if (req.body?.confirmacion !== true) throw new ErrorHttp(400, 'Confirma que revisaste la nota antes de firmarla');
  const faltantes = SECCIONES.filter((s) => !String(c.soap[s] || '').trim());
  if (faltantes.length) throw new ErrorHttp(400, `Completa las secciones antes de firmar: ${faltantes.join(', ')}`, { faltantes: faltantes.join(',') });

  c.estado = 'firmada';
  c.firma = { usuarioId: req.usuario._id, nombre: req.usuario.nombre, cedulaProfesional: req.usuario.cedulaProfesional, fecha: new Date() };
  c.firma.hash = hashNota(c);
  await c.save();
  registrarAuditoria(req, { accion: 'firmar', entidad: 'Consulta', entidadId: c._id, pacienteId: c.pacienteId });
  res.json(c);
});

// POST /api/consultas/:id/adendas  { tipo, texto }
const adenda = controlador(async (req, res) => {
  exigirEscritura(req);
  const c = await cargar(req, req.params.id);
  if (c.estado !== 'firmada') throw new ErrorHttp(409, 'Las adendas se agregan a notas firmadas; el borrador puede editarse directamente');
  const texto = String(req.body?.texto || '').trim();
  if (!texto) throw new ErrorHttp(400, 'Escribe el texto de la adenda', { texto: 'Obligatorio' });
  if (texto.length > 5000) throw new ErrorHttp(400, 'La adenda excede 5000 caracteres');
  const tipo = ['aclaracion', 'correccion', 'complemento'].includes(req.body?.tipo) ? req.body.tipo : 'aclaracion';
  // updateOne con $push: no toca el contenido firmado
  await Consulta.updateOne({ _id: c._id }, { $push: { adendas: { tipo, texto, autorId: req.usuario._id, autor: req.usuario.nombre, fecha: new Date() } } });
  registrarAuditoria(req, { accion: 'adenda', entidad: 'Consulta', entidadId: c._id, pacienteId: c.pacienteId });
  res.status(201).json(await Consulta.findById(c._id));
});

module.exports = { listar, crear, obtener, guardarBorrador, firmar, adenda, hashNota };
