const Evaluacion = require('../Models/Evaluacion');
const { resultadosConAjustes } = require('../Services/nutricion/evaluacion');
const { registrarAuditoria } = require('../Services/auditoria');
const { exigirAccesoClinico } = require('../Services/seguridad/middleware');
const { tienePermiso } = require('../Services/seguridad/permisos');
const { ErrorHttp, exigirId, controlador } = require('../Services/http');

// POST /api/evaluaciones/:id/ajustes  { indicador, valor, motivo }
// El nutriólogo sustituye un resultado estimado/calculado; el original se conserva.
const ajustar = controlador(async (req, res) => {
  const { id } = req.params;
  exigirId(id, 'ID de evaluación');
  const { indicador, valor, motivo } = req.body || {};

  if (!tienePermiso(req.usuario, 'clinico:escribir')) throw new ErrorHttp(403, 'Sin permiso de escritura clínica');
  const evaluacion = await Evaluacion.findById(id);
  if (!evaluacion) throw new ErrorHttp(404, 'Evaluación no encontrada');
  await exigirAccesoClinico(req, evaluacion.pacienteId);
  if (!evaluacion.vigente) throw new ErrorHttp(409, 'Solo se ajustan evaluaciones vigentes');
  if (!indicador || !(indicador in (evaluacion.resultados || {}))) {
    throw new ErrorHttp(400, 'Indicador no válido', { indicador: 'No existe en la evaluación' });
  }
  if (valor === undefined || valor === null || valor === '') {
    throw new ErrorHttp(400, 'Indica el valor ajustado', { valor: 'Obligatorio' });
  }
  if (typeof valor !== 'object' && !Number.isFinite(Number(valor))) {
    throw new ErrorHttp(400, 'El valor ajustado debe ser numérico', { valor: 'Debe ser numérico' });
  }
  if (!motivo || !String(motivo).trim()) {
    throw new ErrorHttp(400, 'Indica el motivo del ajuste', { motivo: 'Obligatorio' });
  }

  evaluacion.ajustes.forEach((a) => {
    if (a.indicador === indicador) a.vigente = false;
  });
  evaluacion.ajustes.push({
    indicador,
    valor: typeof valor === 'object' ? valor : Number(valor),
    motivo: String(motivo).trim(),
    responsable: req.responsable,
  });
  await evaluacion.save();

  registrarAuditoria(req, {
    accion: 'ajustar', entidad: 'Evaluacion', entidadId: evaluacion._id, pacienteId: evaluacion.pacienteId, campos: [indicador],
  });
  res.json({ ...evaluacion.toObject(), resultadosFinales: resultadosConAjustes(evaluacion.resultados, evaluacion.ajustes) });
});

// DELETE /api/evaluaciones/:id/ajustes/:ajusteId  → retira el ajuste (queda en el historial)
const retirarAjuste = controlador(async (req, res) => {
  const { id, ajusteId } = req.params;
  exigirId(id, 'ID de evaluación');
  exigirId(ajusteId, 'ID de ajuste');
  const evaluacion = await Evaluacion.findById(id);
  if (!evaluacion) throw new ErrorHttp(404, 'Evaluación no encontrada');
  await exigirAccesoClinico(req, evaluacion.pacienteId);
  const ajuste = evaluacion.ajustes.id(ajusteId);
  if (!ajuste) throw new ErrorHttp(404, 'Ajuste no encontrado');
  ajuste.vigente = false;
  await evaluacion.save();

  registrarAuditoria(req, {
    accion: 'ajustar', entidad: 'Evaluacion', entidadId: evaluacion._id, pacienteId: evaluacion.pacienteId, campos: [ajuste.indicador],
  });
  res.json({ ...evaluacion.toObject(), resultadosFinales: resultadosConAjustes(evaluacion.resultados, evaluacion.ajustes) });
});

module.exports = { ajustar, retirarAjuste };
