import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Check, X, Slash } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/ui/Modal';
import { citasApi } from '../../services/api';
import { useNutri } from '../../context/NutriContext';
import { useAuth } from '../../context/AuthContext';

const DIA = 86400000;
const ESTADOS = { programada: ['Programada', 'info'], realizada: ['Realizada', 'ok'], cancelada: ['Cancelada', ''], no_asistio: ['No asistió', 'peligro'] };
const lunesDe = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function Agenda() {
  const { pacientes } = useNutri();
  const { puede } = useAuth();
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [citas, setCitas] = useState(null);
  const [nueva, setNueva] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setCitas(null);
    citasApi.listar({ desde: lunes.toISOString(), hasta: new Date(lunes.getTime() + 7 * DIA - 1).toISOString() }) // límites en hora local.then(setCitas).catch((e) => { setError(e.message); setCitas([]); });
  }, [lunes]);
  useEffect(() => { cargar(); }, [cargar]);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(lunes.getTime() + i * DIA)), [lunes]);
  const deDia = (d) => (citas || []).filter((c) => iso(new Date(c.fechaHora)) === iso(d)).sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));

  const estado = async (c, nuevo) => {
    const motivoCambio = nuevo === 'cancelada' ? window.prompt('Motivo de la cancelación (opcional):') ?? undefined : undefined;
    await citasApi.actualizar(c._id, { estado: nuevo, motivoCambio }).catch((e) => window.alert(e.message));
    cargar();
  };
  const crear = async (e) => {
    e.preventDefault();
    try {
      await citasApi.crear(nueva.pacienteId, { fechaHora: new Date(`${nueva.fecha}T${nueva.hora}`).toISOString(), motivo: nueva.motivo, duracionMin: Number(nueva.duracion) });
      setNueva(null); cargar();
    } catch (err) { setError(err.message); }
  };
  const hoy = iso(new Date());

  return (
    <Layout titulo="Agenda" subtitulo={`Semana del ${lunes.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
      acciones={<>
        <button className="boton boton--secundario boton--icono" onClick={() => setLunes(new Date(lunes.getTime() - 7 * DIA))} aria-label="Semana anterior"><ChevronLeft aria-hidden="true" /></button>
        <button className="boton boton--secundario" onClick={() => setLunes(lunesDe(new Date()))}>Hoy</button>
        <button className="boton boton--secundario boton--icono" onClick={() => setLunes(new Date(lunes.getTime() + 7 * DIA))} aria-label="Semana siguiente"><ChevronRight aria-hidden="true" /></button>
        {puede('agenda:escribir') && <button className="boton boton--primario" onClick={() => setNueva({ pacienteId: pacientes[0]?.id || '', fecha: hoy, hora: '10:00', motivo: 'Seguimiento', duracion: 45 })}><Plus aria-hidden="true" /> Nueva cita</button>}
      </>}>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <div className="rejilla-graficas" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {dias.map((d) => (
          <section key={iso(d)} className="panel panel--compacto" aria-label={d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            style={iso(d) === hoy ? { borderColor: 'var(--azul)' } : undefined}>
            <h2 style={{ textTransform: 'capitalize' }}>{d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' })}</h2>
            {!citas ? <div className="esqueleto" style={{ height: 48 }} /> : deDia(d).length === 0 ? <p className="campo__ayuda">Sin citas</p> : (
              <ul className="lista-registros">
                {deDia(d).map((c) => (
                  <li key={c._id} style={{ display: 'block' }}>
                    <div className="lista-registros__titulo">
                      {new Date(c.fechaHora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {puede('clinico:leer') ? <Link to={`/pacientes/${c.pacienteId?._id}/consultas`}>{c.pacienteId?.nombreCompleto}</Link> : c.pacienteId?.nombreCompleto}
                    </div>
                    <div className="lista-registros__meta">{c.motivo || 'Consulta'} · {c.duracionMin} min <span className={`insignia insignia--${ESTADOS[c.estado][1]}`}>{ESTADOS[c.estado][0]}</span></div>
                    {c.estado === 'programada' && puede('agenda:escribir') && (
                      <div className="encabezado-acciones" style={{ marginTop: 4 }}>
                        <button className="boton boton--secundario boton--chico" onClick={() => estado(c, 'realizada')} aria-label="Marcar realizada"><Check aria-hidden="true" /></button>
                        <button className="boton boton--secundario boton--chico" onClick={() => estado(c, 'no_asistio')} aria-label="No asistió"><Slash aria-hidden="true" /></button>
                        <button className="boton boton--peligro boton--chico" onClick={() => estado(c, 'cancelada')} aria-label="Cancelar cita"><X aria-hidden="true" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <Modal abierto={!!nueva} titulo="Nueva cita" onCerrar={() => setNueva(null)}>
        {nueva && (
          <form className="formulario" onSubmit={crear}>
            <div className="campo campo--completo"><label htmlFor="ag-pac">Paciente</label>
              <select id="ag-pac" value={nueva.pacienteId} required onChange={(e) => setNueva({ ...nueva, pacienteId: e.target.value })}>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}
              </select></div>
            <div className="campo"><label htmlFor="ag-fecha">Fecha</label><input id="ag-fecha" type="date" value={nueva.fecha} required onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} /></div>
            <div className="campo"><label htmlFor="ag-hora">Hora</label><input id="ag-hora" type="time" value={nueva.hora} required onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} /></div>
            <div className="campo"><label htmlFor="ag-dur">Duración (min)</label><input id="ag-dur" type="number" min="5" max="480" value={nueva.duracion} onChange={(e) => setNueva({ ...nueva, duracion: e.target.value })} /></div>
            <div className="campo"><label htmlFor="ag-motivo">Motivo</label><input id="ag-motivo" value={nueva.motivo} maxLength={200} onChange={(e) => setNueva({ ...nueva, motivo: e.target.value })} /></div>
            <div className="formulario-acciones">
              <button type="button" className="boton boton--secundario" onClick={() => setNueva(null)}>Cancelar</button>
              <button type="submit" className="boton boton--primario">Programar</button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}

export default Agenda;
