const mongoose = require('mongoose');
const { ErrorValidacion } = require('./nutricion/formulas');

class ErrorHttp extends Error {
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

const idValido = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

function exigirId(id, nombre = 'ID') {
  if (!idValido(id)) throw new ErrorHttp(400, `${nombre} inválido`);
  return id;
}

/** Copia solo los campos permitidos; '' / null se descartan. */
function tomarCampos(body = {}, campos = []) {
  const datos = {};
  campos.forEach((c) => {
    if (c in body && body[c] !== '' && body[c] !== null && body[c] !== undefined) datos[c] = body[c];
  });
  return datos;
}

/** Fechas de filtro (?desde=AAAA-MM-DD&hasta=AAAA-MM-DD) */
function rangoFechas({ desde, hasta } = {}) {
  const filtro = {};
  if (desde) {
    const d = new Date(desde);
    if (Number.isNaN(d.getTime())) throw new ErrorHttp(400, 'Parámetro "desde" inválido');
    filtro.$gte = d;
  }
  if (hasta) {
    const h = new Date(hasta);
    if (Number.isNaN(h.getTime())) throw new ErrorHttp(400, 'Parámetro "hasta" inválido');
    if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) h.setUTCHours(23, 59, 59, 999);
    filtro.$lte = h;
  }
  return Object.keys(filtro).length ? filtro : null;
}

function manejarError(res, error) {
  if (error instanceof ErrorHttp) {
    return res.status(error.status).json({ mensaje: error.message, ...(error.errores && { errores: error.errores }) });
  }
  if (error instanceof ErrorValidacion) {
    return res.status(400).json({ mensaje: error.message, errores: { [error.campo]: error.message } });
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const errores = Object.fromEntries(
      Object.entries(error.errors).map(([campo, e]) => [
        campo,
        e instanceof mongoose.Error.CastError ? `Valor inválido para ${campo}` : e.message,
      ])
    );
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }
  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ mensaje: `Valor inválido para ${error.path}` });
  }
  if (error && error.code === 11000) {
    // Índice único: indica qué campo está repetido (p. ej. el correo del paciente o del usuario)
    const campo = Object.keys(error.keyPattern || error.keyValue || {})[0];
    if (campo === 'correo') {
      return res.status(409).json({ mensaje: 'Ya existe un registro con ese correo electrónico', errores: { correo: 'Este correo ya está registrado' } });
    }
    return res.status(409).json({ mensaje: 'El registro ya existe', ...(campo && { errores: { [campo]: 'Valor repetido' } }) });
  }
  console.error('Error no controlado:', error);
  return res.status(500).json({ mensaje: 'Error interno del servidor' });
}

/** Envuelve un controlador async para responder errores de forma uniforme */
const controlador = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    manejarError(res, error);
  }
};

module.exports = { ErrorHttp, idValido, exigirId, tomarCampos, rangoFechas, manejarError, controlador };
