import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, BarChart3 } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import { expedienteApi } from '../../services/api';
import { useNutri } from '../../context/NutriContext';

function Reportes() {
  const navigate = useNavigate();
  const { pacientes } = useNutri();
  const [tipos, setTipos] = useState({});
  const [f, setF] = useState({ pacienteId: '', tipo: 'evolucion', terceros: false });
  useEffect(() => { expedienteApi.tiposReporte().then(setTipos).catch(() => {}); }, []);
  useEffect(() => { if (!f.pacienteId && pacientes[0]) setF((x) => ({ ...x, pacienteId: pacientes[0].id })); }, [pacientes, f.pacienteId]);

  const def = tipos[f.tipo];
  const generar = (e) => {
    e.preventDefault();
    navigate(`/pacientes/${f.pacienteId}/documentos/${f.tipo}${f.terceros ? '?terceros=1' : ''}`);
  };

  return (
    <Layout titulo="Reportes" subtitulo="Documentos clínicos por paciente y estadísticas del consultorio.">
      <div className="rejilla-aurea">
        <section className="panel" aria-labelledby="t-rep">
          <h2 id="t-rep"><FileText size={16} aria-hidden="true" /> Documento clínico</h2>
          <p className="panel-descripcion">Cada documento incluye identificación, profesional responsable, fecha y versión del registro. La generación queda registrada en la auditoría.</p>
          <form className="formulario" onSubmit={generar}>
            <div className="campo campo--completo"><label htmlFor="r-pac">Paciente</label>
              <select id="r-pac" value={f.pacienteId} onChange={(e) => setF({ ...f, pacienteId: e.target.value })} required>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombreCompleto} · {p.expediente?.folio}</option>)}
              </select></div>
            <div className="campo campo--completo"><label htmlFor="r-tipo">Documento</label>
              <select id="r-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, terceros: tipos[e.target.value]?.terceros ? f.terceros : false })}>
                {Object.entries(tipos).map(([k, t]) => <option key={k} value={k}>{t.titulo}</option>)}
              </select></div>
            <label className="casilla campo--completo">
              <input type="checkbox" checked={f.terceros} disabled={def && !def.terceros} onChange={(e) => setF({ ...f, terceros: e.target.checked })} />
              Para terceros (minimiza datos personales y clínicos){def && !def.terceros && ' · no disponible para este documento'}
            </label>
            <div className="formulario-acciones"><button className="boton boton--primario" type="submit" disabled={!f.pacienteId}>Generar documento</button></div>
          </form>
        </section>
        <section className="panel" aria-labelledby="t-est">
          <h2 id="t-est"><BarChart3 size={16} aria-hidden="true" /> Estadísticas</h2>
          <p className="panel-descripcion">Indicadores mensuales y anuales de pacientes, consultas, asistencia y adherencia (limitados a tus expedientes).</p>
          <Link className="boton boton--secundario" to="/">Ver dashboard general</Link>
        </section>
      </div>
    </Layout>
  );
}

export default Reportes;
