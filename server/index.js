const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3001; 

app.use(express.json());

const MONGO_URI = 'mongodb://127.0.0.1:27017/lanutria';

mongoose.connect(MONGO_URI)
  .then(() => console.log('¡Conectado exitosamente a MondongoDB (MongoDB)! 🦦'))
  .catch((err) => console.error('Error al conectar a la base de datos:', err));

app.get('/api/prueba', (req, res) => {
  res.json({ mensaje: '¡El servidor de La Nutria está funcionando al 100%!' });
});

app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});