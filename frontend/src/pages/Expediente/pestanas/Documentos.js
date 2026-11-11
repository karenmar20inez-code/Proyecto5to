import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ExternalLink, Paperclip } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import { expedienteApi, consultasApi } from '../../../services/api';

const DESCRIPCION = {
  historia_clinica: 'Identificación, antecedentes vigentes, diagnósticos, indicadores y consentimientos. Solo para el expediente.',
  resumen_consulta: 'Nota SOAP, firma y mediciones de una consulta. Para terceros se comparte solo el plan.',
  evaluacion_nutricional: 'Indicadores calculados/estimados con su origen y versión de fórmulas.',
  plan_alimenticio: 'Plan vigente, requerimientos, objetivos que atiende y alergias a considerar.',
  evolucion: 'Mediciones, indicadores, objetivos y laboratorios del periodo.',
  antropometria: 'Tabla de mediciones antropométricas con método y responsable.',
  objetivos: 'Objetivos activos con valor inicial, actual, meta y avance.',
};

function Documentos() {
  const { pacienteId } = useFicha();
  const [tipos, setTipos] = useState({});
  const [consultas, setConsultas] = useState([]);
  const [consultaId, setConsultaId] = useState('');
  const [terceros, setTerceros] = useState(false);

  useEffect(() => {
    expedienteApi.tiposReporte().then(setTipos).catch(() => {});
    consultasApi.listar(pacienteId).then((c) => { setConsultas(c); setConsultaId(c[0]?._id || ''); }).catch(() => {});
  }, [pacienteId]);

  const url = (tipo) => `/pacientes/${pacienteId}/documentos/${tipo}?${new URLSearchParams({ ...(terceros && { terceros: '1' }), ...(tipo === 'resumen_consulta' && consultaId && { consultaId }) })}`;

  return (
    <div className="rejilla-aurea">
      <section className="panel" aria-labelledby="t-docs">
        <h2 id="t-docs">Documentación clínica</h2>
        <p className="panel-descripcion">Cada documento incluye identificación, profesional responsable, fecha de emisión y versión del registro. Se abre en una vista de impresión: usa «Guardar como PDF».</p>
        <label className="casilla" style={{ marginBottom: 'var(--e4)' }}>
          <input type="checkbox" checked={terceros} onChange={(e) => setTerceros(e.target.checked)} />
          Documento para terceros (omite contacto, antecedentes y razonamiento clínico)
        </label>
        <ul className="lista-registros">
          {Object.entries(tipos).map(([tipo, def]) => {
            const bloqueado = terceros && !def.terceros;
            return (
              <li key={tipo}>
                <div>
                  <div className="lista-registros__titulo"><FileText size={14} aria-hidden="true" /> {def.titulo}</div>
                  <div className="lista-registros__meta">{DESCRIPCION[tipo]}{bloqueado && ' · No disponible para terceros.'}</div>
                  {tipo === 'resumen_consulta' && consultas.length > 0 && (
                    <select className="selector" style={{ width: 'auto', marginTop: 6 }} value={consultaId} onChange={(e) => setConsultaId(e.target.value)} aria-label="Consulta del resumen">
                      {consultas.map((c) => <option key={c._id} value={c._id}>{new Date(c.fecha).toLocaleDateString('es-MX')} · {c.estado === 'firmada' ? 'firmada' : 'borrador'}</option>)}
                    </select>
                  )}
                </div>
                {bloqueado ? <span className="insignia">Solo expediente</span> : (
                  <Link className="boton boton--secundario boton--chico" to={url(tipo)}>
                    <ExternalLink aria-hidden="true" /> Generar
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="panel" aria-labelledby="t-adjuntos">
        <h2 id="t-adjuntos"><Paperclip size={16} aria-hidden="true" /> Documentos adjuntos</h2>
        <p className="panel-descripcion">Pendiente: la carga de archivos (estudios escaneados, consentimientos firmados) requiere almacenamiento cifrado y control de acceso por archivo. Mientras tanto, registra el consentimiento en Historia clínica y los resultados en Laboratorios.</p>
      </section>
    </div>
  );
}

export default Documentos;
