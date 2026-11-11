const mongoose = require('mongoose');

const TIPOS_REGLA = {
  laboratorio_fuera_rango_lab: 'Resultado fuera del rango de referencia del laboratorio',
  laboratorio_umbral: 'Resultado de laboratorio fuera de un umbral configurado',
  cambio_peso: 'Cambio de peso relevante en un periodo',
  seguimiento_pendiente: 'Seguimiento pendiente',
  objetivo_sin_revision: 'Objetivo sin revisión',
  datos_incompletos: 'Datos clínicos incompletos',
  consulta_no_realizada: 'Consulta no realizada',
  alergia_en_plan: 'Alimento del plan coincide con alergia/intolerancia registrada',
};
const PRIORIDADES = ['baja', 'media', 'alta'];

/** Regla configurable por el administrador. */
const reglaSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true },
    tipo: { type: String, enum: Object.keys(TIPOS_REGLA), required: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    parametros: { type: mongoose.Schema.Types.Mixed, default: {} },
    prioridad: { type: String, enum: PRIORIDADES, default: 'media' },
    activa: { type: Boolean, default: true },
    nota: { type: String, trim: true }, // advertencia sobre el origen del valor por omisión
    actualizadoPor: String,
  },
  { timestamps: true, versionKey: false }
);

/** Alerta generada para un paciente. Nunca se borra: se revisa o se cierra. */
const alertaSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    reglaId: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertaRegla' },
    codigoRegla: String,
    tipo: { type: String, enum: Object.keys(TIPOS_REGLA) },
    llave: { type: String, required: true, unique: true }, // evita duplicados
    motivo: { type: String, required: true },
    prioridad: { type: String, enum: PRIORIDADES, default: 'media' },
    fecha: { type: Date, default: Date.now },
    origen: { coleccion: String, id: mongoose.Schema.Types.ObjectId, pestana: String },
    estado: { type: String, enum: ['pendiente', 'revisada', 'descartada', 'cerrada'], default: 'pendiente', index: true },
    revision: { usuarioId: mongoose.Schema.Types.ObjectId, usuario: String, fecha: Date, nota: String },
  },
  { timestamps: true, versionKey: false }
);

const AlertaRegla = mongoose.model('AlertaRegla', reglaSchema, 'alerta_reglas');
const Alerta = mongoose.model('Alerta', alertaSchema, 'alertas');

module.exports = { Alerta, AlertaRegla, TIPOS_REGLA, PRIORIDADES };
