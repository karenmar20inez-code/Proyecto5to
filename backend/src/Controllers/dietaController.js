const Dieta = require('../Models/Dieta');
const DIETAS_BASE = require('../data/dietas-base.json');
const { controlador, tomarCampos, ErrorHttp } = require('../Services/http');
const { registrarAuditoria } = require('../Services/auditoria');

/* El frontend identifica cada dieta por `id` (= clave) */
const aCliente = (d) => ({ ...d, id: d.clave });

/** Convierte un nombre en clave: "Dieta semana 3" → "dieta-semana-3" */
function claveDesdeNombre(nombre = '') {
  return String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'dieta';
}

/* Las dietas que antes vivían en el código del frontend se cargan una vez.
   $setOnInsert no sobrescribe una dieta ya editada en la base. */
let sembrado = null;
function sembrarBase() {
  if (!sembrado) {
    sembrado = Promise.all(DIETAS_BASE.map((d) => Dieta.updateOne(
      { clave: d.clave }, { $setOnInsert: { ...d, creadoPor: 'Catálogo inicial' } }, { upsert: true }
    ))).catch((error) => { sembrado = null; throw error; });
  }
  return sembrado;
}

// GET /api/dietas?archivadas=1
const listar = controlador(async (req, res) => {
  await sembrarBase();
  const filtro = req.query.archivadas === '1' ? {} : { activa: true };
  const dietas = await Dieta.find(filtro).sort({ activa: -1, inicio: -1, nombre: 1 }).lean();
  res.json(dietas.map(aCliente));
});

// GET /api/dietas/:clave
const obtener = controlador(async (req, res) => {
  await sembrarBase();
  const dieta = await Dieta.findOne({ clave: String(req.params.clave).toLowerCase() }).lean();
  if (!dieta) throw new ErrorHttp(404, 'Dieta no encontrada');
  res.json(aCliente(dieta));
});

const CAMPOS = ['nombre', 'inicio', 'fin', 'nota', 'dias'];

// POST /api/dietas
const crear = controlador(async (req, res) => {
  const datos = tomarCampos(req.body, CAMPOS);
  const base = claveDesdeNombre(datos.nombre);
  let clave = base;
  for (let n = 2; await Dieta.exists({ clave }); n += 1) clave = `${base}-${n}`;
  const dieta = await Dieta.create({ ...datos, clave, creadoPor: req.usuario?.nombre });
  registrarAuditoria(req, { accion: 'crear', entidad: 'Dieta', entidadId: dieta._id, campos: Object.keys(datos) });
  res.status(201).json(aCliente(dieta.toObject()));
});

// PUT /api/dietas/:clave   (la clave no cambia; `activa: false` archiva)
const actualizar = controlador(async (req, res) => {
  const dieta = await Dieta.findOne({ clave: String(req.params.clave).toLowerCase() });
  if (!dieta) throw new ErrorHttp(404, 'Dieta no encontrada');
  const cambios = tomarCampos(req.body, [...CAMPOS, 'activa']);
  if (req.body?.nota === '') cambios.nota = ''; // permite borrar la nota
  dieta.set({ ...cambios, actualizadoPor: req.usuario?.nombre });
  await dieta.save();
  registrarAuditoria(req, {
    accion: cambios.activa === false ? 'anular' : 'actualizar', entidad: 'Dieta', entidadId: dieta._id, campos: Object.keys(cambios),
  });
  res.json(aCliente(dieta.toObject()));
});

module.exports = { listar, obtener, crear, actualizar, claveDesdeNombre };
