/* ==========================================
   CLIENTE HTTP DE LA NUTRIA
   - URL configurable con REACT_APP_API_URL (por omisión, backend local :5000)
   - Autenticación: token de sesión en sessionStorage (se borra al cerrar la pestaña)
   - Un 401 dispara el evento "sesion-expirada" para volver al inicio de sesión
========================================== */

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const CLAVE_TOKEN = 'la-nutria:sesion';

export const sesionGuardada = {
  leer() {
    try { return JSON.parse(window.sessionStorage.getItem(CLAVE_TOKEN)) || null; } catch { return null; }
  },
  guardar(datos) {
    try { window.sessionStorage.setItem(CLAVE_TOKEN, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
  },
  borrar() {
    try { window.sessionStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
  },
};

export class ApiError extends Error {
  constructor(mensaje, status, errores = {}) {
    super(mensaje);
    this.status = status;
    this.errores = errores; // { campo: 'mensaje' } en errores de validación
  }
}

const query = (params = {}) => {
  const limpio = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
};

async function solicitud(ruta, { method = 'GET', body } = {}) {
  const token = sesionGuardada.leer()?.token;
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor de La Nutria. Verifica que el backend esté encendido.', 0);
  }

  const datos = await respuesta.json().catch(() => null);
  if (respuesta.status === 401 && !ruta.startsWith('/auth/login')) {
    sesionGuardada.borrar();
    window.dispatchEvent(new CustomEvent('sesion-expirada', { detail: datos?.mensaje }));
  }
  if (!respuesta.ok) {
    throw new ApiError(datos?.mensaje || `Error ${respuesta.status}`, respuesta.status, datos?.errores);
  }
  return datos;
}

const get = (ruta, params) => solicitud(`${ruta}${query(params)}`);
const post = (ruta, body) => solicitud(ruta, { method: 'POST', body: body || {} });
const put = (ruta, body) => solicitud(ruta, { method: 'PUT', body });
const del = (ruta, body) => solicitud(ruta, { method: 'DELETE', body });

export const authApi = {
  login: (correo, contrasena) => post('/auth/login', { correo, contrasena }),
  logout: () => post('/auth/logout'),
  yo: () => get('/auth/yo'),
  cambiarContrasena: (actual, nueva) => post('/auth/cambiar-contrasena', { actual, nueva }),
};

export const usuariosApi = {
  listar: (params) => get('/usuarios', params),
  profesionales: () => get('/usuarios/profesionales'),
  crear: (datos) => post('/usuarios', datos),
  actualizar: (id, datos) => put(`/usuarios/${id}`, datos),
};

export const pacientesApi = {
  listar: () => get('/pacientes'),
  obtener: (id) => get(`/pacientes/${id}`),
  crear: (paciente) => post('/pacientes', paciente),
  actualizar: (id, cambios) => put(`/pacientes/${id}`, cambios),
  eliminar: (id) => del(`/pacientes/${id}`),
};

export const expedienteApi = {
  listar: () => get('/expedientes'),
  ficha: (pacienteId) => get(`/pacientes/${pacienteId}/expediente`),
  actualizar: (pacienteId, datos) => put(`/pacientes/${pacienteId}/expediente`, datos),
  lineaTiempo: (pacienteId, params) => get(`/pacientes/${pacienteId}/linea-tiempo`, params),
  comparacion: (pacienteId, params) => get(`/pacientes/${pacienteId}/comparacion`, params),
  reporte: (pacienteId, tipo, params) => get(`/pacientes/${pacienteId}/reportes/${tipo}`, params),
  tiposReporte: () => get('/reportes/tipos'),
};

export const antecedentesApi = {
  listar: (pacienteId, params) => get(`/pacientes/${pacienteId}/antecedentes`, params),
  crear: (pacienteId, datos) => post(`/pacientes/${pacienteId}/antecedentes`, datos),
  actualizar: (id, datos) => put(`/antecedentes/${id}`, datos),
  versiones: (id) => get(`/antecedentes/${id}/versiones`),
};

export const consultasApi = {
  global: (params) => get('/consultas', params),
  listar: (pacienteId) => get(`/pacientes/${pacienteId}/consultas`),
  crear: (pacienteId, datos) => post(`/pacientes/${pacienteId}/consultas`, datos),
  obtener: (id) => get(`/consultas/${id}`),
  guardarBorrador: (id, datos) => put(`/consultas/${id}/borrador`, datos),
  firmar: (id) => post(`/consultas/${id}/firmar`, { confirmacion: true }),
  adenda: (id, datos) => post(`/consultas/${id}/adendas`, datos),
};

export const laboratorioApi = {
  analitos: () => get('/laboratorio/analitos'),
  global: (params) => get('/laboratorios', params),
  listar: (pacienteId, params) => get(`/pacientes/${pacienteId}/laboratorios`, params),
  crear: (pacienteId, datos) => post(`/pacientes/${pacienteId}/laboratorios`, datos),
  corregir: (id, datos) => put(`/laboratorios/${id}`, datos),
};

export const planeacionApi = {
  diagnosticos: (pacienteId) => get(`/pacientes/${pacienteId}/diagnosticos`),
  crearDiagnostico: (pacienteId, datos) => post(`/pacientes/${pacienteId}/diagnosticos`, datos),
  actualizarDiagnostico: (id, datos) => put(`/diagnosticos/${id}`, datos),
  objetivos: (pacienteId) => get(`/pacientes/${pacienteId}/objetivos`),
  crearObjetivo: (pacienteId, datos) => post(`/pacientes/${pacienteId}/objetivos`, datos),
  revisarObjetivo: (id, datos) => post(`/objetivos/${id}/revisiones`, datos),
  planes: (pacienteId) => get(`/pacientes/${pacienteId}/planes`),
  crearPlan: (pacienteId, datos) => post(`/pacientes/${pacienteId}/planes`, datos),
  activarPlan: (id) => post(`/planes/${id}/activar`),
  consentimientos: (pacienteId) => get(`/pacientes/${pacienteId}/consentimientos`),
  crearConsentimiento: (pacienteId, datos) => post(`/pacientes/${pacienteId}/consentimientos`, datos),
  revocarConsentimiento: (id, motivo) => post(`/consentimientos/${id}/revocar`, { motivo }),
};

export const alertasApi = {
  listar: (params) => get('/alertas', params),
  revisar: (id, estado, nota) => put(`/alertas/${id}`, { estado, nota }),
  evaluar: (pacienteId) => post('/alertas/evaluar', pacienteId ? { pacienteId } : {}),
  reglas: () => get('/alertas/reglas'),
  crearRegla: (datos) => post('/alertas/reglas', datos),
  actualizarRegla: (id, datos) => put(`/alertas/reglas/${id}`, datos),
};

export const catalogosApi = {
  sistemas: () => get('/catalogos'),
  buscar: (sistema, q) => get(`/catalogos/${encodeURIComponent(sistema)}`, { q }),
};

export const auditoriaApi = {
  listar: (params) => get('/auditoria', params),
};

export const medicionesApi = {
  listar: (pacienteId, params) => get(`/pacientes/${pacienteId}/mediciones`, params),
  crear: (pacienteId, datos) => post(`/pacientes/${pacienteId}/mediciones`, datos),
  corregir: (id, datos) => put(`/mediciones/${id}`, datos),
  anular: (id, motivo) => del(`/mediciones/${id}`, { motivo }),
  versiones: (id) => get(`/mediciones/${id}/versiones`),
  ultimas: () => get('/mediciones/ultimas'),
};

export const prescripcionesApi = {
  listar: (pacienteId) => get(`/pacientes/${pacienteId}/prescripciones`),
  crear: (pacienteId, datos) => post(`/pacientes/${pacienteId}/prescripciones`, datos),
};

export const evaluacionesApi = {
  ajustar: (id, datos) => post(`/evaluaciones/${id}/ajustes`, datos),
  retirarAjuste: (id, ajusteId) => del(`/evaluaciones/${id}/ajustes/${ajusteId}`),
};

export const citasApi = {
  listar: (params) => get('/citas', params),
  listarPaciente: (pacienteId) => get(`/pacientes/${pacienteId}/citas`),
  crear: (pacienteId, datos) => post(`/pacientes/${pacienteId}/citas`, datos),
  actualizar: (id, datos) => put(`/citas/${id}`, datos),
};

export const adherenciaApi = {
  listar: (params) => get('/adherencia', params),
  marcar: (pacienteId, datos) => put(`/pacientes/${pacienteId}/adherencia`, datos),
};

export const estadisticasApi = {
  dashboardPaciente: (pacienteId, params) => get(`/pacientes/${pacienteId}/dashboard`, params),
  resumen: (anio) => get('/estadisticas/resumen', { anio }),
};

export const calculosApi = {
  formulas: () => get('/calculos/formulas'),
  evaluar: (datos) => post('/calculos/evaluar', datos),
};
