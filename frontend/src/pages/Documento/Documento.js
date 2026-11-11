import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { expedienteApi } from '../../services/api';
import '../../styles/modulos.css';
import './Documento.css';

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');
const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '—');
const ORIGEN = { medido: 'Medido', calculado: 'Calculado', estimado: 'Estimado', prescrito: 'Prescrito', ajustado: 'Ajustado' };
const INDICADORES = [['peso', 'Peso'], ['imc', 'IMC'], ['cintura', 'Cintura'], ['grasa', 'Grasa corporal'], ['masaMuscular', 'Masa muscular'], ['requerimientoEnergetico', 'Requerimiento energético (GET)']];
const SOAP = [['subjetivo', 'S · Subjetivo'], ['objetivo', 'O · Objetivo'], ['analisis', 'A · Análisis'], ['plan', 'P · Plan']];

function TablaMediciones({ mediciones }) {
  if (!mediciones?.length) return <p>Sin mediciones registradas.</p>;
  return (
    <table className="doc-tabla">
      <thead><tr><th>Fecha</th><th>Peso (kg)</th><th>Estatura (cm)</th><th>Cintura (cm)</th><th>Cadera (cm)</th><th>Grasa (%)</th><th>Masa musc. (kg)</th><th>Registró</th></tr></thead>
      <tbody>{mediciones.map((m) => (
        <tr key={m._id}><td>{fecha(m.fecha)}{m.version > 1 ? ` (v${m.version})` : ''}</td><td>{m.pesoKg ?? '—'}</td><td>{m.estaturaCm ?? '—'}</td><td>{m.cinturaCm ?? '—'}</td>
          <td>{m.caderaCm ?? '—'}</td><td>{m.grasaPorcentaje ?? '—'}</td><td>{m.masaMuscularKg ?? '—'}</td><td>{m.responsable}</td></tr>
      ))}</tbody>
    </table>
  );
}

function TablaIndicadores({ indicadores }) {
  if (!indicadores) return null;
  return (
    <table className="doc-tabla">
      <thead><tr><th>Indicador</th><th>Valor</th><th>Origen</th><th>Fecha</th><th>Método</th></tr></thead>
      <tbody>{INDICADORES.map(([k, n]) => {
        const d = indicadores[k] || {};
        return <tr key={k}><td>{n}</td><td>{d.valor != null ? `${d.valor.toLocaleString?.('es-MX') ?? d.valor} ${d.unidad || ''}` : 'Sin dato'}</td><td>{ORIGEN[d.origen] || '—'}</td><td>{fecha(d.fecha)}</td><td>{d.metodo || '—'}</td></tr>;
      })}</tbody>
    </table>
  );
}

function TablaObjetivos({ objetivos }) {
  if (!objetivos?.length) return <p>Sin objetivos registrados.</p>;
  return (
    <table className="doc-tabla">
      <thead><tr><th>Objetivo</th><th>Inicial</th><th>Actual</th><th>Meta</th><th>Avance</th><th>Periodo</th></tr></thead>
      <tbody>{objetivos.map((o) => (
        <tr key={o._id}><td>{o.descripcion}</td><td>{o.valorInicial ?? '—'} {o.unidad}</td><td>{o.valorActual ?? '—'}</td><td>{o.valorMeta ?? '—'} {o.unidad}</td>
          <td>{o.progreso != null ? `${o.progreso} %` : '—'}</td><td>{fecha(o.periodo?.inicio)}{o.periodo?.fin ? ` – ${fecha(o.periodo.fin)}` : ''}</td></tr>
      ))}</tbody>
    </table>
  );
}

