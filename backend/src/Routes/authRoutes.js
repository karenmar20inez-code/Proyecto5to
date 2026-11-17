const express = require('express');
const auth = require('../Controllers/authController');
const usuarios = require('../Controllers/usuarioController');
const consultorios = require('../Controllers/consultorioController');
const solicitudes = require('../Controllers/solicitudController');
const { autenticar, exigirPermiso } = require('../Services/seguridad/middleware');

/* /api/auth */
const authRouter = express.Router();
authRouter.post('/login', auth.login);
authRouter.post('/logout', autenticar, auth.logout);
authRouter.get('/yo', autenticar, auth.yo);
authRouter.post('/cambiar-contrasena', autenticar, auth.cambiarContrasena);
// Registro por cuenta propia: crea una solicitud pendiente (no da acceso hasta que se apruebe)
authRouter.post('/solicitar-acceso', solicitudes.solicitar);

/* /api/usuarios (requiere sesión). Además del permiso, el controlador aplica la jerarquía de roles:
   solo se crean, ven y gestionan cuentas de nivel inferior, nunca la propia. */
const usuariosRouter = express.Router();
usuariosRouter.get('/profesionales', usuarios.profesionales);
usuariosRouter.get('/roles', exigirPermiso('usuarios:leer'), usuarios.catalogo);
usuariosRouter.get('/', exigirPermiso('usuarios:leer'), usuarios.listar);
usuariosRouter.post('/', exigirPermiso('usuarios:crear'), usuarios.crear);
usuariosRouter.put('/:id', exigirPermiso('usuarios:leer'), usuarios.actualizar); // editar/estado se validan dentro

/* /api/consultorios (lectura para quien gestiona cuentas; alta y cambios: consultorios:gestionar) */
const consultoriosRouter = express.Router();
consultoriosRouter.get('/', consultorios.listar);
consultoriosRouter.post('/', exigirPermiso('consultorios:gestionar'), consultorios.crear);
consultoriosRouter.put('/:id', exigirPermiso('consultorios:gestionar'), consultorios.actualizar);

/* /api/solicitudes: revisión de solicitudes de acceso (quien puede crear cuentas) */
const solicitudesRouter = express.Router();
solicitudesRouter.use(exigirPermiso('usuarios:crear'));
solicitudesRouter.get('/', solicitudes.listar);
solicitudesRouter.post('/:id/aprobar', solicitudes.aprobar);
solicitudesRouter.post('/:id/rechazar', solicitudes.rechazar);

module.exports = { authRouter, usuariosRouter, consultoriosRouter, solicitudesRouter };
