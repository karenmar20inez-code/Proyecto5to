import { useState } from 'react';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoNutria from '../../Assets/Picture/LaNutria.webp';
import fondoLogin from '../../Assets/Picture/Login.webp';
import SolicitarAcceso from './SolicitarAcceso';
import './Login.css';

function Login() {
  const { iniciar, aviso } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [solicitando, setSolicitando] = useState(false); // formulario "Solicitar acceso"

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await iniciar(correo, contrasena);
    } catch (err) {
      setError(err.message);
      setContrasena('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="login" style={{ '--login-fondo': `url(${fondoLogin})` }}>
      <section className="login__tarjeta" aria-labelledby="titulo-login">
        <div className="login__marca">
          <img src={logoNutria} alt="" className="login__logo" width="56" height="56" />
          <div>
            <h1 id="titulo-login">La Nutria</h1>
            <p>Gestión clínica nutricional</p>
          </div>
        </div>

        {aviso && !solicitando && <p className="aviso" role="status">{aviso}</p>}

        {solicitando ? <SolicitarAcceso onVolver={() => setSolicitando(false)} /> : (
        <>
        <form className="login__formulario" onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="login-correo">Correo electrónico</label>
            <input id="login-correo" type="email" autoComplete="username" value={correo}
              onChange={(e) => setCorreo(e.target.value)} required autoFocus />
          </div>
          <div className="campo">
            <label htmlFor="login-contrasena">Contraseña</label>
            <input id="login-contrasena" type="password" autoComplete="current-password" value={contrasena}
              onChange={(e) => setContrasena(e.target.value)} required />
          </div>
          {error && <p className="aviso aviso--error" role="alert">{error}</p>}
          <button className="boton boton--primario login__boton" type="submit" disabled={enviando || !correo || !contrasena}>
            <LogIn aria-hidden="true" /> {enviando ? 'Verificando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="login__registro">
          ¿No tienes cuenta?{' '}
          <button type="button" className="boton boton--fantasma boton--chico" onClick={() => { setError(''); setSolicitando(true); }}>
            <UserPlus aria-hidden="true" /> Solicitar acceso
          </button>
        </p>
        </>
        )}

        <p className="login__pie">
          <ShieldCheck aria-hidden="true" /> Acceso restringido a personal autorizado. Las acciones quedan registradas en la bitácora de auditoría.
        </p>
      </section>
    </main>
  );
}

export default Login;
