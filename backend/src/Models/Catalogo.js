const mongoose = require('mongoose');

/**
 * Entradas de catálogos autorizados (CIE-10, medicamentos, etc.).
 * El proyecto NO incluye su contenido: se importa desde la fuente oficial
 * con `npm run importar-catalogo -- --sistema CIE-10 --archivo ruta.csv`.
 */
const catalogoSchema = new mongoose.Schema(
  {
    sistema: { type: String, required: true, trim: true },
    codigo: { type: String, required: true, trim: true },
    texto: { type: String, required: true, trim: true },
    textoNormalizado: { type: String, index: true },
    fuente: { type: String, trim: true },
    version: { type: String, trim: true },
  },
  { versionKey: false }
);

catalogoSchema.index({ sistema: 1, codigo: 1 }, { unique: true });

module.exports = mongoose.model('Catalogo', catalogoSchema, 'catalogos');
