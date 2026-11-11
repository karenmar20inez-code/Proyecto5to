import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, PenLine, ShieldCheck, ShieldAlert, FileSignature, MessageSquarePlus, ClipboardPaste } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import { PanelCitas } from '../../AnalisisPaciente/PanelesClinicos';
import { consultasApi, citasApi, expedienteApi } from '../../../services/api';
import { formatoFecha } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';

const fechaHora = (f) => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fecha = (f) => (f ? formatoFecha(String(f).slice(0, 10)) : '—');
const SECCIONES = [
  ['subjetivo', 'S', 'Subjetivo', 'Síntomas, hábitos, percepción del paciente y motivo de consulta.'],
  ['objetivo', 'O', 'Objetivo', 'Mediciones, signos, estudios y resultados observables.'],
  ['analisis', 'A', 'Análisis', 'Interpretación clínica y nutricional del profesional.'],
  ['plan', 'P', 'Plan', 'Intervención nutricional, recomendaciones, objetivos y seguimiento.'],
];
const ETIQUETAS_CAMPO = { pesoKg: 'Peso', cinturaCm: 'Cintura', caderaCm: 'Cadera', grasaPorcentaje: 'Grasa', masaMuscularKg: 'Masa muscular', presionSistolica: 'PA sistólica', presionDiastolica: 'PA diastólica', consumoKcal: 'Consumo' };

