/**
 * Importa un catálogo autorizado desde CSV (codigo,texto) a la colección `catalogos`.
 * El proyecto no incluye catálogos: descárgalos de la fuente oficial (p. ej. DGIS/CIE-10).
 * Uso: npm run importar-catalogo -- --sistema CIE-10 --archivo cie10.csv --fuente "DGIS" --version "2024"
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const mongoose = require('mongoose');
const Catalogo = require('../src/Models/Catalogo');
const { normalizar } = require('../src/Services/clinica/reglasAlerta');

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };

/* CSV simple con comillas opcionales */
function filas(texto) {
  return texto.split(/\r?\n/).filter(Boolean).map((linea) => {
    const celdas = [];
    let actual = '';
    let comillas = false;
    for (const ch of linea) {
      if (ch === '"') comillas = !comillas;
      else if (ch === ',' && !comillas) { celdas.push(actual); actual = ''; } else actual += ch;
    }
    celdas.push(actual);
    return celdas.map((c) => c.trim());
  });
}

(async () => {
  const sistema = arg('sistema');
  const archivo = arg('archivo');
  if (!sistema || !archivo) { console.log('Uso: npm run importar-catalogo -- --sistema CIE-10 --archivo ruta.csv [--fuente X --version Y]'); process.exit(1); }
  const lista = filas(fs.readFileSync(archivo, 'utf8'));
  const [encabezado, ...datos] = /codigo/i.test(lista[0]?.[0] || '') ? lista : [null, ...lista];
  if (encabezado) console.log('Encabezado detectado:', encabezado.join(', '));

  await mongoose.connect(process.env.MONGO_URI);
  const ops = datos.filter((f) => f[0] && f[1]).map(([codigo, texto]) => ({
    updateOne: {
      filter: { sistema, codigo },
      update: { $set: { sistema, codigo, texto, textoNormalizado: normalizar(texto), fuente: arg('fuente'), version: arg('version') } },
      upsert: true,
    },
  }));
  for (let i = 0; i < ops.length; i += 1000) await Catalogo.bulkWrite(ops.slice(i, i + 1000)); // eslint-disable-line no-await-in-loop
  console.log(`Importadas/actualizadas ${ops.length} entradas en ${sistema}`);
  await mongoose.disconnect();
})().catch((e) => { console.log('Error:', e.message); process.exitCode = 1; });
