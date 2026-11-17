import { useState } from 'react';
import { Send, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../services/api';

const TIPOS = [
  ['nutriologo', 'Nutriólogo(a)', 'Atiendo pacientes en el consultorio.'],
  ['administrativo', 'Personal administrativo', 'Recepción, agenda o gestión del consultorio.'],
  ['docente', 'Docente', 'Supervisión o enseñanza (sin datos identificables).'],
  ['paciente', 'Paciente', 'Quiero consultar mi dieta, citas y progreso.'],
];
const VACIO = { nombre: '', correo: '', telefono: '', rolSolicitado: '', cedulaProfesional: '', mensaje: '', contrasena: '', confirmacion: '' };

/**
 * Registro por cuenta propia: la persona elige su correo y contraseña y el tipo de acceso.
 * No entra de inmediato: un superusuario o administrador revisa y aprueba la solicitud.
 */
function SolicitarAcceso({ onVolver }) {
  const [f, setF] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState('');

  const cambiar = (campo, valor) => {
    setF((x) => ({ ...x, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: '' }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setErrores({});
    if (f.contrasena !== f.confirmacion) { setErrores({ confirmacion: 'Las contraseñas no coinciden' }); return; }
    setEnviando(true);
    try {
      const { confirmacion, ...datos } = f;
      if (datos.rolSolicitado !== 'nutriologo') delete datos.cedulaProfesional;
      const r = await authApi.solicitarAcceso(datos);
      setEnviada(r.mensaje);
    } catch (err) {
      setError(err.message);
      setErrores(err.errores || {});
    } finally {
      setEnviando(false);
    }
  };

  const errorDe = (c) => (errores[c] ? <small className="campo__error">{errores[c]}</small> : null);

  if (enviada) {
    return (
      <div className="login__enviada" role="status">
        <CheckCircle2 aria-hidden="true" />
        <h2>Solicitud enviada</h2>
        <p>{enviada}</p>
        <button type="button" className="boton boton--secundario login__boton" onClick={onVolver}>
          <ArrowLeft aria-hidden="true" /> Volver a iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <form className="login__formulario" onSubmit={enviar}>
      <h2 className="login__subtitulo">Solicitar acceso</h2>
      <p className="campo__ayuda" style={{ marginTop: -8 }}>Tu cuenta quedará activa cuando el consultorio apruebe la solicitud.</p>
      <div className="campo">
        <label htmlFor="sol-nombre">Nombre completo *</label>
        <input id="sol-nombre" value={f.nombre} required minLength={3} maxLength={120} autoComplete="name" onChange={(e) => cambiar('nombre', e.target.value)} autoFocus />
        {errorDe('nombre')}
      </div>
      <div className="campo">
        <label htmlFor="sol-correo">Correo electrónico *</label>
        <input id="sol-correo" type="email" value={f.correo} required autoComplete="email" onChange={(e) => cambiar('correo', e.target.value)} />
        {errorDe('correo')}
      </div>
      <div className="campo">
        <label htmlFor="sol-tel">Teléfono</label>
        <input id="sol-tel" type="tel" value={f.telefono} autoComplete="tel" pattern="[0-9 \(\)+\-]{7,20}" title="7 a 20 caracteres: números, espacios, +, ( ) o -" onChange={(e) => cambiar('telefono', e.target.value)} />
        {errorDe('telefono')}
      </div>
      <fieldset className="campo login__tipos">
        <legend>Tipo de acceso *</legend>
        {TIPOS.map(([clave, nombre, ayuda]) => (
          <label key={clave} className={`login__tipo${f.rolSolicitado === clave ? ' login__tipo--activo' : ''}`}>
            <input type="radio" name="rolSolicitado" value={clave} checked={f.rolSolicitado === clave} required onChange={(e) => cambiar('rolSolicitado', e.target.value)} />
            <span><strong>{nombre}</strong><small>{ayuda}</small></span>
          </label>
        ))}
        {errorDe('rolSolicitado')}
      </fieldset>
      {f.rolSolicitado === 'nutriologo' && (
        <div className="campo">
          <label htmlFor="sol-ced">Cédula profesional</label>
          <input id="sol-ced" value={f.cedulaProfesional} maxLength={20} onChange={(e) => cambiar('cedulaProfesional', e.target.value)} />
        </div>
      )}
      <div className="campo">
        <label htmlFor="sol-pass">Contraseña *</label>
        <input id="sol-pass" type="password" value={f.contrasena} required minLength={10} autoComplete="new-password" onChange={(e) => cambiar('contrasena', e.target.value)} />
        <span className="campo__ayuda">Mínimo 10 caracteres con letras y números.</span>
        {errorDe('contrasena')}
      </div>
      <div className="campo">
        <label htmlFor="sol-pass2">Confirma la contraseña *</label>
        <input id="sol-pass2" type="password" value={f.confirmacion} required autoComplete="new-password" onChange={(e) => cambiar('confirmacion', e.target.value)} />
        {errorDe('confirmacion')}
      </div>
      <div className="campo">
        <label htmlFor="sol-msg">Mensaje para el consultorio</label>
        <input id="sol-msg" value={f.mensaje} maxLength={500} placeholder="Ej. Soy paciente de la Dra. García" onChange={(e) => cambiar('mensaje', e.target.value)} />
      </div>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <button className="boton boton--primario login__boton" type="submit" disabled={enviando}>
        <Send aria-hidden="true" /> {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
      <button type="button" className="boton boton--fantasma login__boton" onClick={onVolver}>
        <ArrowLeft aria-hidden="true" /> Ya tengo cuenta
      </button>
    </form>
  );
}

export default SolicitarAcceso;
