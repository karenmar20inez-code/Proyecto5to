/**
 * Rutas del expediente clínico.
 *  - citasPaciente: /api/pacientes/:pacienteId/citas (permiso de agenda, también asistentes)
 *  - expedientePaciente: /api/pacientes/:pacienteId/... (acceso clínico verificado)
 *  - resto: recursos de primer nivel que verifican el acceso al cargar el registro
 */
const express = require('express');
const medicion = require('../Controllers/medicionController');
const prescripcion = require('../Controllers/prescripcionController');
const evaluacion = require('../Controllers/evaluacionController');
const cita = require('../Controllers/citaController');
const adherencia = require('../Controllers/adherenciaController');
const calculos = require('../Controllers/calculosController');
const estadisticas = require('../Controllers/estadisticasController');
const expediente = require('../Controllers/expedienteController');
const antecedente = require('../Controllers/antecedenteController');
const consulta = require('../Controllers/consultaController');
const laboratorio = require('../Controllers/laboratorioController');
const planeacion = require('../Controllers/planeacionController');
const alerta = require('../Controllers/alertaController');
const catalogo = require('../Controllers/catalogoController');
const dieta = require('../Controllers/dietaController');
const listados = require('../Controllers/listadosController');
const Auditoria = require('../Models/Auditoria');
const { controlador, exigirId } = require('../Services/http');
const { accesoPaciente, exigirPermiso } = require('../Services/seguridad/middleware');

/* /api/pacientes/:pacienteId/citas */
const citasPaciente = express.Router({ mergeParams: true });
citasPaciente.get('/', cita.listar);
citasPaciente.post('/', cita.crear);

/* /api/pacientes/:pacienteId/... (información clínica) */
const expedientePaciente = express.Router({ mergeParams: true });
expedientePaciente.use(accesoPaciente);
// Toda escritura clínica exige permiso de escritura además del acceso al expediente
expedientePaciente.use((req, res, next) => (req.method === 'GET' ? next() : exigirPermiso('clinico:escribir')(req, res, next)));
expedientePaciente.get('/expediente', expediente.ficha);
expedientePaciente.put('/expediente', expediente.actualizar);
expedientePaciente.get('/linea-tiempo', expediente.timeline);
expedientePaciente.get('/comparacion', expediente.comparacion);
expedientePaciente.get('/reportes/:tipo', exigirPermiso('reportes:generar'), expediente.reporte);
expedientePaciente.get('/mediciones', medicion.listar);
expedientePaciente.post('/mediciones', medicion.crear);
expedientePaciente.get('/prescripciones', prescripcion.listar);
expedientePaciente.post('/prescripciones', prescripcion.crear);
expedientePaciente.get('/adherencia', adherencia.listar);
expedientePaciente.put('/adherencia', adherencia.marcar);
expedientePaciente.get('/dashboard', estadisticas.dashboardPaciente);
expedientePaciente.get('/antecedentes', antecedente.listar);
expedientePaciente.post('/antecedentes', antecedente.crear);
expedientePaciente.get('/consultas', consulta.listar);
expedientePaciente.post('/consultas', consulta.crear);
expedientePaciente.get('/laboratorios', laboratorio.listar);
expedientePaciente.post('/laboratorios', laboratorio.crear);
expedientePaciente.get('/diagnosticos', planeacion.listarDiagnosticos);
expedientePaciente.post('/diagnosticos', planeacion.crearDiagnostico);
expedientePaciente.get('/objetivos', planeacion.listarObjetivos);
expedientePaciente.post('/objetivos', planeacion.crearObjetivo);
expedientePaciente.get('/planes', planeacion.listarPlanes);
expedientePaciente.post('/planes', planeacion.crearPlan);
expedientePaciente.get('/consentimientos', planeacion.listarConsentimientos);
expedientePaciente.post('/consentimientos', planeacion.crearConsentimiento);

/* Recursos de primer nivel */
const mediciones = express.Router();
mediciones.get('/ultimas', medicion.ultimas);
mediciones.put('/:id', medicion.actualizar);
mediciones.delete('/:id', medicion.anular);
mediciones.get('/:id/versiones', medicion.versiones);

const evaluaciones = express.Router();
evaluaciones.post('/:id/ajustes', evaluacion.ajustar);
evaluaciones.delete('/:id/ajustes/:ajusteId', evaluacion.retirarAjuste);

