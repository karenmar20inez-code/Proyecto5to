import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import TablaDatos from '../../components/ui/TablaDatos';
import { expedienteApi } from '../../services/api';
import { useNutri } from '../../context/NutriContext';

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const DIA = 86400000;

function Evaluaciones() {
  const navigate = useNavigate();
  const { ultimasMediciones, recargarMediciones } = useNutri();
  const [expedientes, setExpedientes] = useState(null);
  useEffect(() => { recargarMediciones(); expedienteApi.listar().then(setExpedientes).catch(() => setExpedientes([])); }, [recargarMediciones]);

  const filas = (expedientes || []).map((e) => {
    const u = ultimasMediciones[e.pacienteId];
    return { ...e, ultimaMedicion: u?.ultimaFecha, total: u?.total || 0, peso: u?.ultimoPeso?.kg, dias: u?.ultimaFecha ? Math.floor((Date.now() - new Date(u.ultimaFecha)) / DIA) : null };
  });

  const columnas = [
    { clave: 'paciente', titulo: 'Paciente', valor: (f) => f.paciente?.nombreCompleto, render: (f) => <span className="celda-fuerte">{f.paciente?.nombreCompleto}</span> },
    { clave: 'folio', titulo: 'Expediente' },
    { clave: 'ultimaMedicion', titulo: 'Última evaluación', valor: (f) => f.ultimaMedicion, render: (f) => fecha(f.ultimaMedicion) },
    { clave: 'dias', titulo: 'Días desde la última', numerica: true, render: (f) => (f.dias == null ? <span className="insignia insignia--aviso">Sin evaluación</span> : <span className={f.dias > 30 ? 'insignia insignia--aviso' : undefined}>{f.dias}</span>) },
    { clave: 'peso', titulo: 'Último peso', numerica: true, render: (f) => (f.peso != null ? `${f.peso} kg` : '—') },
    { clave: 'total', titulo: 'Mediciones', numerica: true },
    { clave: 'responsable', titulo: 'Responsable' },
  ];

  return (
    <Layout titulo="Evaluaciones nutricionales" subtitulo="Estado de evaluación antropométrica de cada expediente. Abre uno para registrar o revisar su evaluación.">
      <section className="panel">
        <TablaDatos columnas={columnas} filas={filas} cargando={!expedientes} etiqueta="Evaluaciones" ordenInicial={{ clave: 'dias', dir: 'desc' }}
          onFila={(f) => navigate(`/pacientes/${f.pacienteId}/antropometria`)} vacio="Sin expedientes." />
      </section>
    </Layout>
  );
}

export default Evaluaciones;
