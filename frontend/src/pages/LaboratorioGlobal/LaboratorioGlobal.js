import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import TablaDatos from '../../components/ui/TablaDatos';
import { laboratorioApi } from '../../services/api';

const fecha = (f) => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function LaboratorioGlobal() {
  const navigate = useNavigate();
  const [filas, setFilas] = useState(null);
  const [fuera, setFuera] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFilas(null);
    laboratorioApi.global({ fuera: fuera ? '1' : undefined }).then(setFilas).catch((e) => { setError(e.message); setFilas([]); });
  }, [fuera]);

  const columnas = [
    { clave: 'fechaMuestra', titulo: 'Fecha de toma', valor: (r) => r.fechaMuestra, render: (r) => <span className="celda-fuerte">{fecha(r.fechaMuestra)}</span> },
    { clave: 'paciente', titulo: 'Paciente', valor: (r) => r.pacienteId?.nombreCompleto },
    { clave: 'nombre', titulo: 'Estudio' },
    { clave: 'valor', titulo: 'Resultado', numerica: true, render: (r) => <>{r.valor} {r.unidad}{r.fueraDeRango && <> <span className={`insignia insignia--${r.fueraDeRango === 'alto' ? 'peligro' : 'aviso'}`}>{r.fueraDeRango === 'alto' ? '↑' : '↓'} fuera de rango</span></>}</> },
    { clave: 'ref', titulo: 'Referencia (lab.)', ordenable: false, render: (r) => r.rangoReferencia?.texto || ((r.rangoReferencia?.min != null || r.rangoReferencia?.max != null) ? `${r.rangoReferencia.min ?? ''}–${r.rangoReferencia.max ?? ''}` : '—') },
    { clave: 'procedencia', titulo: 'Procedencia' },
  ];

  return (
    <Layout titulo="Estudios de laboratorio" subtitulo="Resultados recientes de tus pacientes, comparados con el rango de referencia de cada laboratorio.">
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <section className="panel">
        <TablaDatos columnas={columnas} filas={filas || []} cargando={!filas} etiqueta="Resultados de laboratorio" ordenInicial={{ clave: 'fechaMuestra', dir: 'desc' }}
          onFila={(r) => navigate(`/pacientes/${r.pacienteId?._id}/laboratorios?registro=${r._id}`)} vacio="Sin resultados."
          filtros={<label className="casilla"><input type="checkbox" checked={fuera} onChange={(e) => setFuera(e.target.checked)} /> Solo fuera del rango del laboratorio</label>} />
      </section>
    </Layout>
  );
}

export default LaboratorioGlobal;
