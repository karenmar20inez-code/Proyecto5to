import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, UserCheck } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import TablaDatos from '../../components/ui/TablaDatos';
import { solicitudesApi, usuariosApi, consultoriosApi, pacientesApi } from '../../services/api';
import { useAuth, NOMBRES_ROL } from '../../context/AuthContext';

const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const ESTADOS = { pendiente: ['Pendiente', 'aviso'], aprobada: ['Aprobada', 'ok'], rechazada: ['Rechazada', 'no'] };
const CON_CONSULTORIO = ['nutriologo', 'docente', 'administrativo'];

/* Aprobar: quien revisa decide el rol definitivo (de nivel inferior al suyo), consultorio y, si es paciente, a qué paciente se liga */
function FormularioAprobar({ solicitud, catalogo, consultorios, pacientes, profesionales, ocupados, ambito, onAprobar, onCerrar }) {
  const [f, setF] = useState({
    rol: solicitud.rolSolicitado, nivel: 'recepcion', consultorioId: ambito || '', cedulaProfesional: solicitud.cedulaProfesional || '',
    especialidad: '', pacienteId: '', responsableId: '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const roles = catalogo.roles.filter((r) => r.asignable);
  const rol = catalogo.roles.find((r) => r.clave === f.rol);
  // Para pacientes: sugerir a quien coincida con el nombre o correo de la solicitud
  const elegibles = useMemo(() => pacientes.filter((p) => !ocupados.has(String(p._id))), [pacientes, ocupados]);
  const sugerido = elegibles.find((p) => p.correo?.toLowerCase() === solicitud.correo || p.nombreCompleto?.toLowerCase() === solicitud.nombre.toLowerCase());

  const cambiar = (campo, valor) => setF((x) => {
    const sig = { ...x, [campo]: valor };
    if (campo === 'pacienteId') sig.responsableId = '';
    return sig;
  });

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await onAprobar({
        rol: f.rol,
        ...(f.rol === 'administrativo' && { nivel: f.nivel }),
        ...(CON_CONSULTORIO.includes(f.rol) && f.consultorioId && { consultorioId: f.consultorioId }),
        ...(f.rol === 'nutriologo' && { cedulaProfesional: f.cedulaProfesional, especialidad: f.especialidad }),
        ...(f.rol === 'paciente' && { pacienteId: f.pacienteId }),
      });
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <dl className="datos campo--completo">
        <dt>Solicitante</dt><dd>{solicitud.nombre}</dd>
        <dt>Correo</dt><dd>{solicitud.correo}</dd>
        {solicitud.telefono && <><dt>Teléfono</dt><dd>{solicitud.telefono}</dd></>}
        <dt>Pidió acceso como</dt><dd>{NOMBRES_ROL[solicitud.rolSolicitado]}</dd>
        {solicitud.mensaje && <><dt>Mensaje</dt><dd>{solicitud.mensaje}</dd></>}
      </dl>
      <div className="campo">
        <label htmlFor="ap-rol">Rol que se asigna *</label>
        <select id="ap-rol" value={f.rol} required onChange={(e) => cambiar('rol', e.target.value)}>
          {roles.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
        </select>
      </div>
      {f.rol === 'administrativo' && (
        <div className="campo">
          <label htmlFor="ap-nivel">Nivel</label>
          <select id="ap-nivel" value={f.nivel} onChange={(e) => cambiar('nivel', e.target.value)}>
            {rol.niveles.map((n) => <option key={n.clave} value={n.clave}>{n.nombre}</option>)}
          </select>
        </div>
      )}
      {CON_CONSULTORIO.includes(f.rol) && consultorios.length > 0 && (
        <div className="campo">
          <label htmlFor="ap-cons">Consultorio</label>
          <select id="ap-cons" value={ambito || f.consultorioId} disabled={!!ambito} onChange={(e) => cambiar('consultorioId', e.target.value)}>
            {!ambito && <option value="">Sin consultorio (ámbito general)</option>}
            {consultorios.filter((c) => c.activo).map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}
          </select>
        </div>
      )}
      {f.rol === 'nutriologo' && (
        <>
          <div className="campo"><label htmlFor="ap-ced">Cédula profesional</label>
            <input id="ap-ced" value={f.cedulaProfesional} maxLength={20} onChange={(e) => cambiar('cedulaProfesional', e.target.value)} /></div>
          <div className="campo"><label htmlFor="ap-esp">Especialidad</label>
            <input id="ap-esp" value={f.especialidad} maxLength={120} onChange={(e) => cambiar('especialidad', e.target.value)} /></div>
        </>
      )}
      {f.rol === 'paciente' && (
        <div className="campo campo--completo">
          <label htmlFor="ap-pac">Paciente al que se liga la cuenta *</label>
          <select id="ap-pac" value={f.pacienteId} required onChange={(e) => cambiar('pacienteId', e.target.value)}>
            <option value="">Elegir…</option>
            {sugerido && <option value={sugerido._id}>★ {sugerido.nombreCompleto} (coincide con la solicitud)</option>}
            {elegibles.filter((p) => p !== sugerido).map((p) => <option key={p._id} value={p._id}>{p.nombreCompleto}{p.expediente?.folio ? ` · ${p.expediente.folio}` : ''}</option>)}
          </select>
          <span className="campo__ayuda">
            Si aún no está registrado, regístralo primero en Pacientes. Verá solo su información y lo que su nutriólogo autorice
            {f.pacienteId && profesionales.length ? ` (responsable: ${profesionales.find((n) => String(n._id) === String(pacientes.find((p) => String(p._id) === f.pacienteId)?.expediente?.responsableId))?.nombre || '—'})` : ''}.
          </span>
        </div>
      )}
      <p className="aviso campo--completo">La persona entrará con el correo y la contraseña que eligió al solicitar el acceso.</p>
      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="boton boton--primario" disabled={guardando}><UserCheck aria-hidden="true" /> {guardando ? 'Aprobando…' : 'Aprobar y crear cuenta'}</button>
      </div>
    </form>
  );
}

function Solicitudes({ onCambio }) {
  const { usuario: yo, puede } = useAuth();
  const [estado, setEstado] = useState('pendiente');
  const [lista, setLista] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [consultorios, setConsultorios] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [ocupados, setOcupados] = useState(new Set());
  const [aprobando, setAprobando] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const ambito = yo.rol !== 'superusuario' && yo.consultorioId ? String(yo.consultorioId) : '';

  const cargar = useCallback(() => {
    setLista(null);
    solicitudesApi.listar({ estado: estado || undefined }).then(setLista).catch((e) => { setError(e.message); setLista([]); });
  }, [estado]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    usuariosApi.roles().then(setCatalogo).catch(() => {});
    consultoriosApi.listar().then(setConsultorios).catch(() => {});
    usuariosApi.profesionales().then(setProfesionales).catch(() => {});
    if (puede('pacientes:leer')) pacientesApi.listar().then(setPacientes).catch(() => {});
    usuariosApi.listar({ rol: 'paciente' }).then((l) => setOcupados(new Set(l.map((u) => String(u.pacienteId))))).catch(() => {});
  }, [puede]);

  const terminar = (texto) => { setAviso(texto); setTimeout(() => setAviso(''), 4000); setAprobando(null); setRechazando(null); setMotivo(''); cargar(); onCambio?.(); };
  const aprobar = async (datos) => { await solicitudesApi.aprobar(aprobando._id, datos); terminar(`Cuenta creada para ${aprobando.nombre}. Ya puede iniciar sesión.`); };
  const rechazar = async (e) => {
    e.preventDefault();
    try { await solicitudesApi.rechazar(rechazando._id, motivo); terminar('Solicitud rechazada.'); } catch (err) { setError(err.message); }
  };

  const columnas = [
    { clave: 'nombre', titulo: 'Solicitante', render: (s) => (
      <span><span className="celda-fuerte">{s.nombre}</span>
        {s.mensaje && <small className="campo__ayuda" style={{ display: 'block' }}>“{s.mensaje}”</small>}</span>
    ) },
    { clave: 'correo', titulo: 'Correo' },
    { clave: 'telefono', titulo: 'Teléfono', valor: (s) => s.telefono || '—' },
    { clave: 'rolSolicitado', titulo: 'Pidió acceso como', valor: (s) => NOMBRES_ROL[s.rolSolicitado], render: (s) => (
      <span>{NOMBRES_ROL[s.rolSolicitado]}{s.cedulaProfesional && <small className="campo__ayuda" style={{ display: 'block' }}>Céd. {s.cedulaProfesional}</small>}</span>
    ) },
    { clave: 'createdAt', titulo: 'Fecha', valor: (s) => s.createdAt, render: (s) => fechaHora(s.createdAt) },
    { clave: 'estado', titulo: 'Estado', valor: (s) => ESTADOS[s.estado][0], render: (s) => (
      <span>
        <span className={`insignia insignia--${ESTADOS[s.estado][1]}`}>{ESTADOS[s.estado][0]}</span>
        {s.revisadoPorNombre && <small className="campo__ayuda" style={{ display: 'block' }}>por {s.revisadoPorNombre}{s.motivoRechazo ? ` · ${s.motivoRechazo}` : ''}</small>}
      </span>
    ) },
    { clave: 'acciones', titulo: '', ordenable: false, render: (s) => (s.estado === 'pendiente' ? (
      <span className="tabla-acciones">
        <button className="boton boton--primario boton--chico" onClick={() => setAprobando(s)} aria-label={`Aprobar a ${s.nombre}`} title="Aprobar"><Check aria-hidden="true" /> Aprobar</button>
        <button className="boton boton--peligro boton--chico" onClick={() => { setMotivo(''); setRechazando(s); }} aria-label={`Rechazar a ${s.nombre}`} title="Rechazar"><X aria-hidden="true" /></button>
      </span>
    ) : null) },
  ];

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Solicitudes de acceso</h2>
          <p className="panel-descripcion">Personas que pidieron una cuenta desde la pantalla de inicio de sesión. Nadie entra hasta que apruebes su solicitud y le asignes un rol.</p>
        </div>
      </div>
      {aviso && <p className="aviso aviso--ok" role="status">{aviso}</p>}
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <TablaDatos columnas={columnas} filas={lista || []} cargando={!lista} etiqueta="Solicitudes de acceso" placeholder="Buscar por nombre o correo…"
        vacio={estado === 'pendiente' ? 'No hay solicitudes pendientes.' : 'Sin solicitudes.'}
        filtros={(
          <select className="selector" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado de la solicitud">
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="">Todas</option>
          </select>
        )} />

      <Modal abierto={!!aprobando} titulo={`Aprobar a ${aprobando?.nombre || ''}`} descripcion="Revisa el rol antes de crear la cuenta." onCerrar={() => setAprobando(null)} cerrarAlFondo={false} ancho={640}>
        {aprobando && catalogo && (
          <FormularioAprobar solicitud={aprobando} catalogo={catalogo} consultorios={consultorios} pacientes={pacientes}
            profesionales={profesionales} ocupados={ocupados} ambito={ambito} onAprobar={aprobar} onCerrar={() => setAprobando(null)} />
        )}
      </Modal>
      <Modal abierto={!!rechazando} titulo={`Rechazar la solicitud de ${rechazando?.nombre || ''}`} onCerrar={() => setRechazando(null)}>
        <form className="formulario" onSubmit={rechazar}>
          <div className="campo campo--completo">
            <label htmlFor="rz-motivo">Motivo (opcional, lo verá la persona al intentar entrar)</label>
            <input id="rz-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. No es personal del consultorio" />
          </div>
          <div className="formulario-acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setRechazando(null)}>Cancelar</button>
            <button type="submit" className="boton boton--peligro"><X aria-hidden="true" /> Rechazar</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

export default Solicitudes;
