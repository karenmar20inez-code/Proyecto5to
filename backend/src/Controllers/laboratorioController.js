const mongoose = require('mongoose');
const ResultadoLaboratorio = require('../Models/ResultadoLaboratorio');
const Consulta = require('../Models/Consulta');
const { ANALITOS } = require('../Services/clinica/analitos');
const { evaluarEnSegundoPlano } = require('../Services/clinica/alertas');
const { registrarAuditoria } = require('../Services/auditoria');
const { exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, tomarCampos, rangoFechas, controlador } = require('../Services/http');

const CAMPOS = ['fechaMuestra', 'analito', 'nombre', 'valor', 'unidad', 'rangoReferencia', 'procedencia', 'metodo', 'ayuno', 'observaciones', 'consultaId'];

function normalizar(datos) {
  const a = ANALITOS[datos.analito];
  if (datos.analito && !a) throw new ErrorHttp(400, 'Analito no válido', { analito: 'No está en el catálogo' });
  if (a && datos.analito !== 'otro') datos.nombre = a.nombre;
  if (datos.analito === 'otro' && !datos.nombre) throw new ErrorHttp(400, 'Indica el nombre del estudio', { nombre: 'Obligatorio' });
  if (datos.valor !== undefined) datos.valor = Number(datos.valor);
  const r = datos.rangoReferencia;
  if (r) {
    datos.rangoReferencia = {
      min: r.min === '' || r.min == null ? undefined : Number(r.min),
      max: r.max === '' || r.max == null ? undefined : Number(r.max),
      texto: r.texto || undefined,
    };
  }
  return datos;
}

// GET /api/laboratorio/analitos
const analitos = controlador(async (req, res) => res.json(ANALITOS));

// GET /api/pacientes/:pacienteId/laboratorios?analito&desde&hasta
const listar = controlador(async (req, res) => {
  const filtro = { pacienteId: req.params.pacienteId, vigente: true };
  if (req.query.analito) filtro.analito = req.query.analito;
  const rango = rangoFechas(req.query);
  if (rango) filtro.fechaMuestra = rango;
  const lista = await ResultadoLaboratorio.find(filtro).sort({ fechaMuestra: -1 }).lean();
  res.json(lista.map((r) => ({ ...r, fueraDeRango: ResultadoLaboratorio.fueraDeRango(r) })));
});

// POST /api/pacientes/:pacienteId/laboratorios
const crear = controlador(async (req, res) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  const { pacienteId } = req.params;
  const datos = normalizar(tomarCampos(req.body, CAMPOS));
  if (datos.consultaId) {
    exigirId(datos.consultaId, 'ID de consulta');
    if (!(await Consulta.exists({ _id: datos.consultaId, pacienteId }))) throw new ErrorHttp(400, 'La consulta no pertenece a este paciente');
  }
  const r = await ResultadoLaboratorio.create({
    ...datos, pacienteId, registradoPor: req.usuario._id, registradoPorNombre: req.usuario.nombre,
    grupoId: new mongoose.Types.ObjectId(), version: 1,
  });
  registrarAuditoria(req, { accion: 'crear', entidad: 'ResultadoLaboratorio', entidadId: r._id, pacienteId, campos: Object.keys(datos) });
  evaluarEnSegundoPlano(pacienteId);
  res.status(201).json({ ...r.toObject(), fueraDeRango: ResultadoLaboratorio.fueraDeRango(r) });
});

// PUT /api/laboratorios/:id  { ...cambios, motivoCambio }  → nueva versión
const corregir = controlador(async (req, res) => {
  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  exigirId(req.params.id, 'ID de resultado');
  const motivo = String(req.body?.motivoCambio || '').trim();
  if (!motivo) throw new ErrorHttp(400, 'Indica el motivo de la corrección', { motivoCambio: 'Obligatorio' });
  const anterior = await ResultadoLaboratorio.findById(req.params.id);
  if (!anterior) throw new ErrorHttp(404, 'Resultado no encontrado');
  await exigirAccesoClinico(req, anterior.pacienteId);
  if (!anterior.vigente) throw new ErrorHttp(409, 'Solo se corrige la versión vigente');

  const base = anterior.toObject();
  const nuevo = await ResultadoLaboratorio.create({
    ...Object.fromEntries(CAMPOS.map((c) => [c, base[c]])),
    ...normalizar(tomarCampos(req.body, CAMPOS)),
    pacienteId: anterior.pacienteId, grupoId: anterior.grupoId, version: anterior.version + 1,
    registradoPor: req.usuario._id, registradoPorNombre: req.usuario.nombre, motivoCambio: motivo,
  });
  await ResultadoLaboratorio.updateOne({ _id: anterior._id }, { $set: { vigente: false } });
  registrarAuditoria(req, { accion: 'actualizar', entidad: 'ResultadoLaboratorio', entidadId: nuevo._id, pacienteId: anterior.pacienteId });
  evaluarEnSegundoPlano(anterior.pacienteId);
  res.json(nuevo);
});

module.exports = { analitos, listar, crear, corregir };
