import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import TablaDatos from '../../components/ui/TablaDatos';
import { consultasApi } from '../../services/api';

const fechaHora = (f) => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function ConsultasGlobal() {
  const navigate = useNavigate();
  const [filas, setFilas] = useState(null);
  const [filtro, setFiltro] = useState({ estado: '', mias: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    setFilas(null);
    consultasApi.global(filtro).then(setFilas).catch((e) => { setError(e.message); setFilas([]); });
  }, [filtro]);

  const columnas = [
    { clave: 'fecha', titulo: 'Fecha', valor: (c) => c.fecha, render: (c) => <span className="celda-fuerte">{fechaHora(c.fecha)}</span> },
    { clave: 'paciente', titulo: 'Paciente', valor: (c) => c.pacienteId?.nombreCompleto },
    { clave: 'tipo', titulo: 'Tipo', valor: (c) => (c.tipo === 'primera_vez' ? 'Primera vez' : 'Subsecuente') },
    { clave: 'motivo', titulo: 'Motivo' },
    { clave: 'profesional', titulo: 'Profesional' },
    { clave: 'estado', titulo: 'Nota', render: (c) => <span className={`insignia insignia--${c.estado === 'firmada' ? 'ok' : 'aviso'}`}>{c.estado === 'firmada' ? 'Firmada' : 'Borrador sin firmar'}</span> },
    { clave: 'adendas', titulo: 'Adendas', numerica: true },
  ];

  return (
    <Layout titulo="Consultas" subtitulo="Notas SOAP de los expedientes a tu cargo. Los borradores sin firmar requieren cierre.">
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <section className="panel">
        <TablaDatos columnas={columnas} filas={filas || []} cargando={!filas} etiqueta="Consultas" ordenInicial={{ clave: 'fecha', dir: 'desc' }}
          onFila={(c) => navigate(`/pacientes/${c.pacienteId?._id}/consultas?registro=${c._id}`)} vacio="Sin consultas registradas."
          filtros={(
            <>
              <select className="selector" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })} aria-label="Estado de la nota">
                <option value="">Todas las notas</option><option value="borrador">Borradores pendientes de firma</option><option value="firmada">Firmadas</option>
              </select>
              <label className="casilla"><input type="checkbox" checked={filtro.mias === '1'} onChange={(e) => setFiltro({ ...filtro, mias: e.target.checked ? '1' : '' })} /> Solo mis consultas</label>
            </>
          )} />
      </section>
    </Layout>
  );
}

export default ConsultasGlobal;
