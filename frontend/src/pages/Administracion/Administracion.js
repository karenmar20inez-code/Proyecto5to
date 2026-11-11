import { useCallback, useEffect, useState } from 'react';
import { UserPlus, ShieldCheck, Database, Bell, ScrollText } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/ui/Modal';
import TablaDatos from '../../components/ui/TablaDatos';
import { usuariosApi, alertasApi, auditoriaApi, catalogosApi, laboratorioApi } from '../../services/api';
import { NOMBRES_ROL, useAuth } from '../../context/AuthContext';

const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const SECCIONES = [['usuarios', 'Usuarios y roles', UserPlus], ['reglas', 'Reglas de alerta', Bell], ['auditoria', 'Auditoría', ScrollText], ['catalogos', 'Catálogos', Database], ['cumplimiento', 'Seguridad y cumplimiento', ShieldCheck]];

/* ---------- Usuarios ---------- */
function Usuarios() {
  const { usuario: yo } = useAuth();
  const [lista, setLista] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => usuariosApi.listar().then(setLista).catch((e) => { setError(e.message); setLista([]); }), []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (e) => {
    e.preventDefault();
    try { await usuariosApi.crear(nuevo); setNuevo(null); cargar(); } catch (err) { setError(err.message); }
  };
  const alternar = async (u) => {
    if (!window.confirm(`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}? ${u.activo ? 'Se cerrarán sus sesiones.' : ''}`)) return;
    await usuariosApi.actualizar(u._id, { activo: !u.activo }).catch((err) => window.alert(err.message));
    cargar();
  };
  const columnas = [
    { clave: 'nombre', titulo: 'Nombre', render: (u) => <span className="celda-fuerte">{u.nombre}</span> },
    { clave: 'correo', titulo: 'Correo' },
    { clave: 'rol', titulo: 'Rol', valor: (u) => NOMBRES_ROL[u.rol] },
    { clave: 'cedulaProfesional', titulo: 'Cédula' },
    { clave: 'ultimoAcceso', titulo: 'Último acceso', valor: (u) => u.ultimoAcceso, render: (u) => fechaHora(u.ultimoAcceso) },
    { clave: 'activo', titulo: 'Estado', valor: (u) => (u.activo ? 'Activo' : 'Inactivo'), render: (u) => (
      <span className="encabezado-acciones">
        <span className={`insignia insignia--${u.activo ? 'ok' : ''}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
        {String(u._id) !== String(yo._id) && <button className="boton boton--fantasma boton--chico" onClick={() => alternar(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>}
      </span>
    ) },
  ];
  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div><h2>Usuarios y roles</h2><p className="panel-descripcion">Administración: todo. Nutriología: sus expedientes. Asistente: identificación y agenda, sin información clínica.</p></div>
        <button className="boton boton--primario" onClick={() => setNuevo({ nombre: '', correo: '', rol: 'nutriologo', cedulaProfesional: '', contrasenaTemporal: '' })}><UserPlus aria-hidden="true" /> Nuevo usuario</button>
      </div>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <TablaDatos columnas={columnas} filas={lista || []} cargando={!lista} etiqueta="Usuarios" />
      <Modal abierto={!!nuevo} titulo="Nuevo usuario" onCerrar={() => setNuevo(null)}>
        {nuevo && (
          <form className="formulario" onSubmit={crear}>
            <div className="campo campo--completo"><label htmlFor="u-nombre">Nombre completo</label><input id="u-nombre" value={nuevo.nombre} required onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></div>
            <div className="campo campo--completo"><label htmlFor="u-correo">Correo</label><input id="u-correo" type="email" value={nuevo.correo} required onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} /></div>
            <div className="campo"><label htmlFor="u-rol">Rol</label>
              <select id="u-rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                {Object.entries(NOMBRES_ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="campo"><label htmlFor="u-ced">Cédula profesional</label><input id="u-ced" value={nuevo.cedulaProfesional} onChange={(e) => setNuevo({ ...nuevo, cedulaProfesional: e.target.value })} /></div>
            <div className="campo campo--completo"><label htmlFor="u-pass">Contraseña temporal</label>
              <input id="u-pass" type="password" autoComplete="new-password" value={nuevo.contrasenaTemporal} required minLength={10} onChange={(e) => setNuevo({ ...nuevo, contrasenaTemporal: e.target.value })} />
              <span className="campo__ayuda">Mínimo 10 caracteres con letras y números. Se pedirá cambiarla al ingresar.</span></div>
            <div className="formulario-acciones">
              <button type="button" className="boton boton--secundario" onClick={() => setNuevo(null)}>Cancelar</button>
              <button type="submit" className="boton boton--primario">Crear</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

/* ---------- Reglas de alerta ---------- */
function Reglas() {
  const [datos, setDatos] = useState(null);
  const [editando, setEditando] = useState(null);
  const [analitos, setAnalitos] = useState({});
  const [error, setError] = useState('');
  const cargar = useCallback(() => alertasApi.reglas().then(setDatos).catch((e) => setError(e.message)), []);
  useEffect(() => { cargar(); laboratorioApi.analitos().then(setAnalitos).catch(() => {}); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const parametros = JSON.parse(editando.parametrosTexto || '{}');
      const datosRegla = { nombre: editando.nombre, prioridad: editando.prioridad, activa: editando.activa, parametros, nota: editando.nota };
      if (editando._id) await alertasApi.actualizarRegla(editando._id, datosRegla);
      else await alertasApi.crearRegla({ ...datosRegla, codigo: editando.codigo, tipo: editando.tipo });
      setEditando(null); cargar();
    } catch (err) { setError(err instanceof SyntaxError ? 'Los parámetros deben ser JSON válido' : err.message); }
  };

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div><h2>Reglas de alerta</h2><p className="panel-descripcion">Configurables. Las alertas indican revisión; no generan diagnósticos. Revisa los valores por omisión con criterio clínico.</p></div>
        <button className="boton boton--primario" onClick={() => setEditando({ codigo: '', tipo: 'laboratorio_umbral', nombre: '', prioridad: 'media', activa: true, parametrosTexto: '{ "analito": "trigliceridos", "max": 200 }', nota: '' })}>Nueva regla de umbral</button>
      </div>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <ul className="lista-registros">
        {(datos?.reglas || []).map((r) => (
          <li key={r._id}>
            <div>
              <div className="lista-registros__titulo">{r.nombre} <span className={`insignia insignia--${r.prioridad === 'alta' ? 'peligro' : r.prioridad === 'media' ? 'aviso' : ''}`}>{r.prioridad}</span> {!r.activa && <span className="insignia">Inactiva</span>}</div>
              <div className="lista-registros__meta">{r.codigo} · {datos.tipos[r.tipo]} · parámetros {JSON.stringify(r.parametros)}</div>
              {r.nota && <div className="lista-registros__meta">{r.nota}</div>}
            </div>
            <button className="boton boton--secundario boton--chico" onClick={() => setEditando({ ...r, parametrosTexto: JSON.stringify(r.parametros || {}) })}>Editar</button>
          </li>
        ))}
      </ul>
      <Modal abierto={!!editando} titulo={editando?._id ? 'Editar regla' : 'Nueva regla'} onCerrar={() => setEditando(null)}>
        {editando && (
          <form className="formulario" onSubmit={guardar}>
            {!editando._id && <div className="campo"><label htmlFor="rg-cod">Código</label><input id="rg-cod" value={editando.codigo} required onChange={(e) => setEditando({ ...editando, codigo: e.target.value.toUpperCase() })} /></div>}
            <div className="campo"><label htmlFor="rg-pri">Prioridad</label>
              <select id="rg-pri" value={editando.prioridad} onChange={(e) => setEditando({ ...editando, prioridad: e.target.value })}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></div>
            <div className="campo campo--completo"><label htmlFor="rg-nom">Nombre</label><input id="rg-nom" value={editando.nombre} required onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></div>
            <div className="campo campo--completo"><label htmlFor="rg-par">Parámetros (JSON)</label>
              <input id="rg-par" value={editando.parametrosTexto} onChange={(e) => setEditando({ ...editando, parametrosTexto: e.target.value })} />
              {editando.tipo === 'laboratorio_umbral' && <span className="campo__ayuda">analito: {Object.keys(analitos).slice(0, 8).join(', ')}… · min / max en la unidad del resultado.</span>}</div>
            <div className="campo campo--completo"><label htmlFor="rg-nota">Nota / fuente del criterio</label><input id="rg-nota" value={editando.nota || ''} onChange={(e) => setEditando({ ...editando, nota: e.target.value })} /></div>
            <label className="casilla"><input type="checkbox" checked={editando.activa} onChange={(e) => setEditando({ ...editando, activa: e.target.checked })} /> Activa</label>
            <div className="formulario-acciones">
              <button type="button" className="boton boton--secundario" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit" className="boton boton--primario">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

/* ---------- Auditoría ---------- */
function Auditoria() {
  const [lista, setLista] = useState(null);
  const [accion, setAccion] = useState('');
  useEffect(() => { setLista(null); auditoriaApi.listar({ accion: accion || undefined, limite: 300 }).then(setLista).catch(() => setLista([])); }, [accion]);
  const columnas = [
    { clave: 'fecha', titulo: 'Fecha', valor: (a) => a.fecha, render: (a) => fechaHora(a.fecha) },
    { clave: 'responsable', titulo: 'Usuario', render: (a) => <>{a.responsable} <span className="campo__ayuda">{NOMBRES_ROL[a.rol] || ''}</span></> },
    { clave: 'accion', titulo: 'Acción' },
    { clave: 'entidad', titulo: 'Registro' },
    { clave: 'campos', titulo: 'Campos', valor: (a) => (a.campos || []).join(', ') },
    { clave: 'ip', titulo: 'IP' },
  ];
  return (
    <section className="panel">
      <h2>Bitácora de auditoría</h2>
      <p className="panel-descripcion">Accesos y modificaciones. Por protección de datos solo se registran nombres de campos, nunca valores clínicos.</p>
      <TablaDatos columnas={columnas} filas={lista || []} cargando={!lista} etiqueta="Auditoría" ordenInicial={{ clave: 'fecha', dir: 'desc' }}
        filtros={(
          <select className="selector" value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Acción">
            <option value="">Todas las acciones</option>
            {['acceso', 'consultar', 'crear', 'actualizar', 'firmar', 'adenda', 'anular', 'exportar', 'revisar', 'login', 'login_fallido', 'logout', 'eliminar'].map((a) => <option key={a}>{a}</option>)}
          </select>
        )} />
    </section>
  );
}

/* ---------- Catálogos ---------- */
function Catalogos() {
  const [sistemas, setSistemas] = useState(null);
  useEffect(() => { catalogosApi.sistemas().then(setSistemas).catch(() => setSistemas([])); }, []);
  return (
    <section className="panel">
      <h2>Catálogos autorizados</h2>
      <p className="panel-descripcion">El proyecto no incluye catálogos con licencia o de terceros. Importa la versión oficial (p. ej. CIE-10 de la DGIS) desde un CSV con columnas código y descripción:</p>
      <pre className="aviso" style={{ overflowX: 'auto' }}><code>npm run importar-catalogo --prefix backend -- --sistema CIE-10 --archivo cie10.csv --fuente "DGIS" --version "2024"</code></pre>
      <ul className="lista-registros" style={{ marginTop: 'var(--e4)' }}>
        {(sistemas || []).map((s) => <li key={s.sistema}><span className="lista-registros__titulo">{s.sistema}</span><span className="lista-registros__meta">{s.total} entradas · {s.fuente || '—'} {s.version || ''}</span></li>)}
        {sistemas && !sistemas.length && <li className="campo__ayuda">Ningún catálogo importado. Los diagnósticos y antecedentes se registran como texto libre.</li>}
      </ul>
    </section>
  );
}

/* ---------- Cumplimiento ---------- */
function Cumplimiento() {
  return (
    <section className="panel">
      <h2>Seguridad y cumplimiento</h2>
      <p className="panel-descripcion">Controles implementados. Su suficiencia legal debe validarla un responsable de cumplimiento.</p>
      <ul className="lista-registros">
        <li><span><strong className="celda-fuerte">Conservación (NOM-004-SSA3-2012)</strong><span className="lista-registros__meta" style={{ display: 'block' }}>Los expedientes con información clínica no se eliminan (solo baja). Mínimo 5 años desde el último acto médico; la fecha del último acto se registra en cada expediente.</span></span></li>
        <li><span><strong className="celda-fuerte">Registro electrónico (NOM-024-SSA3-2012)</strong><span className="lista-registros__meta" style={{ display: 'block' }}>Identificación única por folio, control de acceso por rol y expediente, bitácora de auditoría y notas firmadas con huella de integridad. La certificación formal ante la DGIS es un trámite aparte.</span></span></li>
        <li><span><strong className="celda-fuerte">Datos personales sensibles (LFPDPPP, DOF 20/03/2025)</strong><span className="lista-registros__meta" style={{ display: 'block' }}>Registro de consentimiento expreso por paciente, cifrado AES-256-GCM de contacto, notas SOAP y antecedentes, y minimización en documentos para terceros.</span></span></li>
        <li><span><strong className="celda-fuerte">Sesiones</strong><span className="lista-registros__meta" style={{ display: 'block' }}>Expiran a las 12 h o tras 30 min de inactividad; bloqueo temporal tras 5 intentos fallidos.</span></span></li>
        <li><span><strong className="celda-fuerte">Respaldos</strong><span className="lista-registros__meta" style={{ display: 'block' }}>npm run respaldo --prefix backend genera un archivo cifrado en backend/respaldos/. Guarda una copia fuera del equipo y respalda la CLAVE_CIFRADO por separado.</span></span></li>
      </ul>
    </section>
  );
}

function Administracion() {
  const [seccion, setSeccion] = useState('usuarios');
  const Contenido = { usuarios: Usuarios, reglas: Reglas, auditoria: Auditoria, catalogos: Catalogos, cumplimiento: Cumplimiento }[seccion];
  return (
    <Layout titulo="Administración" subtitulo="Usuarios, reglas de alerta, auditoría, catálogos y cumplimiento.">
      <div className="pestanas" role="tablist" aria-label="Secciones de administración">
        {SECCIONES.map(([k, t, Icono]) => (
          <button key={k} role="tab" aria-selected={seccion === k} className={`pestana${seccion === k ? ' pestana--activa' : ''}`} onClick={() => setSeccion(k)}>
            <Icono size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {t}
          </button>
        ))}
      </div>
      <Contenido />
    </Layout>
  );
}

export default Administracion;
