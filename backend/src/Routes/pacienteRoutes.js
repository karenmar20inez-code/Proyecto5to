const express = require('express');
const {
  obtenerPacientes,
  obtenerPaciente,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
} = require('../Controllers/pacienteController');
const { exigirPermiso } = require('../Services/seguridad/middleware');

const router = express.Router();

router.get('/', exigirPermiso('pacientes:leer'), obtenerPacientes);
router.get('/:id', exigirPermiso('pacientes:leer'), obtenerPaciente);
router.post('/', exigirPermiso('pacientes:escribir'), crearPaciente);
router.put('/:id', exigirPermiso('pacientes:escribir'), actualizarPaciente);
router.delete('/:id', exigirPermiso('pacientes:eliminar'), eliminarPaciente);

module.exports = router;
