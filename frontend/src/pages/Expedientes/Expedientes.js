import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import TablaDatos from '../../components/ui/TablaDatos';
import { expedienteApi } from '../../services/api';

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const edad = (p) => {
  if (!p) return null;
  if (!p.fechaNacimiento) return p.edad ?? null;
  const n = new Date(p.fechaNacimiento); const h = new Date();
  return h.getFullYear() - n.getFullYear() - (h < new Date(h.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
};
const ESTADOS = { abierto: ['Abierto', 'info'], en_seguimiento: ['En seguimiento', 'ok'], alta: ['Alta', ''], archivado: ['Archivado', ''] };

function Expedientes() {
  const navigate = useNavigate();
  const [filas, setFilas] = useState(null);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { expedienteApi.listar().then(setFilas).catch((e) => { setError(e.message); setFilas([]); }); }, []);

  const columnas = [
    { clave: 'folio', titulo: 'Folio', render: (f) => <span className="celda-fuerte">{f.folio}</span> },
    { clave: 'paciente', titulo: 'Paciente', valor: (f) => f.paciente?.nombreCompleto },
    { clave: 'edad', titulo: 'Edad', numerica: true, valor: (f) => edad(f.paciente) },
    { clave: 'responsable', titulo: 'Responsable' },
    { clave: 'estado', titulo: 'Estado', valor: (f) => ESTADOS[f.estado]?.[0], render: (f) => <span className={`insignia insignia--${ESTADOS[f.estado]?.[1]}`}>{ESTADOS[f.estado]?.[0]}</span> },
    { clave: 'ultima', titulo: 'Última consulta', valor: (f) => f.ultimaConsulta?.fecha, render: (f) => fecha(f.ultimaConsulta?.fecha) },
    { clave: 'proxima', titulo: 'Próxima cita', valor: (f) => f.proximaCita, render: (f) => fecha(f.proximaCita) },
    {
      clave: 'alertas', titulo: 'Alertas', numerica: true, valor: (f) => (f.alertas.alta || 0) * 100 + (f.alertas.media || 0) * 10 + (f.alertas.baja || 0),
      render: (f) => (
        <span className="lista-alertas__banderas" style={{ justifyContent: 'flex-end' }}>
          {f.alertas.alta > 0 && <span className="insignia insignia--peligro">{f.alertas.alta} alta</span>}
          {f.alertas.media > 0 && <span className="insignia insignia--aviso">{f.alertas.media} media</span>}
          {f.alertas.baja > 0 && <span className="insignia">{f.alertas.baja} baja</span>}
          {!f.alertas.alta && !f.alertas.media && !f.alertas.baja && '—'}
        </span>
      ),
    },
  ];
  const visibles = (filas || []).filter((f) => !estado || f.estado === estado);

  return (
    <Layout titulo="Historial clínico" subtitulo="Expedientes clínicos a los que tienes acceso. Abre uno para ver la ficha completa del paciente.">
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <section className="panel">
        <TablaDatos columnas={columnas} filas={visibles} cargando={!filas} etiqueta="Expedientes clínicos"
          clave={(f) => f._id} onFila={(f) => navigate(`/pacientes/${f.pacienteId}`)} placeholder="Buscar por folio, paciente o responsable…"
          ordenInicial={{ clave: 'alertas', dir: 'desc' }} vacio="Sin expedientes."
          filtros={(
            <select className="selector" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado del expediente">
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}
            </select>
          )} />
      </section>
    </Layout>
  );
}

export default Expedientes;
