/**
 * Respaldo y restauración cifrados (AES-256-GCM con CLAVE_CIFRADO).
 *   npm run respaldo                       → backend/respaldos/la-nutria-AAAAMMDD-HHMM.json.enc
 *   npm run restaurar -- --archivo ruta    → restaura en la base de MONGO_URI (pide confirmación)
 * Los campos ya cifrados en la base se copian tal cual (doble protección).
 * Para producción se recomienda además el respaldo administrado de MongoDB Atlas
 * (no disponible en el plan gratuito M0).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const CARPETA = path.join(__dirname, '..', 'respaldos');
const clave = () => {
  const k = Buffer.from(process.env.CLAVE_CIFRADO || '', 'base64');
  if (k.length !== 32) throw new Error('CLAVE_CIFRADO no configurada');
  return k;
};

async function respaldar() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const datos = { version: 1, fecha: new Date().toISOString(), base: db.databaseName, colecciones: {} };
  for (const { name } of await db.listCollections().toArray()) {
    datos.colecciones[name] = await db.collection(name).find().toArray(); // eslint-disable-line no-await-in-loop
  }
  await mongoose.disconnect();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const cifrado = Buffer.concat([cipher.update(EJSON.stringify(datos, { relaxed: false }), 'utf8'), cipher.final()]);
  fs.mkdirSync(CARPETA, { recursive: true });
  const nombre = `la-nutria-${datos.fecha.slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}.json.enc`;
  fs.writeFileSync(path.join(CARPETA, nombre), Buffer.concat([iv, cipher.getAuthTag(), cifrado]));
  const totales = Object.fromEntries(Object.entries(datos.colecciones).map(([k, v]) => [k, v.length]));
  console.log(`Respaldo creado: respaldos/${nombre}`, totales);
}

async function restaurar(archivo) {
  const buf = fs.readFileSync(archivo);
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const datos = EJSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = await new Promise((ok) => rl.question(`Se REEMPLAZARÁN las colecciones de la base actual con el respaldo del ${datos.fecha}. Escribe RESTAURAR para continuar: `, ok));
  rl.close();
  if (r !== 'RESTAURAR') { console.log('Cancelado'); return; }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  for (const [nombre, docs] of Object.entries(datos.colecciones)) {
    await db.collection(nombre).deleteMany({}); // eslint-disable-line no-await-in-loop
    if (docs.length) await db.collection(nombre).insertMany(docs); // eslint-disable-line no-await-in-loop
    console.log(`  ${nombre}: ${docs.length}`);
  }
  await mongoose.disconnect();
  console.log('Restauración completada');
}

const i = process.argv.indexOf('--archivo');
(i > -1 ? restaurar(process.argv[i + 1]) : respaldar()).catch((e) => { console.log('Error:', e.message); process.exitCode = 1; });