/* ---------- Comparación con la consulta anterior ---------- */
function Comparacion({ consultaId }) {
  const { pacienteId } = useFicha();
  const [datos, setDatos] = useState(null);
  useEffect(() => { expedienteApi.comparacion(pacienteId, { a: consultaId }).then(setDatos).catch(() => setDatos(null)); }, [pacienteId, consultaId]);
  if (!datos?.actual) return <p className="campo__ayuda">Sin mediciones vinculadas para comparar.</p>;
  const filas = datos.filas.filter((f) => f.actual != null || f.anterior != null);
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <caption className="campo__ayuda" style={{ textAlign: 'left', padding: '4px 0' }}>
          {fecha(datos.actual.fecha)} vs {datos.anterior ? fecha(datos.anterior.fecha) : 'sin medición anterior'}
        </caption>
        <thead><tr><th>Indicador</th><th className="celda-num">Anterior</th><th className="celda-num">Actual</th><th className="celda-num">Cambio</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.campo}>
              <td>{ETIQUETAS_CAMPO[f.campo] || f.campo}</td>
              <td className="celda-num">{f.anterior ?? '—'} {f.anterior != null && f.unidad}</td>
              <td className="celda-num celda-fuerte">{f.actual ?? '—'} {f.actual != null && f.unidad}</td>
              <td className="celda-num">{f.delta != null ? `${f.delta > 0 ? '+' : ''}${f.delta}` : '—'}</td>
            </tr>
          ))}
          {datos.laboratorio.map((l) => (
            <tr key={l.analito}>
              <td>{l.nombre}</td><td className="celda-num">{l.anterior?.valor ?? '—'}</td>
              <td className="celda-num celda-fuerte">{l.actual.valor} {l.unidad}</td><td className="celda-num">{l.delta != null ? `${l.delta > 0 ? '+' : ''}${l.delta}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Editor de nota ---------- */
function EditorNota({ consultaId, onCambio }) {
  const { ficha } = useFicha();
  const { usuario } = useAuth();
  const [c, setC] = useState(null);
  const [soap, setSoap] = useState({ subjetivo: '', objetivo: '', analisis: '', plan: '' });
  const [estadoGuardado, setEstadoGuardado] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [adenda, setAdenda] = useState({ tipo: 'aclaracion', texto: '' });
  const [error, setError] = useState('');
  const pendiente = useRef(null);
  const ultimoGuardado = useRef(null);

  const cargar = useCallback(async () => {
    const d = await consultasApi.obtener(consultaId);
    setC(d);
    setSoap(d.soap);
    ultimoGuardado.current = JSON.stringify(d.soap);
  }, [consultaId]);
  useEffect(() => { cargar().catch((e) => setError(e.message)); }, [cargar]);

  const editable = c && c.estado === 'borrador' && (String(c.profesionalId) === String(usuario._id) || usuario.rol === 'administrador');

  const guardar = useCallback(async (autoguardado) => {
    const texto = JSON.stringify(soap);
    if (texto === ultimoGuardado.current) return;
    setEstadoGuardado('Guardando…');
    try {
      await consultasApi.guardarBorrador(consultaId, { soap, autoguardado });
      ultimoGuardado.current = texto;
      setEstadoGuardado(`Borrador guardado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) { setEstadoGuardado(`No se pudo guardar: ${e.message}`); }
  }, [soap, consultaId]);

  /* Autoguardado en el servidor 2.5 s después de dejar de escribir (nunca en el navegador) */
  useEffect(() => {
    if (!editable) return undefined;
    clearTimeout(pendiente.current);
    pendiente.current = setTimeout(() => guardar(true), 2500);
    return () => clearTimeout(pendiente.current);
  }, [soap, editable, guardar]);

  const insertar = (seccion, texto) => setSoap((s) => ({ ...s, [seccion]: s[seccion] ? `${s[seccion]}\n${texto}` : texto }));
  const vigentes = {
    medicamentos: ficha.ficha.medicamentos.map((m) => `${m.descripcion}${m.detalle?.dosis ? ` ${m.detalle.dosis}` : ''}`).join('; '),
    alergias: ficha.ficha.alergias.map((a) => a.descripcion).join('; '),
  };
  const ind = ficha.indicadores;
  const textoObjetivo = [
    ind.peso.valor != null && `Peso ${ind.peso.valor} kg (${fecha(ind.peso.fecha)}, ${ind.peso.metodo})`,
    ind.imc.valor != null && `IMC ${ind.imc.valor} kg/m²`,
    ind.cintura.valor != null && `Cintura ${ind.cintura.valor} cm`,
    ind.grasa.valor != null && `Grasa ${ind.grasa.valor} %`,
  ].filter(Boolean).join('; ');

  const faltantes = SECCIONES.filter(([k]) => !String(soap[k] || '').trim()).map(([, , t]) => t);
  const firmar = async () => {
    setError('');
    try {
      await guardar(false);
      await consultasApi.firmar(consultaId);
      setConfirmar(false);
      await cargar();
      onCambio();
    } catch (e) { setError(e.message); }
  };
  const agregarAdenda = async (e) => {
    e.preventDefault();
    try { await consultasApi.adenda(consultaId, adenda); setAdenda({ tipo: 'aclaracion', texto: '' }); await cargar(); onCambio(); } catch (err) { setError(err.message); }
  };

  if (!c) return error ? <p className="aviso aviso--error">{error}</p> : <div className="esqueleto" style={{ height: 320 }} />;

  return (
    <section className="panel" aria-labelledby="t-nota">
      <div className="panel-encabezado">
        <div>
          <h2 id="t-nota">Nota SOAP · {fechaHora(c.fecha)}</h2>
          <p className="panel-descripcion">
            {c.tipo === 'primera_vez' ? 'Primera vez' : 'Subsecuente'} · {c.profesional}{c.motivo ? ` · ${c.motivo}` : ''}
            {' · '}{c.mediciones.length} medición(es) y {c.laboratorios.length} resultado(s) vinculados
          </p>
        </div>
        {c.estado === 'firmada' ? (
          <span className={`insignia insignia--${c.integridad === 'verificada' ? 'ok' : 'peligro'}`}>
            {c.integridad === 'verificada' ? <ShieldCheck size={12} aria-hidden="true" /> : <ShieldAlert size={12} aria-hidden="true" />}
            Firmada · integridad {c.integridad}
          </span>
        ) : <span className="insignia insignia--aviso">Borrador</span>}
      </div>

      {c.estado === 'borrador' ? (
        <div className="soap">
          {SECCIONES.map(([k, letra, titulo, ayuda]) => (
            <div className="campo soap__seccion" key={k}>
              <label htmlFor={`soap-${k}`}><span className="soap__letra" aria-hidden="true">{letra}</span> {titulo}</label>
              <span className="campo__ayuda" id={`ayuda-${k}`}>{ayuda}</span>
              <textarea id={`soap-${k}`} aria-describedby={`ayuda-${k}`} value={soap[k]} readOnly={!editable}
                onChange={(e) => setSoap({ ...soap, [k]: e.target.value })} rows={k === 'analisis' || k === 'plan' ? 5 : 4} />
              {editable && k === 'subjetivo' && (vigentes.medicamentos || vigentes.alergias) && (
                <button type="button" className="boton boton--fantasma boton--chico" style={{ alignSelf: 'flex-start' }}
                  onClick={() => insertar('subjetivo', `Medicamentos vigentes: ${vigentes.medicamentos || 'ninguno'}. Alergias: ${vigentes.alergias || 'ninguna registrada'}.`)}>
                  <ClipboardPaste aria-hidden="true" /> Insertar medicamentos y alergias vigentes
                </button>
              )}
              {editable && k === 'objetivo' && textoObjetivo && (
                <button type="button" className="boton boton--fantasma boton--chico" style={{ alignSelf: 'flex-start' }} onClick={() => insertar('objetivo', textoObjetivo)}>
                  <ClipboardPaste aria-hidden="true" /> Insertar últimas mediciones
                </button>
              )}
            </div>
          ))}
          <div className="formulario-acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="soap__guardado" aria-live="polite">{estadoGuardado || 'El borrador se guarda automáticamente en el servidor.'}</span>
            {editable && (
              <span className="encabezado-acciones">
                <button className="boton boton--secundario" onClick={() => guardar(false)}>Guardar borrador</button>
                <button className="boton boton--primario" onClick={() => setConfirmar(true)}><FileSignature aria-hidden="true" /> Firmar y cerrar nota</button>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="nota-firmada">
          {SECCIONES.map(([k, , titulo]) => (<div key={k}><h3>{titulo}</h3><p>{c.soap[k]}</p></div>))}
          <p className="campo__ayuda" style={{ marginTop: 'var(--e3)' }}>
            Firmada por {c.firma.nombre}{c.firma.cedulaProfesional ? ` (céd. ${c.firma.cedulaProfesional})` : ''} el {fechaHora(c.firma.fecha)} · huella {c.firma.hash.slice(0, 16)}…
          </p>
          {c.adendas.length > 0 && (
            <div style={{ marginTop: 'var(--e4)' }}>
              <h3>Adendas</h3>
              <ul className="linea-tiempo">
                {c.adendas.map((a) => (
                  <li key={a._id}><div className="linea-tiempo__fecha">{fechaHora(a.fecha)} · {a.autor} · {a.tipo}</div><div className="linea-tiempo__detalle">{a.texto}</div></li>
                ))}
              </ul>
            </div>
          )}
          <form className="formulario" onSubmit={agregarAdenda} style={{ marginTop: 'var(--e4)' }}>
            <div className="campo"><label htmlFor="ad-tipo">Tipo de adenda</label>
              <select id="ad-tipo" value={adenda.tipo} onChange={(e) => setAdenda({ ...adenda, tipo: e.target.value })}>
                <option value="aclaracion">Aclaración</option><option value="correccion">Corrección</option><option value="complemento">Complemento</option>
              </select></div>
            <div className="campo campo--completo"><label htmlFor="ad-texto">Texto (la nota original no se modifica)</label>
              <textarea id="ad-texto" value={adenda.texto} onChange={(e) => setAdenda({ ...adenda, texto: e.target.value })} /></div>
            <div className="formulario-acciones"><button className="boton boton--secundario" type="submit" disabled={!adenda.texto.trim()}><MessageSquarePlus aria-hidden="true" /> Agregar adenda</button></div>
          </form>
        </div>
      )}
      {error && <p className="aviso aviso--error" role="alert" style={{ marginTop: 'var(--e3)' }}>{error}</p>}

      <h3 style={{ marginTop: 'var(--e5)' }}>Comparación con la consulta anterior</h3>
      <Comparacion consultaId={consultaId} />

      <Modal abierto={confirmar} titulo="¿Firmar y cerrar la nota?" onCerrar={() => setConfirmar(false)}
        acciones={<>
          <button className="boton boton--secundario" onClick={() => setConfirmar(false)}>Seguir editando</button>
          <button className="boton boton--primario" onClick={firmar} disabled={faltantes.length > 0}><FileSignature aria-hidden="true" /> Firmar</button>
        </>}>
        <p className="panel-descripcion">Una vez firmada, la nota no podrá editarse; las correcciones se harán con adendas. La firma queda registrada con tu nombre, fecha y hora.</p>
        {faltantes.length > 0
          ? <p className="aviso aviso--alerta" role="alert">Faltan secciones: {faltantes.join(', ')}.</p>
          : <p className="aviso aviso--ok">Las cuatro secciones están completas.</p>}
        {!ficha.ficha.alergias.length && !ficha.ficha.alergiasNegadas && <p className="aviso aviso--alerta">No hay registro de alergias en la historia clínica.</p>}
        {c.mediciones.length === 0 && <p className="aviso">Esta consulta no tiene mediciones vinculadas.</p>}
      </Modal>
    </section>
  );
}

/* ---------- Pestaña ---------- */
function Consultas() {
  const { pacienteId, recargar } = useFicha();
  const { puede } = useAuth();
  const [params, setParams] = useSearchParams();
  const [consultas, setConsultas] = useState(null);
  const [citas, setCitas] = useState([]);
  const [nueva, setNueva] = useState(null);
  const [error, setError] = useState('');
  const seleccionada = params.get('registro');

  const cargar = useCallback(async () => {
    const [c, ci] = await Promise.all([consultasApi.listar(pacienteId), citasApi.listarPaciente(pacienteId).catch(() => [])]);
    setConsultas(c);
    setCitas(ci);
    if (!params.get('registro') && c[0]) setParams({ registro: c[0]._id }, { replace: true });
  }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (e) => {
    e.preventDefault();
    try {
      const c = await consultasApi.crear(pacienteId, { motivo: nueva.motivo, citaId: nueva.citaId || undefined, fecha: new Date(`${nueva.fecha}T${nueva.hora}`).toISOString() });
      setNueva(null);
      await cargar();
      setParams({ registro: c._id });
      recargar();
    } catch (err) { setError(err.message); }
  };
  const hoy = new Date();
  const programadas = citas.filter((c) => c.estado === 'programada');

  return (
    <div className="rejilla-aurea-inversa">
      <div className="pila">
        <section className="panel" aria-labelledby="t-consultas">
          <div className="panel-encabezado">
            <div><h2 id="t-consultas">Consultas</h2><p className="panel-descripcion">{consultas?.length ?? '…'} registradas</p></div>
            {puede('clinico:escribir') && (
              <button className="boton boton--primario boton--chico" onClick={() => setNueva({ motivo: 'Seguimiento', citaId: programadas[0]?._id || '', fecha: hoy.toISOString().slice(0, 10), hora: hoy.toTimeString().slice(0, 5) })}>
                <Plus aria-hidden="true" /> Nueva consulta
              </button>
            )}
          </div>
          {!consultas ? <div className="esqueleto" style={{ height: 160 }} /> : consultas.length === 0 ? <p className="vacio">Sin consultas. Inicia la primera consulta.</p> : (
            <ul className="lista-registros">
              {consultas.map((c) => (
                <li key={c._id} className={seleccionada === c._id ? 'registro--resaltado' : undefined}>
                  <button className="enlace" style={{ textAlign: 'left', fontSize: 'var(--fs-sm)', textDecoration: 'none' }} onClick={() => setParams({ registro: c._id })} aria-current={seleccionada === c._id}>
                    <span className="lista-registros__titulo">{fechaHora(c.fecha)}</span>
                    <span className="lista-registros__meta" style={{ display: 'block' }}>{c.motivo || 'Consulta'} · {c.profesional}</span>
                  </button>
                  <span className={`insignia insignia--${c.estado === 'firmada' ? 'ok' : 'aviso'}`}>{c.estado === 'firmada' ? 'Firmada' : 'Borrador'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <PanelCitas pacienteId={pacienteId} citas={citas} onCambio={() => { cargar(); recargar(); }} />
      </div>

      {seleccionada ? <EditorNota key={seleccionada} consultaId={seleccionada} onCambio={() => { cargar(); recargar(); }} />
        : <section className="panel vacio"><PenLine aria-hidden="true" /> Selecciona o inicia una consulta para documentar la nota SOAP.</section>}

      <Modal abierto={!!nueva} titulo="Iniciar consulta" onCerrar={() => setNueva(null)}>
        {nueva && (
          <form className="formulario" onSubmit={crear}>
            <div className="campo"><label htmlFor="nc-fecha">Fecha</label><input id="nc-fecha" type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} required /></div>
            <div className="campo"><label htmlFor="nc-hora">Hora</label><input id="nc-hora" type="time" value={nueva.hora} onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} required /></div>
            <div className="campo campo--completo"><label htmlFor="nc-motivo">Motivo</label><input id="nc-motivo" value={nueva.motivo} onChange={(e) => setNueva({ ...nueva, motivo: e.target.value })} maxLength={300} /></div>
            <div className="campo campo--completo"><label htmlFor="nc-cita">Cita de agenda (opcional)</label>
              <select id="nc-cita" value={nueva.citaId} onChange={(e) => setNueva({ ...nueva, citaId: e.target.value })}>
                <option value="">Sin cita (consulta no programada)</option>
                {programadas.map((c) => <option key={c._id} value={c._id}>{fechaHora(c.fechaHora)} · {c.motivo || 'Consulta'}</option>)}
              </select>
              <span className="campo__ayuda">La cita elegida se marcará como realizada.</span></div>
            {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
            <div className="formulario-acciones">
              <button type="button" className="boton boton--secundario" onClick={() => setNueva(null)}>Cancelar</button>
              <button type="submit" className="boton boton--primario">Iniciar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default Consultas;
