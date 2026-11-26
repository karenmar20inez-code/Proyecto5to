import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import { useAuth, nombreRolCompleto } from '../../context/AuthContext';
import { authApi } from '../../services/api';

function Perfil() {
  const { usuario, salir } = useAuth();
  const [f, setF] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });

  const cambiar = async (e) => {
    e.preventDefault();
    if (f.nueva !== f.confirmacion) return setMensaje({ texto: 'La confirmación no coincide.', tipo: 'error' });
    try {
      const r = await authApi.cambiarContrasena(f.actual, f.nueva);
      setMensaje({ texto: r.mensaje, tipo: 'ok' });
      setTimeout(salir, 1500);
    } catch (err) { setMensaje({ texto: err.message, tipo: 'error' }); }
    return undefined;
  };

  return (
    <Layout titulo="Mi perfil">
      <div className="rejilla-2">
        <section className="panel">
          <h2>Datos de la cuenta</h2>
          <dl className="datos" style={{ marginTop: 'var(--e3)' }}>
            <dt>Nombre</dt><dd>{usuario?.nombre}</dd>
            <dt>Correo</dt><dd>{usuario?.correo}</dd>
            <dt>Rol</dt><dd>{nombreRolCompleto(usuario)}</dd>
            <dt>Cédula profesional</dt><dd>{usuario?.cedulaProfesional || '—'}</dd>
          </dl>
          {usuario?.debeCambiarContrasena && <p className="aviso aviso--alerta" role="alert">Tu contraseña es temporal: cámbiala para poder usar NUTRIVA. Después inicia sesión con la nueva.</p>}
        </section>
        <section className="panel" id="contrasena">
          <h2><KeyRound size={16} aria-hidden="true" /> Cambiar contraseña</h2>
          <p className="panel-descripcion">Mínimo 10 caracteres con letras y números. Se cerrarán tus sesiones abiertas.</p>
          <form className="formulario" onSubmit={cambiar}>
            <div className="campo campo--completo"><label htmlFor="p-actual">Contraseña actual</label><input id="p-actual" type="password" autoComplete="current-password" value={f.actual} required onChange={(e) => setF({ ...f, actual: e.target.value })} /></div>
            <div className="campo"><label htmlFor="p-nueva">Nueva contraseña</label><input id="p-nueva" type="password" autoComplete="new-password" minLength={10} value={f.nueva} required onChange={(e) => setF({ ...f, nueva: e.target.value })} /></div>
            <div className="campo"><label htmlFor="p-conf">Confirmación</label><input id="p-conf" type="password" autoComplete="new-password" value={f.confirmacion} required onChange={(e) => setF({ ...f, confirmacion: e.target.value })} /></div>
            {mensaje.texto && <p className={`aviso aviso--${mensaje.tipo === 'ok' ? 'ok' : 'error'} campo--completo`} role="status">{mensaje.texto}</p>}
            <div className="formulario-acciones"><button className="boton boton--primario" type="submit">Actualizar contraseña</button></div>
          </form>
        </section>
      </div>
    </Layout>
  );
}

export default Perfil;