const citas = express.Router();
citas.get('/', cita.listar);
citas.put('/:id', cita.actualizar);

const adherencias = express.Router();
adherencias.get('/', adherencia.listar);

const calculosRouter = express.Router();
calculosRouter.get('/formulas', calculos.formulas);
calculosRouter.post('/evaluar', calculos.evaluar);

const estadisticasRouter = express.Router();
estadisticasRouter.get('/resumen', estadisticas.resumenAdministrativo);

const antecedentes = express.Router();
antecedentes.put('/:id', antecedente.actualizar);
antecedentes.get('/:id/versiones', antecedente.versiones);

const consultas = express.Router();
consultas.get('/', listados.consultas);
consultas.get('/:id', consulta.obtener);
consultas.put('/:id/borrador', consulta.guardarBorrador);
consultas.post('/:id/firmar', consulta.firmar);
consultas.post('/:id/adendas', consulta.adenda);

const laboratorios = express.Router();
laboratorios.get('/', listados.laboratorios);
laboratorios.get('/analitos', laboratorio.analitos);
laboratorios.put('/:id', laboratorio.corregir);

const diagnosticos = express.Router();
diagnosticos.put('/:id', planeacion.actualizarDiagnostico);

const objetivos = express.Router();
objetivos.post('/:id/revisiones', planeacion.revisarObjetivo);

const planes = express.Router();
planes.post('/:id/activar', planeacion.activarPlan);

const consentimientos = express.Router();
consentimientos.post('/:id/revocar', planeacion.revocarConsentimiento);

const alertas = express.Router();
alertas.get('/', alerta.listar);
alertas.post('/evaluar', alerta.evaluar);
alertas.get('/reglas', alerta.listarReglas);
alertas.post('/reglas', exigirPermiso('configuracion:gestionar'), alerta.crearRegla);
alertas.put('/reglas/:id', exigirPermiso('configuracion:gestionar'), alerta.actualizarRegla);
alertas.put('/:id', exigirPermiso('alertas:revisar'), alerta.revisar);

const catalogos = express.Router();
catalogos.get('/', catalogo.sistemas);
catalogos.get('/:sistema', catalogo.buscar);

/* /api/dietas · catálogo de menús semanales (leer: dietas:leer; crear/editar: dietas:escribir) */
const dietas = express.Router();
dietas.get('/', exigirPermiso('dietas:leer'), dieta.listar);
dietas.get('/:clave', exigirPermiso('dietas:leer'), dieta.obtener);
dietas.post('/', exigirPermiso('dietas:escribir'), dieta.crear);
dietas.put('/:clave', exigirPermiso('dietas:escribir'), dieta.actualizar);

/* /api/fhir (solo lectura) */
const fhirRouter = express.Router();
fhirRouter.get('/Patient/:pacienteId', accesoPaciente, expediente.fhirPaciente);
fhirRouter.get('/Observation', (req, res, next) => { req.params.pacienteId = req.query.patient; next(); }, accesoPaciente, expediente.fhirObservaciones);

/* /api/expedientes */
const expedientes = express.Router();
expedientes.get('/', listados.expedientes);

/* /api/reportes/tipos */
const reportes = express.Router();
reportes.get('/tipos', expediente.tiposReporte);

/* /api/auditoria?pacienteId=&usuarioId=&limite=  (administración) */
const auditoria = express.Router();
auditoria.get('/', exigirPermiso('auditoria:leer'), controlador(async (req, res) => {
  const filtro = {};
  if (req.query.pacienteId) filtro.pacienteId = exigirId(req.query.pacienteId, 'ID de paciente');
  if (req.query.usuarioId) filtro.usuarioId = exigirId(req.query.usuarioId, 'ID de usuario');
  if (req.query.accion) filtro.accion = String(req.query.accion); // sin operadores de consulta
  const limite = Math.min(500, Math.max(1, Number(req.query.limite) || 100));
  res.json(await Auditoria.find(filtro).sort({ fecha: -1 }).limit(limite).lean());
}));

module.exports = {
  citasPaciente, expedientePaciente, mediciones, evaluaciones, citas, adherencias,
  calculos: calculosRouter, estadisticas: estadisticasRouter, antecedentes, consultas, laboratorios,
  diagnosticos, objetivos, planes, consentimientos, alertas, catalogos, dietas, fhir: fhirRouter, reportes, auditoria, expedientes,
};
