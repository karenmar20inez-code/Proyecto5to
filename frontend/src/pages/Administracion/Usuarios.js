import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, Pencil, Power, KeyRound, Copy, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import TablaDatos from '../../components/ui/TablaDatos';
import { usuariosApi, consultoriosApi, pacientesApi } from '../../services/api';
import { useAuth, NOMBRES_ROL, NIVELES_ADMINISTRATIVO, nombreRolCompleto } from '../../context/AuthContext';

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca');

/* Roles cuyo trabajo se organiza por consultorio */
const CON_CONSULTORIO = ['administrador', 'nutriologo', 'docente', 'administrativo'];

/* Contraseña temporal segura (se pedirá cambiarla al primer ingreso) */
function generarContrasena() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const todos = letras + numeros;
  const azar = (conjunto) => conjunto[crypto.getRandomValues(new Uint32Array(1))[0] % conjunto.length];
  const base = Array.from({ length: 10 }, () => azar(todos));
  return `${base.join('')}${azar(numeros)}${azar(letras)}`;
}

const VACIO = {
  nombre: '', correo: '', telefono: '', rol: '', nivel: 'recepcion', consultorioId: '', cedulaProfesional: '',
  especialidad: '', pacienteId: '', responsableId: '', activo: true, permisosExtra: [], permisosRevocados: [], contrasenaTemporal: '',
};

