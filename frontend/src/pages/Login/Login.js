import { useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MARCA } from '../../config/marca';
import LogoNutriva from '../../components/Marca/LogoNutriva';
import SelectorTema from '../../components/Tema/SelectorTema';
import SolicitarAcceso from './SolicitarAcceso';
import './Login.css';

function Login() {
  const { iniciar, aviso } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
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
    <main className="login" style={{ '--login-fondo': `url(${MARCA.ilustracion})` }}>
      <SelectorTema className="login__tema" />
      <section className="login__tarjeta" aria-labelledby="titulo-login">
        <div className="login__marca">
          <LogoNutriva tamano={56} className="login__logo" />
          <div>
            <h1 id="titulo-login">{MARCA.nombre}</h1>
            <p>{MARCA.descriptor}</p>
          </div>
        </div>
        <p className="login__eslogan">{MARCA.eslogan}</p>

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
            <div className="login__contrasena">
              <input id="login-contrasena" type={verContrasena ? 'text' : 'password'} autoComplete="current-password" value={contrasena}
                onChange={(e) => setContrasena(e.target.value)} required />
              <button type="button" className="login__ver" onClick={() => setVerContrasena((v) => !v)}
                aria-controls="login-contrasena" aria-pressed={verContrasena}
                aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {verContrasena ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
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