function Documento() {
  const { id, tipo } = useParams();
  const [params] = useSearchParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    expedienteApi.reporte(id, tipo, { terceros: params.get('terceros') || undefined, consultaId: params.get('consultaId') || undefined })
      .then((d) => { setDoc(d); document.title = `${d.documento.titulo} · ${d.paciente.nombreCompleto}`; })
      .catch((e) => setError(e.message));
  }, [id, tipo, params]);

  if (error) return <main className="documento"><p className="aviso aviso--error" role="alert">{error}</p></main>;
  if (!doc) return <main className="documento"><p>Preparando documento…</p></main>;
  const { documento: d, paciente: p, secciones: s } = doc;

  return (
    <main className="documento">
      <div className="documento__acciones no-imprimir">
        <Link className="boton boton--secundario" to={`/pacientes/${id}/documentos`}><ArrowLeft aria-hidden="true" /> Volver al expediente</Link>
        <button className="boton boton--primario" onClick={() => window.print()}><Printer aria-hidden="true" /> Imprimir / Guardar como PDF</button>
        <span className="campo__ayuda">En el diálogo de impresión elige «Guardar como PDF».</span>
      </div>

      <header className="documento__encabezado">
        <div>
          <p className="documento__marca">La Nutria · Gestión clínica nutricional</p>
          <h1>{d.titulo}</h1>
          {d.paraTerceros && <p className="documento__terceros">Versión para terceros: contiene solo la información necesaria.</p>}
        </div>
        <dl>
          <dt>Emisión</dt><dd>{fechaHora(d.generado)}</dd>
          <dt>Versión del registro</dt><dd>{d.version}</dd>
          <dt>Fórmulas</dt><dd>v{d.versionFormulas}</dd>
        </dl>
      </header>

      <section className="documento__seccion">
        <h2>Identificación</h2>
        <dl className="documento__datos">
          <dt>Paciente</dt><dd>{p.nombreCompleto}</dd>
          <dt>Expediente</dt><dd>{p.folio}</dd>
          <dt>Edad</dt><dd>{p.edad != null ? `${p.edad} años` : '—'}</dd>
          {!d.paraTerceros && <>
            <dt>Sexo</dt><dd>{p.sexo || '—'}</dd>
            <dt>Fecha de nacimiento</dt><dd>{fecha(p.fechaNacimiento)}</dd>
            {p.curp && <><dt>CURP</dt><dd>{p.curp}</dd></>}
            <dt>Contacto</dt><dd>{p.telefono} · {p.correo}</dd>
          </>}
          <dt>Profesional responsable</dt><dd>{d.profesionalResponsable?.nombre || '—'}{d.profesionalResponsable?.cedulaProfesional ? ` · Céd. ${d.profesionalResponsable.cedulaProfesional}` : ''}</dd>
        </dl>
      </section>

      {s.consulta && (
        <section className="documento__seccion">
          <h2>Consulta del {fechaHora(s.consulta.fecha)}</h2>
          <p>{s.consulta.tipo === 'primera_vez' ? 'Primera vez' : 'Subsecuente'} · {s.consulta.motivo || '—'} · {s.consulta.profesional}</p>
          {SOAP.filter(([k]) => s.consulta.soap[k] !== undefined).map(([k, t]) => (<div key={k}><h3>{t}</h3><p className="documento__texto">{s.consulta.soap[k] || '—'}</p></div>))}
          {s.consulta.adendas?.map((a) => <p key={a._id} className="documento__texto"><strong>Adenda ({a.tipo}) · {fechaHora(a.fecha)} · {a.autor}:</strong> {a.texto}</p>)}
          <p className="documento__firma">{s.consulta.estado === 'firmada'
            ? `Firmado electrónicamente por ${s.consulta.firma.nombre}${s.consulta.firma.cedulaProfesional ? ` (céd. ${s.consulta.firma.cedulaProfesional})` : ''} el ${fechaHora(s.consulta.firma.fecha)} · huella ${s.consulta.firma.hash.slice(0, 16)}`
            : 'BORRADOR · nota sin firma'}</p>
          {s.mediciones?.length > 0 && <><h3>Mediciones de la consulta</h3><TablaMediciones mediciones={s.mediciones} /></>}
        </section>
      )}

      {s.antecedentes && (
        <section className="documento__seccion">
          <h2>Antecedentes vigentes</h2>
          {s.antecedentes.length === 0 ? <p>Sin antecedentes registrados.</p> : s.antecedentes.map((g) => (
            <div key={g.categoria}><h3>{g.categoria}</h3>
              <ul>{g.registros.map((a) => <li key={a._id}>{a.descripcion} · {a.estado}{a.fechaInicio ? ` · desde ${fecha(a.fechaInicio)}` : ''}{a.observaciones ? ` · ${a.observaciones}` : ''}</li>)}</ul></div>
          ))}
        </section>
      )}

      {s.diagnosticos?.length > 0 && (
        <section className="documento__seccion">
          <h2>Diagnósticos</h2>
          <ul>{s.diagnosticos.map((x) => <li key={x._id}><strong>{x.problema}</strong>{x.etiologia ? `, relacionado con ${x.etiologia}` : ''}{x.signosSintomas ? `, evidenciado por ${x.signosSintomas}` : ''} · {x.estado} · {fecha(x.fechaDiagnostico)} · {x.profesional}</li>)}</ul>
        </section>
      )}

      {s.indicadores && <section className="documento__seccion"><h2>Indicadores actuales</h2><TablaIndicadores indicadores={s.indicadores} /></section>}

      {s.evaluacion && (
        <section className="documento__seccion">
          <h2>Evaluación nutricional · {fecha(s.evaluacion.fecha)}</h2>
          <table className="doc-tabla">
            <thead><tr><th>Indicador</th><th>Valor</th><th>Origen</th><th>Fórmula</th></tr></thead>
            <tbody>{Object.entries(s.evaluacion.resultados).filter(([, r]) => r && typeof r.valor !== 'object').map(([k, r]) => (
              <tr key={k}><td>{k}</td><td>{r.valor ?? `Sin dato${r.faltantes?.length ? ` (faltan: ${r.faltantes.join(', ')})` : ''}`} {r.valor != null ? r.unidad : ''}</td><td>{ORIGEN[r.origen] || r.origen}</td><td>{r.formula || '—'}</td></tr>
            ))}</tbody>
          </table>
          <p className="documento__nota">Los valores estimados provienen de ecuaciones predictivas y no constituyen diagnóstico.</p>
        </section>
      )}

      {s.plan && (
        <section className="documento__seccion">
          <h2>{s.plan.nombre}</h2>
          <p>Vigencia: {fecha(s.plan.vigencia?.inicio)}{s.plan.vigencia?.fin ? ` – ${fecha(s.plan.vigencia.fin)}` : ''} · Estado: {s.plan.estado}</p>
          {s.plan.requerimientos?.kcal && <p>Energía prescrita: {s.plan.requerimientos.kcal} kcal/día{s.plan.requerimientos.proteinasPct != null && ` · Proteínas ${s.plan.requerimientos.proteinasPct} % · Carbohidratos ${s.plan.requerimientos.carbohidratosPct} % · Grasas ${s.plan.requerimientos.grasasPct} %`}</p>}
          {s.alergias?.length > 0 && <p><strong>Considerar alergias/intolerancias:</strong> {s.alergias.map((a) => a.descripcion).join(', ')}</p>}
          {s.plan.recomendaciones && <><h3>Recomendaciones</h3><p className="documento__texto">{s.plan.recomendaciones}</p></>}
          {s.objetivos?.length > 0 && <><h3>Objetivos que atiende</h3><TablaObjetivos objetivos={s.objetivos} /></>}
        </section>
      )}

      {s.mediciones && !s.consulta && <section className="documento__seccion"><h2>Mediciones antropométricas</h2><TablaMediciones mediciones={s.mediciones} /></section>}
      {s.objetivos && !s.plan && <section className="documento__seccion"><h2>Seguimiento de objetivos</h2><TablaObjetivos objetivos={s.objetivos} /></section>}
      {s.laboratorios?.length > 0 && (
        <section className="documento__seccion">
          <h2>Laboratorios</h2>
          <table className="doc-tabla"><thead><tr><th>Fecha</th><th>Estudio</th><th>Resultado</th><th>Referencia</th><th>Procedencia</th></tr></thead>
            <tbody>{s.laboratorios.map((l) => <tr key={l._id}><td>{fecha(l.fechaMuestra)}</td><td>{l.nombre}</td><td>{l.valor} {l.unidad}</td><td>{l.rangoReferencia?.texto || [l.rangoReferencia?.min, l.rangoReferencia?.max].filter((x) => x != null).join('–') || '—'}</td><td>{l.procedencia}</td></tr>)}</tbody></table>
        </section>
      )}

      <footer className="documento__pie">
        Documento generado por {d.generadoPor?.nombre || '—'} el {fechaHora(d.generado)}. Información confidencial protegida por la legislación de protección de datos personales; su uso está limitado a la finalidad para la que se emite.
      </footer>
    </main>
  );
}

export default Documento;