/* ---------- Formulario de alta / edición ---------- */
function FormularioUsuario({ inicial, catalogo, consultorios, pacientes, profesionales, ocupados, ambito, onGuardar, onCerrar }) {
  const editando = !!inicial?._id;
  const { usuario: yo } = useAuth();
  const puedeTransferir = yo?.rol === 'superusuario';
  const [f, setF] = useState(() => (inicial ? { ...VACIO, ...inicial, consultorioId: inicial.consultorioId || '', nivel: inicial.nivel || 'recepcion' } : VACIO));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  // Los pacientes no se registran aquí: se dan de alta en Pacientes (y desde ahí se les da acceso al portal)
  const roles = catalogo.roles.filter((r) => (r.asignable && r.clave !== 'paciente') || r.clave === inicial?.rol);
  const rol = catalogo.roles.find((r) => r.clave === f.rol);
  const permisosBase = useMemo(() => {
    if (!rol) return [];
    const nivel = rol.niveles?.find((n) => n.clave === f.nivel);
    return [...new Set([...rol.permisos, ...(nivel?.permisos || [])])].filter((p) => p !== '*');
  }, [rol, f.nivel]);
  const descripcion = (clave) => catalogo.permisos.find((p) => p.clave === clave)?.descripcion || clave;
  const adicionales = catalogo.concedibles.filter((p) => !permisosBase.includes(p));

  /* Pacientes elegibles: sin cuenta (o el suyo al editar) */
  const elegibles = pacientes.filter((p) => !ocupados.has(String(p._id)) || String(p._id) === String(inicial?.pacienteId));
  const pacienteElegido = pacientes.find((p) => String(p._id) === String(f.pacienteId));

  const cambiar = (campo, valor) => {
    setF((x) => {
      const sig = { ...x, [campo]: valor };
      if (campo === 'rol') { sig.permisosExtra = []; sig.permisosRevocados = []; }
      if (campo === 'pacienteId') {
        const p = pacientes.find((y) => String(y._id) === String(valor));
        sig.responsableId = p?.expediente?.responsableId || '';
        if (p && !x.nombre) sig.nombre = p.nombreCompleto;
        if (p && !x.correo && p.correo) sig.correo = p.correo;
      }
      return sig;
    });
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: '' }));
  };
  const alternarPermiso = (lista, clave) => setF((x) => ({
    ...x, [lista]: x[lista].includes(clave) ? x[lista].filter((p) => p !== clave) : [...x[lista], clave],
  }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(''); setErrores({});
    const datos = {
      nombre: f.nombre, correo: f.correo, telefono: f.telefono, rol: f.rol,
      ...(f.rol === 'administrativo' && { nivel: f.nivel }),
      ...(CON_CONSULTORIO.includes(f.rol) && !ambito && { consultorioId: f.consultorioId }),
      ...(f.rol === 'nutriologo' && { cedulaProfesional: f.cedulaProfesional, especialidad: f.especialidad }),
      ...(f.rol === 'paciente' && { pacienteId: f.pacienteId, responsableId: f.responsableId || undefined }),
      permisosExtra: f.permisosExtra.filter((p) => adicionales.includes(p)),
      permisosRevocados: f.permisosRevocados.filter((p) => permisosBase.includes(p)),
      activo: f.activo,
      ...(!editando && { contrasenaTemporal: f.contrasenaTemporal }),
    };
    try {
      await onGuardar(datos);
    } catch (err) {
      setError(err.message);
      setErrores(err.errores || {});
    } finally {
      setGuardando(false);
    }
  };

  const errorDe = (c) => (errores[c] ? <small className="campo__error">{errores[c]}</small> : null);

  return (
    <form className="formulario formulario-usuario" onSubmit={enviar}>
      <h3 className="formulario-usuario__seccion campo--completo">Datos de la cuenta</h3>
      <div className="campo campo--completo">
        <label htmlFor="u-nombre">Nombre completo *</label>
        <input id="u-nombre" value={f.nombre} required minLength={3} maxLength={120} onChange={(e) => cambiar('nombre', e.target.value)} />
        {errorDe('nombre')}
      </div>
      <div className="campo">
        <label htmlFor="u-correo">Correo electrónico *</label>
        <input id="u-correo" type="email" value={f.correo} required onChange={(e) => cambiar('correo', e.target.value)} />
        <span className="campo__ayuda">Es el usuario con el que inicia sesión.</span>
        {errorDe('correo')}
      </div>
      <div className="campo">
        <label htmlFor="u-tel">Teléfono</label>
        <input id="u-tel" type="tel" value={f.telefono || ''} pattern="[0-9 \(\)+\-]{7,20}" title="7 a 20 caracteres: números, espacios, +, ( ) o -" onChange={(e) => cambiar('telefono', e.target.value)} />
        {errorDe('telefono')}
      </div>

      <h3 className="formulario-usuario__seccion campo--completo">Tipo de usuario y acceso</h3>
      <div className="campo">
        <label htmlFor="u-rol">Rol *</label>
        <select id="u-rol" value={f.rol} required onChange={(e) => cambiar('rol', e.target.value)}>
          <option value="">Elegir…</option>
          {roles.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
        </select>
        {errorDe('rol')}
        {!editando && <span className="campo__ayuda">Para pacientes usa <strong>Pacientes</strong> (registro y "Acceso al portal").</span>}
      </div>
      <div className="campo">
        <label htmlFor="u-estado">Estado de la cuenta</label>
        <select id="u-estado" value={f.activo ? 'activa' : 'inactiva'} onChange={(e) => cambiar('activo', e.target.value === 'activa')}>
          <option value="activa">Activa</option>
          <option value="inactiva">Inactiva (no puede iniciar sesión)</option>
        </select>
      </div>
      {rol && <p className="aviso campo--completo formulario-usuario__rol">{rol.descripcion}</p>}

      {f.rol === 'administrativo' && (
        <div className="campo">
          <label htmlFor="u-nivel">Nivel administrativo *</label>
          <select id="u-nivel" value={f.nivel} onChange={(e) => cambiar('nivel', e.target.value)}>
            {rol.niveles.map((n) => <option key={n.clave} value={n.clave}>{n.nombre}</option>)}
          </select>
        </div>
      )}
      {CON_CONSULTORIO.includes(f.rol) && (
        <div className="campo">
          <label htmlFor="u-cons">Consultorio</label>
          <select id="u-cons" value={ambito || f.consultorioId} disabled={!!ambito} onChange={(e) => cambiar('consultorioId', e.target.value)}>
            {!ambito && <option value="">Sin consultorio (ámbito general)</option>}
            {consultorios.filter((c) => c.activo || String(c._id) === String(f.consultorioId)).map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}
          </select>
          {ambito && <span className="campo__ayuda">Solo puedes registrar personal de tu consultorio.</span>}
          {errorDe('consultorioId')}
        </div>
      )}

      {f.rol === 'nutriologo' && (
        <>
          <h3 className="formulario-usuario__seccion campo--completo">Datos profesionales</h3>
          <div className="campo">
            <label htmlFor="u-ced">Cédula profesional</label>
            <input id="u-ced" value={f.cedulaProfesional || ''} maxLength={20} onChange={(e) => cambiar('cedulaProfesional', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-esp">Especialidad</label>
            <input id="u-esp" value={f.especialidad || ''} maxLength={120} placeholder="Ej. Nutrición clínica" onChange={(e) => cambiar('especialidad', e.target.value)} />
          </div>
        </>
      )}

      {f.rol === 'paciente' && (
        <>
          <h3 className="formulario-usuario__seccion campo--completo">Paciente</h3>
          <div className="campo">
            <label htmlFor="u-pac">Paciente *</label>
            <select id="u-pac" value={f.pacienteId} required disabled={editando} onChange={(e) => cambiar('pacienteId', e.target.value)}>
              <option value="">Elegir…</option>
              {elegibles.map((p) => <option key={p._id} value={p._id}>{p.nombreCompleto}{p.expediente?.folio ? ` · ${p.expediente.folio}` : ''}</option>)}
            </select>
            <span className="campo__ayuda">Solo verá su propia información. Un paciente tiene una sola cuenta.</span>
            {errorDe('pacienteId')}
          </div>
          <div className="campo">
            <label htmlFor="u-resp">Nutriólogo responsable</label>
            <select id="u-resp" value={f.responsableId || ''} onChange={(e) => cambiar('responsableId', e.target.value)} disabled={!f.pacienteId || !puedeTransferir}>
              <option value="">{pacienteElegido ? 'Sin cambio' : 'Elige primero el paciente'}</option>
              {profesionales.map((n) => <option key={n._id} value={n._id}>{n.nombre}</option>)}
            </select>
            <span className="campo__ayuda">{puedeTransferir ? 'Cambiarlo transfiere el acceso a su expediente clínico.' : 'Es el responsable de su expediente. Solo el superusuario o el propio nutriólogo (desde el expediente) puede transferirlo.'}</span>
            {errorDe('responsableId')}
          </div>
        </>
      )}

      {rol && rol.clave !== 'paciente' && (
        <details className="formulario-usuario__permisos campo--completo">
          <summary>Permisos específicos de esta cuenta (opcional)</summary>
          <p className="campo__ayuda">El rol ya incluye los permisos marcados como base. Puedes retirar alguno o, si tú lo tienes, conceder uno adicional.</p>
          <div className="permisos-lista">
            {permisosBase.map((p) => (
              <label key={p} className="casilla">
                <input type="checkbox" checked={!f.permisosRevocados.includes(p)} onChange={() => alternarPermiso('permisosRevocados', p)} />
                <span>{descripcion(p)} <span className="insignia">del rol</span></span>
              </label>
            ))}
            {adicionales.map((p) => (
              <label key={p} className="casilla">
                <input type="checkbox" checked={f.permisosExtra.includes(p)} onChange={() => alternarPermiso('permisosExtra', p)} />
                <span>{descripcion(p)} <span className="insignia insignia--info">adicional</span></span>
              </label>
            ))}
          </div>
          {errorDe('permisosExtra')}
        </details>
      )}

      {!editando && (
        <div className="campo campo--completo">
          <label htmlFor="u-pass">Contraseña temporal *</label>
          <div className="formulario-usuario__clave">
            <input id="u-pass" type={verClave ? 'text' : 'password'} autoComplete="new-password" value={f.contrasenaTemporal} required minLength={10}
              onChange={(e) => cambiar('contrasenaTemporal', e.target.value)} />
            <button type="button" className="boton boton--secundario" onClick={() => { cambiar('contrasenaTemporal', generarContrasena()); setVerClave(true); }}>
              <KeyRound aria-hidden="true" /> Generar
            </button>
            {verClave && f.contrasenaTemporal && (
              <button type="button" className="boton boton--secundario boton--icono" title="Copiar" aria-label="Copiar contraseña"
                onClick={() => navigator.clipboard?.writeText(f.contrasenaTemporal)}>
                <Copy aria-hidden="true" />
              </button>
            )}
          </div>
          <span className="campo__ayuda">Mínimo 10 caracteres con letras y números. Se guarda cifrada (hash) y se pedirá cambiarla al primer ingreso. Entrégala por un medio seguro.</span>
          {errorDe('contrasenaTemporal')}
        </div>
      )}

      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="boton boton--primario" disabled={guardando || !f.rol}>
          <UserPlus aria-hidden="true" /> {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cuenta'}
        </button>
      </div>
    </form>
  );
}

/* ---------- Listado y gestión ---------- */
function Usuarios() {
  const { usuario: yo, puede } = useAuth();
  const [lista, setLista] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [consultorios, setConsultorios] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroConsultorio, setFiltroConsultorio] = useState('');
  const [editor, setEditor] = useState(null); // null | { inicial }
  const [claveDe, setClaveDe] = useState(null); // cuenta a la que se asigna nueva contraseña
  const [nuevaClave, setNuevaClave] = useState({ valor: '', exigirCambio: true, ver: false, error: '' });
  const [eliminando, setEliminando] = useState(null); // cuenta por eliminar
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const ambito = yo.rol !== 'superusuario' && yo.consultorioId ? String(yo.consultorioId) : '';

  const cargar = useCallback(() => {
    const params = { rol: filtroRol || undefined, activo: filtroEstado || undefined, consultorioId: filtroConsultorio || undefined };
    return usuariosApi.listar(params).then(setLista).catch((e) => { setError(e.message); setLista([]); });
  }, [filtroRol, filtroEstado, filtroConsultorio]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    usuariosApi.roles().then(setCatalogo).catch((e) => setError(e.message));
    consultoriosApi.listar().then(setConsultorios).catch(() => {});
    usuariosApi.profesionales().then(setProfesionales).catch(() => {});
    if (puede('pacientes:leer')) pacientesApi.listar().then(setPacientes).catch(() => {});
  }, [puede]);

  const nivelRol = (clave) => catalogo?.roles.find((r) => r.clave === clave)?.nivel ?? (clave === 'asistente' ? 30 : 0);
  const gestionable = (u) => String(u._id) !== String(yo._id) && nivelRol(u.rol) < nivelRol(yo.rol);
  const nombreConsultorio = (id) => consultorios.find((c) => String(c._id) === String(id))?.nombre;
  const nombreProfesional = (id) => profesionales.find((n) => String(n._id) === String(id))?.nombre;
  const ocupados = useMemo(() => new Set((lista || []).filter((u) => u.pacienteId).map((u) => String(u.pacienteId))), [lista]);

  const mostrarAviso = (t) => { setAviso(t); setTimeout(() => setAviso(''), 3500); };

  const guardar = async (datos) => {
    if (editor.inicial?._id) {
      await usuariosApi.actualizar(editor.inicial._id, datos);
      mostrarAviso('Cuenta actualizada. Si cambiaron sus permisos, deberá iniciar sesión de nuevo.');
    } else {
      await usuariosApi.crear(datos);
      mostrarAviso('Cuenta creada. Comparte la contraseña temporal por un medio seguro.');
    }
    setEditor(null);
    cargar();
  };

  const alternar = async (u) => {
    if (!window.confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} la cuenta de ${u.nombre}?${u.activo ? ' Se cerrarán sus sesiones y no podrá iniciar sesión.' : ''}`)) return;
    try {
      await usuariosApi.actualizar(u._id, { activo: !u.activo });
      mostrarAviso(u.activo ? 'Cuenta desactivada.' : 'Cuenta activada.');
      cargar();
    } catch (err) { setError(err.message); }
  };

  const asignarClave = async (e) => {
    e.preventDefault();
    try {
      const r = await usuariosApi.cambiarContrasena(claveDe._id, nuevaClave.valor, nuevaClave.exigirCambio);
      setClaveDe(null);
      mostrarAviso(`${r.mensaje} Compártela con ${claveDe.nombre} por un medio seguro.`);
    } catch (err) { setNuevaClave((x) => ({ ...x, error: err.message })); }
  };

  const confirmarEliminar = async () => {
    try {
      const r = await usuariosApi.eliminar(eliminando._id);
      setEliminando(null);
      mostrarAviso(r.mensaje);
      cargar();
    } catch (err) { setEliminando(null); setError(err.message); }
  };

  const columnas = [
    {
      clave: 'nombre', titulo: 'Nombre', render: (u) => (
        <span>
          <span className="celda-fuerte">{u.nombre}</span>{String(u._id) === String(yo._id) && <span className="insignia" style={{ marginLeft: 6 }}>Tú</span>}
          {u.cedulaProfesional && <small className="campo__ayuda" style={{ display: 'block' }}>Céd. {u.cedulaProfesional}{u.especialidad ? ` · ${u.especialidad}` : ''}</small>}
          {u.rol === 'paciente' && u.responsableId && <small className="campo__ayuda" style={{ display: 'block' }}>Responsable: {nombreProfesional(u.responsableId) || '—'}</small>}
        </span>
      ),
    },
    { clave: 'correo', titulo: 'Correo' },
    { clave: 'telefono', titulo: 'Teléfono', valor: (u) => u.telefono || '—' },
    { clave: 'rol', titulo: 'Rol', valor: (u) => nombreRolCompleto(u), render: (u) => <span className={`insignia insignia--rol-${u.rol}`}>{nombreRolCompleto(u)}</span> },
    { clave: 'consultorio', titulo: 'Consultorio', valor: (u) => nombreConsultorio(u.consultorioId) || (u.rol === 'paciente' || u.rol === 'superusuario' ? '—' : 'General') },
    { clave: 'activo', titulo: 'Estado', valor: (u) => (u.activo ? 'Activa' : 'Inactiva'), render: (u) => <span className={`insignia insignia--${u.activo ? 'ok' : 'no'}`}>{u.activo ? 'Activa' : 'Inactiva'}</span> },
    { clave: 'createdAt', titulo: 'Creación', valor: (u) => u.createdAt, render: (u) => fecha(u.createdAt) },
    { clave: 'ultimoAcceso', titulo: 'Último acceso', valor: (u) => u.ultimoAcceso, render: (u) => fechaHora(u.ultimoAcceso) },
    {
      clave: 'acciones', titulo: '', ordenable: false, render: (u) => (gestionable(u) ? (
        <span className="tabla-acciones">
          {puede('usuarios:editar') && (
            <button className="boton boton--secundario boton--chico" onClick={(e) => { e.stopPropagation(); setEditor({ inicial: u }); }} aria-label={`Editar ${u.nombre}`} title="Editar">
              <Pencil aria-hidden="true" />
            </button>
          )}
          {puede('usuarios:estado') && (
            <button className={`boton boton--${u.activo ? 'peligro' : 'secundario'} boton--chico`} onClick={(e) => { e.stopPropagation(); alternar(u); }}
              aria-label={`${u.activo ? 'Desactivar' : 'Activar'} ${u.nombre}`} title={u.activo ? 'Desactivar' : 'Activar'}>
              <Power aria-hidden="true" />
            </button>
          )}
          {puede('usuarios:contrasena') && (
            <button className="boton boton--secundario boton--chico" onClick={(e) => { e.stopPropagation(); setNuevaClave({ valor: '', exigirCambio: true, ver: false, error: '' }); setClaveDe(u); }}
              aria-label={`Cambiar la contraseña de ${u.nombre}`} title="Cambiar contraseña">
              <KeyRound aria-hidden="true" />
            </button>
          )}
          {puede('usuarios:eliminar') && (
            <button className="boton boton--peligro boton--chico" onClick={(e) => { e.stopPropagation(); setError(''); setEliminando(u); }}
              aria-label={`Eliminar la cuenta de ${u.nombre}`} title="Eliminar cuenta">
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </span>
      ) : null),
    },
  ];

  const total = (lista || []).length;
  const activos = (lista || []).filter((u) => u.activo).length;

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Usuarios y roles</h2>
          <p className="panel-descripcion">
            {total} cuentas · {activos} activas. Solo ves y gestionas cuentas de nivel inferior al tuyo{ambito ? ` de ${nombreConsultorio(ambito) || 'tu consultorio'}` : ''}; nadie puede modificar su propio rol.
          </p>
        </div>
        {puede('usuarios:crear') && catalogo && (
          <button className="boton boton--primario" onClick={() => setEditor({ inicial: null })} aria-haspopup="dialog">
            <UserPlus aria-hidden="true" /> Registrar usuario
          </button>
        )}
      </div>
      {aviso && <p className="aviso aviso--ok" role="status">{aviso}</p>}
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}

      <TablaDatos columnas={columnas} filas={lista || []} cargando={!lista} etiqueta="Usuarios" placeholder="Buscar por nombre, correo o rol…"
        ordenInicial={{ clave: 'nombre', dir: 'asc' }} vacio="No hay cuentas con esos filtros."
        filtros={(
          <>
            <select className="selector" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} aria-label="Filtrar por rol">
              <option value="">Todos los roles</option>
              {(catalogo?.roles || []).map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
            </select>
            <select className="selector" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Activas e inactivas</option>
              <option value="true">Solo activas</option>
              <option value="false">Solo inactivas</option>
            </select>
            {consultorios.length > 0 && !ambito && (
              <select className="selector" value={filtroConsultorio} onChange={(e) => setFiltroConsultorio(e.target.value)} aria-label="Filtrar por consultorio">
                <option value="">Todos los consultorios</option>
                {consultorios.map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              </select>
            )}
          </>
        )} />

      <Modal abierto={!!editor} titulo={editor?.inicial ? `Editar cuenta de ${editor.inicial.nombre}` : 'Registrar usuario'}
        descripcion={editor?.inicial ? `${NOMBRES_ROL[editor.inicial.rol]}${editor.inicial.nivel ? ` · ${NIVELES_ADMINISTRATIVO[editor.inicial.nivel]}` : ''} · creada el ${fecha(editor.inicial.createdAt)}` : 'Los campos con * son obligatorios. Los campos adicionales cambian según el rol.'}
        onCerrar={() => setEditor(null)} cerrarAlFondo={false} ancho={760}>
        {editor && catalogo && (
          <FormularioUsuario inicial={editor.inicial} catalogo={catalogo} consultorios={consultorios} pacientes={pacientes}
            profesionales={profesionales} ocupados={ocupados} ambito={ambito} onGuardar={guardar} onCerrar={() => setEditor(null)} />
        )}
      </Modal>

      {/* Nueva contraseña (solo superusuario) */}
      <Modal abierto={!!claveDe} titulo={`Cambiar la contraseña de ${claveDe?.nombre || ''}`}
        descripcion="Se cerrarán sus sesiones abiertas. Entrégale la nueva contraseña por un medio seguro." onCerrar={() => setClaveDe(null)} cerrarAlFondo={false}>
        <form className="formulario" onSubmit={asignarClave}>
          <div className="campo campo--completo">
            <label htmlFor="nc-clave">Nueva contraseña *</label>
            <div className="formulario-usuario__clave">
              <input id="nc-clave" type={nuevaClave.ver ? 'text' : 'password'} autoComplete="new-password" value={nuevaClave.valor} required minLength={10}
                onChange={(e) => setNuevaClave({ ...nuevaClave, valor: e.target.value, error: '' })} />
              <button type="button" className="boton boton--secundario" onClick={() => setNuevaClave({ ...nuevaClave, valor: generarContrasena(), ver: true, error: '' })}>
                <KeyRound aria-hidden="true" /> Generar
              </button>
              {nuevaClave.ver && nuevaClave.valor && (
                <button type="button" className="boton boton--secundario boton--icono" title="Copiar" aria-label="Copiar contraseña" onClick={() => navigator.clipboard?.writeText(nuevaClave.valor)}>
                  <Copy aria-hidden="true" />
                </button>
              )}
            </div>
            <span className="campo__ayuda">Mínimo 10 caracteres con letras y números. Se guarda cifrada (hash).</span>
          </div>
          <label className="casilla campo--completo">
            <input type="checkbox" checked={nuevaClave.exigirCambio} onChange={(e) => setNuevaClave({ ...nuevaClave, exigirCambio: e.target.checked })} />
            Pedirle que la cambie al iniciar sesión (recomendado)
          </label>
          {nuevaClave.error && <p className="aviso aviso--error campo--completo" role="alert">{nuevaClave.error}</p>}
          <div className="formulario-acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setClaveDe(null)}>Cancelar</button>
            <button type="submit" className="boton boton--primario"><KeyRound aria-hidden="true" /> Guardar contraseña</button>
          </div>
        </form>
      </Modal>

      {/* Eliminar cuenta (solo superusuario) */}
      <Modal abierto={!!eliminando} titulo={`¿Eliminar la cuenta de ${eliminando?.nombre || ''}?`} onCerrar={() => setEliminando(null)}
        acciones={(
          <>
            <button type="button" className="boton boton--secundario" onClick={() => setEliminando(null)}>Cancelar</button>
            <button type="button" className="boton boton--peligro" onClick={confirmarEliminar}><Trash2 aria-hidden="true" /> Eliminar definitivamente</button>
          </>
        )}>
        <p>La cuenta dejará de existir: no podrá iniciar sesión, desaparecerá de las listas y su correo <strong>{eliminando?.correo}</strong> quedará libre.</p>
        <p className="aviso" style={{ marginTop: 'var(--e3)' }}>
          Si hizo registros clínicos o aparece en la auditoría, su nombre se conservará como autor de esos registros.
          Si es responsable de expedientes, primero transfiérelos a otro nutriólogo. Si solo quieres impedir el acceso de forma temporal, usa «Desactivar».
        </p>
      </Modal>
    </section>
  );
}

export default Usuarios;
