const express = require('express');
const auth = require('../Controllers/authController');
const usuarios = require('../Controllers/usuarioController');
const { autenticar, exigirPermiso } = require('../Services/seguridad/middleware');

/* /api/auth */
const authRouter = express.Router();
authRouter.post('/login', auth.login);
authRouter.post('/logout', autenticar, auth.logout);
authRouter.get('/yo', autenticar, auth.yo);
authRouter.post('/cambiar-contrasena', autenticar, auth.cambiarContrasena);

/* /api/usuarios (requiere sesión; la gestión es solo para administración) */
const usuariosRouter = express.Router();
usuariosRouter.get('/profesionales', usuarios.profesionales);
usuariosRouter.get('/', exigirPermiso('administracion'), usuarios.listar);
usuariosRouter.post('/', exigirPermiso('administracion'), usuarios.crear);
usuariosRouter.put('/:id', exigirPermiso('administracion'), usuarios.actualizar);

module.exports = { authRouter, usuariosRouter };
