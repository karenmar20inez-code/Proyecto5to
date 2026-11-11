import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ClipboardCheck } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import { GraficaObjetivos } from '../../../components/Graficas/GraficasClinicas';
import { planeacionApi, laboratorioApi } from '../../../services/api';
import { formatoFecha, fechaISO } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';

const fecha = (f) => (f ? formatoFecha(fechaISO(f)) : '—');
const ESTADOS = { activo: ['Activo', 'info'], logrado: ['Logrado', 'ok'], no_logrado: ['No logrado', 'aviso'], suspendido: ['Suspendido', ''] };
const DIA = 86400000;

function FormObjetivo({ indicadores, diagnosticos, analitos, onGuardar, onCancelar }) {
  const [f, setF] = useState({ descripcion: '', indicador: 'pesoKg', analito: '', valorInicial: '', valorMeta: '', unidad: '', inicio: new Date().toISOString().slice(0, 10), fin: '', frecuenciaRevisionDias: 30, diagnosticoId: diagnosticos[0]?._id || '' });
  const [error, setError] = useState('');
  const cualitativo = f.indicador === 'cualitativo';
  const enviar = async (e) => {
    e.preventDefault();
    try {
      await onGuardar({
        descripcion: f.descripcion, indicador: f.indicador, analito: f.indicador === 'laboratorio' ? f.analito : undefined,
        valorInicial: f.valorInicial === '' ? undefined : Number(f.valorInicial), valorMeta: cualitativo ? undefined : Number(f.valorMeta),
        unidad: f.unidad || (f.indicador === 'laboratorio' ? analitos[f.analito]?.unidad : indicadores[f.indicador]?.unidad),
        periodo: { inicio: f.inicio, fin: f.fin || undefined }, frecuenciaRevisionDias: Number(f.frecuenciaRevisionDias), diagnosticoId: f.diagnosticoId || undefined,
      });
    } catch (err) { setError(err.message); }
  };
  const c = (k) => ({ id: `ob-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="campo campo--completo"><label htmlFor="ob-descripcion">Objetivo *</label><input {...c('descripcion')} required maxLength={300} placeholder="Ej. Reducir la circunferencia de cintura a 88 cm" /></div>
      <div className="campo"><label htmlFor="ob-diagnosticoId">Diagnóstico relacionado</label>
        <select {...c('diagnosticoId')}><option value="">Sin vincular</option>{diagnosticos.map((d) => <option key={d._id} value={d._id}>{d.problema}</option>)}</select></div>
      <div className="campo"><label htmlFor="ob-indicador">Indicador *</label>
        <select {...c('indicador')}>{Object.entries(indicadores).map(([k, v]) => <option key={k} value={k}>{v.nombre}{v.unidad ? ` (${v.unidad})` : ''}</option>)}</select></div>
      {f.indicador === 'laboratorio' && (
        <div className="campo"><label htmlFor="ob-analito">Estudio *</label>
          <select {...c('analito')} required><option value="">—</option>{Object.entries(analitos).map(([k, a]) => <option key={k} value={k}>{a.nombre}</option>)}</select></div>
      )}
      {!cualitativo && (
        <>
          <div className="campo"><label htmlFor="ob-valorInicial">Valor inicial</label><input type="number" step="any" {...c('valorInicial')} />
            <span className="campo__ayuda">Vacío = último registro real del indicador.</span></div>
          <div className="campo"><label htmlFor="ob-valorMeta">Valor meta *</label><input type="number" step="any" {...c('valorMeta')} required /></div>
        </>
      )}
      <div className="campo"><label htmlFor="ob-inicio">Inicio *</label><input type="date" {...c('inicio')} required /></div>
      <div className="campo"><label htmlFor="ob-fin">Fin del periodo</label><input type="date" {...c('fin')} min={f.inicio} /></div>
      <div className="campo"><label htmlFor="ob-frecuenciaRevisionDias">Revisar cada (días)</label><input type="number" min="1" max="365" {...c('frecuenciaRevisionDias')} /></div>
      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton boton--primario">Registrar objetivo</button>
      </div>
    </form>
  );
}

function Objetivos() {
  const { pacienteId, ficha, recargar } = useFicha();
  const { puede } = useAuth();
  const [params] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [analitos, setAnalitos] = useState({});
  const [nuevo, setNuevo] = useState(false);
  const [revisando, setRevisando] = useState(null);
  const [rev, setRev] = useState({ comentario: '', avance: '', estado: '' });

  const cargar = useCallback(() => planeacionApi.objetivos(pacienteId).then(setDatos).catch(() => setDatos({ indicadores: {}, objetivos: [] })), [pacienteId]);
  useEffect(() => { cargar(); laboratorioApi.analitos().then(setAnalitos).catch(() => {}); }, [cargar]);

  const revisar = async (e) => {
    e.preventDefault();
    await planeacionApi.revisarObjetivo(revisando._id, { comentario: rev.comentario, avance: rev.avance === '' ? undefined : Number(rev.avance), estado: rev.estado || undefined })
      .catch((err) => window.alert(err.message));
    setRevisando(null); setRev({ comentario: '', avance: '', estado: '' }); cargar(); recargar();
  };

  return (
    <div className="pila">
      <section className="panel" aria-labelledby="t-obj">
        <div className="panel-encabezado">
          <div><h2 id="t-obj">Objetivos</h2><p className="panel-descripcion">Avance calculado con registros reales: (inicial − actual) / (inicial − meta).</p></div>
          {puede('clinico:escribir') && <button className="boton boton--primario" onClick={() => setNuevo(true)}><Plus aria-hidden="true" /> Nuevo objetivo</button>}
        </div>
        {!datos ? <div className="esqueleto" style={{ height: 160 }} /> : datos.objetivos.length === 0 ? <p className="vacio">Sin objetivos registrados.</p> : (
          <ul className="lista-registros">
            {datos.objetivos.map((o) => {
              const ultima = o.revisiones?.[o.revisiones.length - 1];
              const vencida = o.estado === 'activo' && Date.now() - new Date(ultima?.fecha || o.createdAt).getTime() > (o.frecuenciaRevisionDias || 30) * DIA;
              return (
                <li key={o._id} className={params.get('registro') === o._id ? 'registro--resaltado' : undefined} style={{ display: 'block' }}>
                  <div className="panel-encabezado" style={{ marginBottom: 6 }}>
                    <div>
                      <div className="lista-registros__titulo">{o.descripcion} <span className={`insignia insignia--${ESTADOS[o.estado][1]}`}>{ESTADOS[o.estado][0]}</span>
                        {vencida && <span className="insignia insignia--aviso"> Revisión pendiente</span>}</div>
                      <div className="lista-registros__meta">
                        {datos.indicadores[o.indicador]?.nombre}{o.analito ? ` (${analitos[o.analito]?.nombre || o.analito})` : ''} ·
                        inicial {o.valorInicial ?? '—'} → meta {o.valorMeta ?? '—'} {o.unidad} · actual {o.valorActual ?? 'sin dato'}{o.fechaValorActual ? ` (${fecha(o.fechaValorActual)})` : ''}
                        {' · '}periodo {fecha(o.periodo?.inicio)}{o.periodo?.fin ? ` – ${fecha(o.periodo.fin)}` : ''}
                        {o.diagnosticoId && ' · ligado a diagnóstico'}
                      </div>
                    </div>
                    {puede('clinico:escribir') && o.estado === 'activo' && (
                      <button className="boton boton--secundario boton--chico" onClick={() => setRevisando(o)}><ClipboardCheck aria-hidden="true" /> Revisar</button>
                    )}
                  </div>
                  {o.progreso != null && (
                    <div className="progreso" role="progressbar" aria-label={`Avance: ${o.progreso} %`} aria-valuenow={Math.round(Math.max(0, Math.min(100, o.progreso)))} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${Math.max(0, Math.min(100, o.progreso))}%` }} />
                    </div>
                  )}
                  <div className="lista-registros__meta">{o.progreso != null ? `Avance ${o.progreso} %` : 'Avance no calculable todavía'}{ultima && ` · última revisión ${fecha(ultima.fecha)} por ${ultima.usuario}${ultima.comentario ? `: ${ultima.comentario}` : ''}`}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {datos?.objetivos.length > 0 && (
        <section className="panel" aria-labelledby="t-obj-g"><h2 id="t-obj-g">Cumplimiento de objetivos</h2><p className="panel-descripcion">Objetivos con avance medible.</p>
          <GraficaObjetivos objetivos={datos.objetivos.filter((o) => o.estado === 'activo')} /></section>
      )}

      <Modal abierto={nuevo} titulo="Nuevo objetivo" onCerrar={() => setNuevo(false)} ancho={720}>
        {nuevo && datos && <FormObjetivo indicadores={datos.indicadores} diagnosticos={ficha.ficha.diagnosticos} analitos={analitos}
          onCancelar={() => setNuevo(false)} onGuardar={async (d) => { await planeacionApi.crearObjetivo(pacienteId, d); setNuevo(false); cargar(); recargar(); }} />}
      </Modal>
      <Modal abierto={!!revisando} titulo={`Revisión: ${revisando?.descripcion || ''}`} onCerrar={() => setRevisando(null)}>
        <form className="formulario" onSubmit={revisar}>
          <p className="campo--completo panel-descripcion">Valor actual registrado: {revisando?.valorActual ?? 'sin dato'} {revisando?.unidad} · avance calculado: {revisando?.progreso ?? '—'} %</p>
          {revisando?.indicador === 'cualitativo' && (
            <div className="campo"><label htmlFor="rv-avance">Avance valorado (0–100 %) *</label><input id="rv-avance" type="number" min="0" max="100" required value={rev.avance} onChange={(e) => setRev({ ...rev, avance: e.target.value })} /></div>
          )}
          <div className="campo"><label htmlFor="rv-estado">Cambiar estado</label>
            <select id="rv-estado" value={rev.estado} onChange={(e) => setRev({ ...rev, estado: e.target.value })}>
              <option value="">Mantener activo</option><option value="logrado">Logrado</option><option value="no_logrado">No logrado</option><option value="suspendido">Suspendido</option>
            </select></div>
          <div className="campo campo--completo"><label htmlFor="rv-com">Comentario</label><textarea id="rv-com" value={rev.comentario} onChange={(e) => setRev({ ...rev, comentario: e.target.value })} maxLength={1000} /></div>
          <div className="formulario-acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setRevisando(null)}>Cancelar</button>
            <button type="submit" className="boton boton--primario">Registrar revisión</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Objetivos;
