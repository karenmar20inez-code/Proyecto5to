
const mongoose = require('mongoose');
require('dotenv').config();

// La información sensible se cifra: sin clave no se arranca (ver npm run generar-clave)
try {
  require('./src/Services/seguridad/cifrado').cifrar('verificacion');
} catch (error) {
  console.error(`\n⚠  ${error.message}\n`);
  process.exit(1);
}

// Rutas, middlewares y manejo de errores: src/app.js
const app = require('./src/app');

// Conexión con MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado correctamente 💚');

    app.listen(process.env.PORT || 5000, () => {
      console.log('Servidor de La Nutria funcionando');
    });
  })
  .catch((error) => {
    console.error('Error al conectar MongoDB:', error.message);
  });
