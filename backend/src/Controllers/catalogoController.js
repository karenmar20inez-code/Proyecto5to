const Catalogo = require('../Models/Catalogo');
const { normalizar } = require('../Services/clinica/reglasAlerta');
const { ErrorHttp, controlador } = require('../Services/http');

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/catalogos  → sistemas importados y número de entradas
const sistemas = controlador(async (req, res) => {
  res.json(await Catalogo.aggregate([
    { $group: { _id: '$sistema', total: { $sum: 1 }, fuente: { $first: '$fuente' }, version: { $first: '$version' } } },
    { $project: { _id: 0, sistema: '$_id', total: 1, fuente: 1, version: 1 } },
  ]));
});

// GET /api/catalogos/:sistema?q=texto  → búsqueda por código o texto (máx. 20)
const buscar = controlador(async (req, res) => {
  const q = normalizar(String(req.query.q || '').trim());
  if (q.length < 2) throw new ErrorHttp(400, 'Escribe al menos 2 caracteres');
  const patron = new RegExp(escaparRegex(q), 'i');
  const lista = await Catalogo.find({
    sistema: req.params.sistema,
    $or: [{ codigo: new RegExp(`^${escaparRegex(q)}`, 'i') }, { textoNormalizado: patron }],
  }).limit(20).select('codigo texto fuente version').lean();
  res.json(lista);
});

module.exports = { sistemas, buscar };
