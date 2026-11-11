/**
 * Punto de entrada serverless para Vercel.
 * Reutiliza la misma aplicación Express (src/app.js) que usa server.js en local;
 * server.js sigue siendo el arranque para desarrollo (`npm run dev`).
 *
 * Diferencias con server.js:
 *  - No hay `app.listen`: Vercel invoca esta función por cada petición.
 *  - La conexión a MongoDB se reutiliza entre invocaciones de la misma instancia.
 *  - Se confía en el proxy de Vercel para obtener la IP real (límite de intentos de login).
 */
require('dotenv').config(); // En Vercel no hay archivo de variables: se usan las del panel del proyecto.
const mongoose = require('mongoose');
const app = require('../src/app');

// Detrás del proxy de Vercel, req.ip debe salir de X-Forwarded-For;
// si no, todas las usuarias compartirían la misma IP en el límite de intentos.
app.set('trust proxy', true);

let errorConfiguracion = null;
try {
  require('../src/Services/seguridad/cifrado').cifrar('verificacion');
} catch (error) {
  errorConfiguracion = error.message;
}

let conexion = null;
function conectar() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!conexion) {
    conexion = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .catch((error) => { conexion = null; throw error; });
  }
  return conexion;
}

module.exports = async (req, res) => {
  if (errorConfiguracion) {
    console.error('Configuración incompleta:', errorConfiguracion);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ mensaje: 'El servidor no está configurado (falta la clave de cifrado).' }));
  }
  try {
    await conectar();
  } catch (error) {
    console.error('Error al conectar MongoDB:', error.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ mensaje: 'No se pudo conectar con la base de datos. Intenta de nuevo.' }));
  }
  return app(req, res);
};
