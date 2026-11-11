/**
 * Cifrado de campos sensibles · AES-256-GCM (autenticado).
 * La clave se lee de CLAVE_CIFRADO (32 bytes en base64). Genera una con:
 *   npm run generar-clave
 * Formato guardado: "enc:v1:<iv>:<tag>:<datos>" (base64). Si la clave cambia,
 * los datos previos no podrán leerse: respáldala fuera del repositorio.
 */
const crypto = require('crypto');

const PREFIJO = 'enc:v1:';
let claveCache = null;

function clave() {
  if (claveCache) return claveCache;
  const texto = process.env.CLAVE_CIFRADO;
  if (!texto) throw new Error('Falta CLAVE_CIFRADO en el entorno. Ejecuta "npm run generar-clave" y agrégala al archivo .env');
  const buf = Buffer.from(texto, 'base64');
  if (buf.length !== 32) throw new Error('CLAVE_CIFRADO debe tener 32 bytes codificados en base64');
  claveCache = buf;
  return buf;
}

const estaCifrado = (v) => typeof v === 'string' && v.startsWith(PREFIJO);

function cifrar(texto) {
  if (texto === undefined || texto === null || texto === '' || estaCifrado(texto)) return texto;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return `${PREFIJO}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${datos.toString('base64')}`;
}

function descifrar(valor) {
  if (!estaCifrado(valor)) return valor;
  const [iv, tag, datos] = valor.slice(PREFIJO.length).split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
}

/* Recorre una ruta "a.b.c" aplicando fn a los valores (soporta arreglos intermedios) */
function transformarRuta(obj, partes, fn) {
  if (!obj || typeof obj !== 'object') return;
  const [actual, ...resto] = partes;
  if (Array.isArray(obj)) {
    obj.forEach((el) => transformarRuta(el, partes, fn));
    return;
  }
  if (!resto.length) {
    if (actual in obj) obj[actual] = fn(obj[actual]);
    return;
  }
  transformarRuta(obj[actual], resto, fn);
}

const aplicar = (obj, rutas, fn) => {
  rutas.forEach((r) => transformarRuta(obj, r.split('.'), fn));
  return obj;
};

/**
 * Plugin de Mongoose: cifra `rutas` al guardar/actualizar y las descifra al leer
 * (documentos hidratados y consultas .lean()).
 */
function pluginCifrado(schema, { rutas }) {
  schema.pre('save', function cifrarAlGuardar() {
    aplicar(this._doc, rutas, cifrar);
  });
  schema.post('save', function descifrarTrasGuardar(doc) {
    aplicar(doc._doc, rutas, descifrar);
  });
  schema.post('init', function descifrarAlCargar(doc) {
    aplicar(doc._doc, rutas, descifrar);
  });

  const cifrarActualizacion = function cifrarActualizacion() {
    const u = this.getUpdate() || {};
    [u, u.$set || {}].forEach((bloque) => {
      Object.keys(bloque).forEach((k) => {
        if (k.startsWith('$')) return;
        rutas.forEach((r) => {
          if (k === r) bloque[k] = cifrar(bloque[k]);
          else if (r.startsWith(`${k}.`)) aplicar(bloque[k], [r.slice(k.length + 1)], cifrar);
        });
      });
    });
    if (u.$push) {
      Object.keys(u.$push).forEach((k) => rutas.forEach((r) => {
        if (r.startsWith(`${k}.`)) aplicar(u.$push[k], [r.slice(k.length + 1)], cifrar);
      }));
    }
  };
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], cifrarActualizacion);

  const descifrarLean = function descifrarLean(res) {
    if (!this._mongooseOptions?.lean || !res) return;
    (Array.isArray(res) ? res : [res]).forEach((d) => aplicar(d, rutas, descifrar));
  };
  schema.post(['find', 'findOne', 'findOneAndUpdate'], descifrarLean);
}

module.exports = { cifrar, descifrar, estaCifrado, pluginCifrado, aplicarRutas: aplicar, _reiniciarClave: () => { claveCache = null; } };
