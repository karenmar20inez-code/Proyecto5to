import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle, Filter, MonitorSmartphone } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import { alertasApi, expedienteApi, usuariosApi } from '../../../services/api';
import { formatoFecha } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';

const fecha = (f) => (f ? formatoFecha(String(f).slice(0, 10)) : '—');
const PRIORIDAD = { alta: ['Alta', 'peligro'], media: ['Media', 'aviso'], baja: ['Baja', ''] };

/* ---------- Alertas del paciente ---------- */
function PanelAlertas({ alertas, onCambio }) {
  const { pacienteId } = useFicha();
  const { puede } = useAuth();
  const [revisando, setRevisando] = useState(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');

  const enviar = async () => {
    try {
      await alertasApi.revisar(revisando.alerta._id, revisando.estado, nota);
      setRevisando(null);
      setNota('');
      onCambio();
    } catch (e) { setError(e.message); }
  };

  return (
    <section className="panel" aria-labelledby="t-alertas">
      <div className="panel-encabezado">
        <div>
          <h2 id="t-alertas">Alertas pendientes</h2>
          <p className="panel-descripcion">Señalan información que requiere revisión profesional. No son diagnósticos.</p>
        </div>
      </div>
      {alertas.length === 0 ? (
        <p className="aviso aviso--ok" style={{ margin: 0 }}><CheckCircle2 size={14} aria-hidden="true" /> Sin alertas pendientes.</p>
      ) : alertas.map((a) => (
        <div key={a._id} className={`alerta-item alerta-item--${a.prioridad}`}>
          <AlertTriangle size={18} color={a.prioridad === 'alta' ? 'var(--peligro)' : 'var(--aviso)'} aria-hidden="true" />
          <div>
            <p className="alerta-item__motivo">{a.motivo}</p>
            <p className="alerta-item__meta">
              <span className={`insignia insignia--${PRIORIDAD[a.prioridad][1]}`}>Prioridad {PRIORIDAD[a.prioridad][0]}</span>{' '}
              {fecha(a.fecha)} · Regla {a.codigoRegla}
              {a.origen?.pestana && <> · <Link to={`/pacientes/${pacienteId}/${a.origen.pestana}${a.origen.id ? `?registro=${a.origen.id}` : ''}`}>Ver origen</Link></>}
            </p>
          </div>
          {puede('alertas:revisar') && (
            <div className="alerta-item__acciones">
              <button className="boton boton--secundario boton--chico" onClick={() => setRevisando({ alerta: a, estado: 'revisada' })}><CheckCircle2 aria-hidden="true" /> Revisada</button>
              <button className="boton boton--fantasma boton--chico" onClick={() => setRevisando({ alerta: a, estado: 'descartada' })}><XCircle aria-hidden="true" /> Descartar</button>
            </div>
          )}
        </div>
      ))}

      <Modal abierto={!!revisando} titulo={revisando?.estado === 'revisada' ? 'Marcar alerta como revisada' : 'Descartar alerta'}
        onCerrar={() => setRevisando(null)}
        acciones={<>
          <button className="boton boton--secundario" onClick={() => setRevisando(null)}>Cancelar</button>
          <button className="boton boton--primario" onClick={enviar} disabled={revisando?.estado === 'descartada' && !nota.trim()}>Confirmar</button>
        </>}>
        <p className="panel-descripcion">{revisando?.alerta.motivo}</p>
        <div className="campo">
          <label htmlFor="nota-alerta">Nota de revisión {revisando?.estado === 'descartada' ? '(obligatoria)' : '(opcional)'}</label>
          <textarea id="nota-alerta" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
        </div>
        {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      </Modal>
    </section>
  );
}

/* ---------- Ficha vigente ---------- */
function FichaVigente({ ficha }) {
  const { pacienteId } = useFicha();
  const f = ficha.ficha;
  const lista = (titulo, elementos, render, enlace, vacio) => (
    <div>
      <h3 className="panel-descripcion" style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--texto-2)' }}>{titulo}</h3>
      {elementos.length === 0 ? <p className="campo__ayuda">{vacio}</p> : (
        <ul className="lista-registros">{elementos.map(render)}</ul>
      )}
      {enlace && <Link className="enlace" to={`/pacientes/${pacienteId}/${enlace}`}>Ver y actualizar</Link>}
    </div>
  );

  return (
    <section className="panel" aria-labelledby="t-ficha">
      <h2 id="t-ficha">Ficha clínica vigente</h2>
      <p className="panel-descripcion">Se calcula a partir de los registros activos; cualquier cambio en la historia clínica se refleja aquí.</p>
      <div className="pila">
        {lista('Alergias e intolerancias', f.alergias, (a) => (
          <li key={a._id}><span><span className="lista-registros__titulo">{a.descripcion}</span>
            <span className="lista-registros__meta"> · {a.categoria}{a.detalle?.reaccion ? ` · reacción: ${a.detalle.reaccion}` : ''}</span></span></li>
        ), 'historia', f.alergiasNegadas ? 'El paciente niega alergias.' : 'Sin registro de alergias: verifica con el paciente.')}
        {lista('Medicamentos y suplementos', f.medicamentos, (m) => (
          <li key={m._id}><span><span className="lista-registros__titulo">{m.descripcion}</span>
            <span className="lista-registros__meta"> {[m.detalle?.dosis, m.detalle?.frecuencia].filter(Boolean).join(' · ')}</span></span></li>
        ), 'historia', 'Sin medicamentos activos registrados.')}
        {lista('Enfermedades', f.enfermedades, (e) => (
          <li key={e._id}><span className="lista-registros__titulo">{e.descripcion}</span>{e.codigo?.codigo && <span className="insignia">{e.codigo.codigo}</span>}</li>
        ), null, 'Sin enfermedades activas registradas.')}
        {lista('Diagnósticos nutricionales activos', f.diagnosticos, (d) => (
          <li key={d._id}><span><span className="lista-registros__titulo">{d.problema}</span>
            <span className="lista-registros__meta"> · {fecha(d.fechaDiagnostico)} · {d.profesional}</span></span>
            <span className="insignia insignia--info">{d.estado}</span></li>
        ), 'diagnosticos', 'Sin diagnósticos activos.')}
        {lista('Objetivos activos', f.objetivos, (o) => (
          <li key={o._id} style={{ display: 'block' }}>
            <span className="lista-registros__titulo">{o.descripcion}</span>
            <div className="lista-registros__meta">
              {o.valorActual != null ? `Actual ${o.valorActual} ${o.unidad || ''}` : 'Sin dato actual'} · meta {o.valorMeta ?? '—'} {o.unidad || ''}
              {o.progreso != null && ` · avance ${o.progreso} %`}
            </div>
            {o.progreso != null && <div className="progreso" style={{ marginTop: 6 }} role="progressbar" aria-valuenow={Math.round(Math.max(0, Math.min(100, o.progreso)))} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance de ${o.descripcion}`}>
              <span style={{ width: `${Math.max(0, Math.min(100, o.progreso))}%` }} /></div>}
          </li>
        ), 'objetivos', 'Sin objetivos activos.')}
        <div>
          <h3 className="panel-descripcion" style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--texto-2)' }}>Plan nutricional vigente</h3>
          {f.planVigente ? (
            <p className="lista-registros__titulo">{f.planVigente.nombre} <span className="lista-registros__meta">desde {fecha(f.planVigente.vigencia?.inicio)}{f.planVigente.requerimientos?.kcal ? ` · ${f.planVigente.requerimientos.kcal} kcal/día` : ''}</span></p>
          ) : <p className="campo__ayuda">Sin plan vigente.</p>}
          <Link className="enlace" to={`/pacientes/${pacienteId}/plan`}>Ver plan</Link>
        </div>
        <div>
          <h3 className="panel-descripcion" style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--texto-2)' }}>Consentimientos</h3>
          <p className="campo__ayuda">
            Datos de salud: {f.consentimientos.datosSensibles ? `otorgado ${fecha(f.consentimientos.datosSensibles.fecha)} (v. ${f.consentimientos.datosSensibles.versionDocumento})` : <strong style={{ color: 'var(--aviso)' }}>sin registro</strong>}
            {' · '}Aviso de privacidad: {f.consentimientos.avisoPrivacidad ? `entregado ${fecha(f.consentimientos.avisoPrivacidad.fecha)}` : <strong style={{ color: 'var(--aviso)' }}>sin registro</strong>}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Línea de tiempo ---------- */
function LineaTiempo() {
  const { pacienteId } = useFicha();
  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState({ tipos: '', desde: '', hasta: '', profesionalId: '' });
  const [profesionales, setProfesionales] = useState([]);

  const cargar = useCallback(() => {
    expedienteApi.lineaTiempo(pacienteId, filtro).then(setDatos).catch(() => setDatos({ tipos: {}, eventos: [] }));
  }, [pacienteId, filtro]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { usuariosApi.profesionales().then(setProfesionales).catch(() => {}); }, []);

  return (
    <section className="panel" aria-labelledby="t-linea">
      <h2 id="t-linea">Línea de tiempo clínica</h2>
      <p className="panel-descripcion">Todos los eventos del expediente en orden cronológico. Cada evento abre el registro original.</p>
      <div className="filtros-tabla">
        <Filter size={16} aria-hidden="true" />
        <label className="sr-only" htmlFor="lt-tipo">Tipo de evento</label>
        <select id="lt-tipo" className="selector" value={filtro.tipos} onChange={(e) => setFiltro({ ...filtro, tipos: e.target.value })}>
          <option value="">Todos los eventos</option>
          {Object.entries(datos?.tipos || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="sr-only" htmlFor="lt-prof">Profesional</label>
        <select id="lt-prof" className="selector" value={filtro.profesionalId} onChange={(e) => setFiltro({ ...filtro, profesionalId: e.target.value })}>
          <option value="">Todos los profesionales</option>
          {profesionales.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
        </select>
        <label className="sr-only" htmlFor="lt-desde">Desde</label>
        <input id="lt-desde" type="date" className="selector" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} />
        <label className="sr-only" htmlFor="lt-hasta">Hasta</label>
        <input id="lt-hasta" type="date" className="selector" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} />
      </div>
      {!datos ? <div className="esqueleto" style={{ height: 160 }} /> : datos.eventos.length === 0 ? <p className="vacio">Sin eventos para los filtros elegidos.</p> : (
        <ul className="linea-tiempo">
          {datos.eventos.slice(0, 60).map((e, i) => (
            <li key={`${e.ref?.id}-${i}`} data-tipo={e.tipo}>
              <div className="linea-tiempo__fecha">{fecha(e.fecha)} · {datos.tipos[e.tipo]}{e.profesional ? ` · ${e.profesional}` : ''}</div>
              <div className="linea-tiempo__titulo">{e.titulo}</div>
              {e.detalle && <div className="linea-tiempo__detalle">{e.detalle}</div>}
              {e.ref?.pestana && <Link className="enlace" to={`/pacientes/${pacienteId}/${e.ref.pestana}?registro=${e.ref.id}`}>Abrir registro</Link>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Portal del paciente: qué puede ver el propio paciente ---------- */
const OPCIONES_PORTAL = [
  ['dieta', 'Su dieta asignada'],
  ['recomendaciones', 'Recomendaciones del plan vigente'],
  ['citas', 'Sus citas'],
  ['progreso', 'Progreso: peso, IMC, cintura, % grasa y masa muscular'],
  ['cumplimiento', 'Su registro de cumplimiento de la dieta'],
  ['indicadoresClinicos', 'Indicadores clínicos: presión, glucosa, lípidos y HbA1c'],
];
const PORTAL_POR_OMISION = { dieta: false, recomendaciones: false, citas: false, progreso: false, cumplimiento: false, indicadoresClinicos: false };

function PanelPortal({ expediente, onCambio }) {
  const { pacienteId } = useFicha();
  const { puede } = useAuth();
  const [portal, setPortal] = useState({ ...PORTAL_POR_OMISION, ...(expediente?.portal || {}) });
  const [guardando, setGuardando] = useState('');
  const [error, setError] = useState('');
  const editable = puede('clinico:escribir');

  const cambiar = async (clave, valor) => {
    const anterior = portal;
    setPortal({ ...portal, [clave]: valor }); // se refleja al instante y se revierte si falla
    setGuardando(clave); setError('');
    try {
      await expedienteApi.actualizar(pacienteId, { portal: { [clave]: valor } });
      onCambio?.();
    } catch (err) {
      setPortal(anterior);
      setError(err.message);
    } finally {
      setGuardando('');
    }
  };

  return (
    <section className="panel" aria-labelledby="t-portal">
      <h2 id="t-portal"><MonitorSmartphone size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Portal del paciente</h2>
      <p className="panel-descripcion">Lo que este paciente ve al iniciar sesión con su cuenta. Todo está oculto hasta que lo autorices. Nunca se muestran notas, diagnósticos, antecedentes ni laboratorios.</p>
      <div className="permisos-lista" style={{ marginTop: 0 }}>
        {OPCIONES_PORTAL.map(([clave, texto]) => (
          <label key={clave} className="casilla">
            <input type="checkbox" checked={!!portal[clave]} disabled={!editable || guardando === clave} onChange={(e) => cambiar(clave, e.target.checked)} />
            <span>{texto}</span>
          </label>
        ))}
      </div>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
    </section>
  );
}

function Resumen() {
  const { ficha, recargar } = useFicha();
  return (
    <div className="rejilla-aurea">
      <div className="pila">
        <PanelAlertas alertas={ficha.alertas} onCambio={recargar} />
        <LineaTiempo />
      </div>
      <div className="pila">
        <FichaVigente ficha={ficha} />
        <PanelPortal expediente={ficha.expediente} />
      </div>
    </div>
  );
}

export default Resumen;
