/**
 * Aplicación Express (rutas, seguridad y manejo de errores).
 * La conexión con MongoDB Atlas y el `listen` siguen en server.js.
 */
const express = require('express');
const cors = require('cors');

const pacienteRoutes = require('./Routes/pacienteRoutes');
const expediente = require('./Routes/expedienteRoutes');
const { authRouter, usuariosRouter, consultoriosRouter, solicitudesRouter } = require('./Routes/authRoutes');
const { autenticar, soloPortalParaPacientes, exigirCambioContrasena, exigirPermiso } = require('./Services/seguridad/middleware');
const portal = require('./Controllers/portalController');
const generador = require('./Controllers/generadorController');

const app = express();
app.disable('x-powered-by');

/* Cabeceras de seguridad básicas (sin dependencias) */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-site',
  });
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store'); // datos clínicos: sin caché
  next();
});

/* CORS: solo los orígenes del frontend (configurable con CORS_ORIGENES, separados por coma) */
const ORIGENES = (process.env.CORS_ORIGENES || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origen, cb) => cb(null, !origen || ORIGENES.includes(origen)),
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '200kb' }));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor de La Nutria funcionando');
});

// Autenticación (login es la única ruta /api pública)
app.use('/api/auth', authRouter);

// A partir de aquí, toda la API requiere sesión válida
app.use('/api', autenticar);
app.use('/api', exigirCambioContrasena);
app.use('/api', soloPortalParaPacientes);

app.use('/api/usuarios', usuariosRouter);
app.use('/api/consultorios', consultoriosRouter);
app.use('/api/solicitudes', solicitudesRouter);
// Portal del paciente: solo su propia información (el paciente se toma de la sesión)
app.get('/api/portal', exigirPermiso('portal:propio'), portal.miEspacio);
app.get('/api/portal/plan-alimentario', exigirPermiso('portal:propio'), generador.portalPlan);
app.put('/api/portal/preferencias', exigirPermiso('portal:propio'), generador.portalPreferencias);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/pacientes/:pacienteId/citas', expediente.citasPaciente);
app.use('/api/pacientes/:pacienteId', expediente.expedientePaciente);
app.use('/api/mediciones', expediente.mediciones);
app.use('/api/evaluaciones', expediente.evaluaciones);
app.use('/api/citas', expediente.citas);
app.use('/api/adherencia', expediente.adherencias);
app.use('/api/calculos', expediente.calculos);
app.use('/api/estadisticas', expediente.estadisticas);
app.use('/api/antecedentes', expediente.antecedentes);
app.use('/api/consultas', expediente.consultas);
app.use('/api/laboratorio', expediente.laboratorios);
app.use('/api/laboratorios', expediente.laboratorios);
app.use('/api/diagnosticos', expediente.diagnosticos);
app.use('/api/objetivos', expediente.objetivos);
app.use('/api/planes', expediente.planes);
app.use('/api/consentimientos', expediente.consentimientos);
app.use('/api/alertas', expediente.alertas);
app.use('/api/catalogos', expediente.catalogos);
app.use('/api/dietas', expediente.dietas);
app.use('/api/platillos', expediente.platillos);
app.use('/api/planes-generados', expediente.planesGenerados);
app.use('/api/fhir', expediente.fhir);
app.use('/api/reportes', expediente.reportes);
app.use('/api/auditoria', expediente.auditoria);
app.use('/api/expedientes', expediente.expedientes);

// Ruta de API inexistente
app.use('/api', (req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Errores generales (por ejemplo, JSON mal formado en el cuerpo)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'El cuerpo de la petición es demasiado grande' });
  }
  console.error('Error no controlado:', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor' });
});

module.exports = app;
