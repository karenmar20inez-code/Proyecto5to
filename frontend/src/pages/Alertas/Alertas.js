import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/ui/Modal';
import { alertasApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PRIORIDAD = { alta: ['Alta', 'peligro'], media: ['Media', 'aviso'], baja: ['Baja', ''] };
const fecha = (f) => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

function Alertas() {
  const { puede } = useAuth();
  const [filtro, setFiltro] = useState({ estado: 'pendiente', prioridad: '' });
  const [lista, setLista] = useState(null);
  const [revisando, setRevisando] = useState(null);
  const [nota, setNota] = useState('');
  const [evaluando, setEvaluando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(() => { setLista(null); alertasApi.listar(filtro).then(setLista).catch(() => setLista([])); }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const reevaluar = async () => {
    setEvaluando(true);
    try {
      const r = await alertasApi.evaluar();
      setMensaje(`${r.pacientesEvaluados} paciente(s) evaluados · ${r.alertasPendientes} alerta(s) pendiente(s).`);
      cargar();
    } catch (e) { setMensaje(e.message); } finally { setEvaluando(false); }
  };
  const enviar = async () => {
    await alertasApi.revisar(revisando.alerta._id, revisando.estado, nota).catch((e) => window.alert(e.message));
    setRevisando(null); setNota(''); cargar();
  };

  return (
    <Layout titulo="Alertas clínicas" subtitulo="Información que requiere revisión profesional según las reglas configuradas. No son diagnósticos."
      acciones={<button className="boton boton--secundario" onClick={reevaluar} disabled={evaluando}><RefreshCw aria-hidden="true" /> {evaluando ? 'Evaluando…' : 'Re-evaluar reglas'}</button>}>
      {mensaje && <p className="aviso" role="status" style={{ marginTop: 0, marginBottom: 'var(--e4)' }}>{mensaje}</p>}
      <section className="panel">
        <div className="filtros-tabla">
          <select className="selector" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })} aria-label="Estado">
            <option value="pendiente">Pendientes</option><option value="revisada">Revisadas</option><option value="descartada">Descartadas</option><option value="cerrada">Cerradas automáticamente</option>
          </select>
          <select className="selector" value={filtro.prioridad} onChange={(e) => setFiltro({ ...filtro, prioridad: e.target.value })} aria-label="Prioridad">
            <option value="">Todas las prioridades</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
          </select>
          <span className="campo__ayuda">{lista?.length ?? '…'} alerta(s)</span>
        </div>
        {!lista ? <div className="esqueleto" style={{ height: 200 }} /> : lista.length === 0 ? <p className="vacio">Sin alertas para este filtro.</p> : lista.map((a) => (
          <div key={a._id} className={`alerta-item alerta-item--${a.prioridad}`}>
            <AlertTriangle size={18} color={a.prioridad === 'alta' ? 'var(--peligro)' : 'var(--aviso)'} aria-hidden="true" />
            <div>
              <p className="alerta-item__motivo"><Link to={`/pacientes/${a.pacienteId?._id}/${a.origen?.pestana || 'resumen'}${a.origen?.id ? `?registro=${a.origen.id}` : ''}`}><strong>{a.pacienteId?.nombreCompleto}</strong></Link> · {a.motivo}</p>
              <p className="alerta-item__meta">
                <span className={`insignia insignia--${PRIORIDAD[a.prioridad][1]}`}>Prioridad {PRIORIDAD[a.prioridad][0]}</span> {fecha(a.fecha)} · Regla {a.codigoRegla}
                {a.revision?.usuario && ` · ${a.estado} por ${a.revision.usuario}${a.revision.nota ? `: ${a.revision.nota}` : ''}`}
              </p>
            </div>
            {a.estado === 'pendiente' && puede('alertas:revisar') && (
              <div className="alerta-item__acciones">
                <button className="boton boton--secundario boton--chico" onClick={() => setRevisando({ alerta: a, estado: 'revisada' })}><CheckCircle2 aria-hidden="true" /> Revisada</button>
                <button className="boton boton--fantasma boton--chico" onClick={() => setRevisando({ alerta: a, estado: 'descartada' })}><XCircle aria-hidden="true" /> Descartar</button>
              </div>
            )}
          </div>
        ))}
      </section>
      <Modal abierto={!!revisando} titulo={revisando?.estado === 'revisada' ? 'Marcar como revisada' : 'Descartar alerta'} onCerrar={() => setRevisando(null)}
        acciones={<>
          <button className="boton boton--secundario" onClick={() => setRevisando(null)}>Cancelar</button>
          <button className="boton boton--primario" onClick={enviar} disabled={revisando?.estado === 'descartada' && !nota.trim()}>Confirmar</button>
        </>}>
        <p className="panel-descripcion">{revisando?.alerta.motivo}</p>
        <div className="campo"><label htmlFor="al-nota">Nota {revisando?.estado === 'descartada' ? '(obligatoria)' : '(opcional)'}</label>
          <textarea id="al-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} /></div>
      </Modal>
    </Layout>
  );
}

export default Alertas;
