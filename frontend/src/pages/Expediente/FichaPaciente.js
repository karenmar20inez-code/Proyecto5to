import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Link, useParams, Navigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CalendarCheck, UserRound, FileText, Stethoscope, Pill, RefreshCw,
} from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import Indicador, { Origen } from '../../components/Indicador/Indicador';
import { expedienteApi } from '../../services/api';
import { formatoFecha } from '../../context/NutriContext';
import Resumen from './pestanas/Resumen';
import Historia from './pestanas/Historia';
import Consultas from './pestanas/Consultas';
import Antropometria from './pestanas/Antropometria';
import Laboratorios from './pestanas/Laboratorios';
import Diagnosticos from './pestanas/Diagnosticos';
import PlanNutricional from './pestanas/PlanNutricional';
import Objetivos from './pestanas/Objetivos';
import Evolucion from './pestanas/Evolucion';
import Documentos from './pestanas/Documentos';
import './FichaPaciente.css';

export const PESTANAS = [
  ['resumen', 'Resumen clínico', Resumen],
  ['historia', 'Historia clínica', Historia],
  ['consultas', 'Consultas y notas SOAP', Consultas],
  ['antropometria', 'Antropometría', Antropometria],
  ['laboratorios', 'Laboratorios', Laboratorios],
  ['diagnosticos', 'Diagnósticos', Diagnosticos],
  ['plan', 'Plan nutricional', PlanNutricional],
  ['objetivos', 'Objetivos', Objetivos],
  ['evolucion', 'Evolución', Evolucion],
  ['documentos', 'Documentos', Documentos],
];

const ESTADO_SEGUIMIENTO = {
  al_dia: ['Al día', 'ok'], programado: ['Cita programada', 'info'], pendiente: ['Seguimiento pendiente', 'aviso'], sin_registros: ['Sin registros', ''],
};

/* Contexto de la ficha: las pestañas comparten paciente, ficha y recarga */
const FichaContext = createContext(null);
export const useFicha = () => useContext(FichaContext);

const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fecha = (f) => (f ? formatoFecha(String(f).slice(0, 10)) : '—');

function Delta({ dato, unidad }) {
  if (!dato?.anterior) return null;
  const d = dato.anterior.delta;
  return <span className="delta">{d > 0 ? '+' : ''}{d} {unidad} vs {fecha(dato.anterior.fecha)}</span>;
}

function FichaPaciente() {
  const { id, pestana = 'resumen' } = useParams();
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setFicha(await expedienteApi.ficha(id));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { recargar(); }, [recargar]);

  const actual = PESTANAS.find(([clave]) => clave === pestana);
  if (!actual) return <Navigate to={`/pacientes/${id}`} replace />;
  const Contenido = actual[2];

  if (error && !ficha) {
    return (
      <Layout titulo="Expediente clínico">
        <section className="panel vacio" role="alert">
          {error}{' '}
          <button className="boton boton--secundario boton--chico" onClick={recargar}><RefreshCw aria-hidden="true" /> Reintentar</button>
        </section>
      </Layout>
    );
  }

  const p = ficha?.paciente;
  const ind = ficha?.indicadores;
  const [textoSeg, tonoSeg] = ESTADO_SEGUIMIENTO[ficha?.encabezado.estadoSeguimiento] || ['—', ''];
  const alergias = ficha?.ficha.alergias || [];
  const altas = (ficha?.alertas || []).filter((a) => a.prioridad === 'alta');

  return (
    <Layout>
      <FichaContext.Provider value={{ pacienteId: id, ficha, recargar, cargando }}>
        {/* ---------- ENCABEZADO CLÍNICO ---------- */}
        <header className="ficha-encabezado panel" aria-busy={cargando}>
          {!ficha ? <div className="esqueleto" style={{ height: 88 }} /> : (
            <>
              <div className="ficha-encabezado__identidad">
                <div className="ficha-encabezado__avatar" aria-hidden="true">
                  {p.nombreCompleto.split(/\s+/).slice(0, 2).map((x) => x[0]).join('')}
                </div>
                <div>
                  <h1>{p.nombreCompleto}</h1>
                  <p className="ficha-encabezado__meta">
                    <span>{p.edadActual != null ? `${p.edadActual} años` : 'Edad no registrada'}</span>
                    {p.sexo && <span>{p.sexo}</span>}
                    <span>Expediente <strong>{ficha.expediente.folio}</strong></span>
                    <span className={`insignia insignia--${p.estado === 'activo' ? 'ok' : ''}`}>{p.estado === 'activo' ? 'Activo' : 'Baja'}</span>
                    <span className={`insignia insignia--${tonoSeg}`}>{textoSeg}</span>
                  </p>
                </div>
              </div>

              <dl className="ficha-encabezado__datos">
                <div><dt><Stethoscope aria-hidden="true" /> Última consulta</dt><dd>{ficha.encabezado.ultimaConsulta ? fecha(ficha.encabezado.ultimaConsulta.fecha) : 'Sin consultas'}</dd></div>
                <div><dt><CalendarClock aria-hidden="true" /> Próxima consulta</dt><dd>{ficha.encabezado.proximaCita ? fechaHora(ficha.encabezado.proximaCita.fecha) : 'Sin programar'}</dd></div>
                <div><dt><UserRound aria-hidden="true" /> Responsable</dt><dd>{ficha.expediente.responsable?.nombre || '—'}</dd></div>
                <div><dt><CalendarCheck aria-hidden="true" /> Ingreso</dt><dd>{fecha(ficha.expediente.fechaIngreso)}</dd></div>
              </dl>

              {(alergias.length > 0 || ficha.ficha.medicamentos.length > 0 || altas.length > 0) && (
                <div className="ficha-encabezado__alertas" role="note" aria-label="Información clínica relevante">
                  {alergias.map((a) => (
                    <span key={a._id} className="insignia insignia--peligro"><AlertTriangle aria-hidden="true" size={12} /> {a.categoria === 'alergia' ? 'Alergia' : 'Intolerancia'}: {a.descripcion}</span>
                  ))}
                  {!alergias.length && ficha.ficha.alergiasNegadas && <span className="insignia">Niega alergias</span>}
                  {ficha.ficha.medicamentos.slice(0, 3).map((m) => (
                    <span key={m._id} className="insignia insignia--info"><Pill aria-hidden="true" size={12} /> {m.descripcion}</span>
                  ))}
                  {altas.length > 0 && (
                    <Link to={`/pacientes/${id}/resumen`} className="insignia insignia--peligro">{altas.length} alerta(s) de prioridad alta</Link>
                  )}
                </div>
              )}
            </>
          )}
        </header>

        {/* ---------- INDICADORES PRINCIPALES ---------- */}
        <section className="rejilla-kpi ficha-kpis" aria-label="Indicadores principales">
          {!ind ? Array.from({ length: 7 }, (_, i) => <div key={i} className="kpi esqueleto" style={{ height: 112 }} />) : (
            <>
              <Indicador titulo="Peso actual" valor={ind.peso.valor} unidad="kg" origen="medido"
                detalle={<>{fecha(ind.peso.fecha)} · {ind.peso.metodo}<br /><Delta dato={ind.peso} unidad="kg" /></>} />
              <Indicador titulo="IMC" resultado={ind.imc}
                detalle={ind.imc.valor != null && <>{fecha(ind.imc.fecha)} · {ind.imc.metodo}{ind.imc.categoriaReferencia && <><br />Ref. OMS: {ind.imc.categoriaReferencia}</>}</>} />
              <Indicador titulo="Cintura" valor={ind.cintura.valor} unidad="cm" origen="medido"
                detalle={ind.cintura.valor != null && <>{fecha(ind.cintura.fecha)} · {ind.cintura.metodo}<br /><Delta dato={ind.cintura} unidad="cm" /></>} />
              <Indicador titulo="Grasa corporal" valor={ind.grasa.valor} unidad="%" origen="medido"
                detalle={ind.grasa.valor != null ? <>{fecha(ind.grasa.fecha)} · {ind.grasa.metodo}{ind.masaMuscular.valor != null && <><br />Masa muscular {ind.masaMuscular.valor} kg</>}</> : 'Sin medición de composición'} />
              <Indicador titulo="Requerimiento energético" resultado={ind.requerimientoEnergetico} decimales={0}
                detalle={ind.requerimientoEnergetico.valor != null && <>{fecha(ind.requerimientoEnergetico.fecha)} · {ind.requerimientoEnergetico.metodo}</>} />
              <Indicador titulo="Adherencia registrada" valor={ind.adherencia.valor?.porcentaje ?? null} unidad="%" origen="calculado"
                detalle={ind.adherencia.valor ? `${ind.adherencia.valor.registradas} comidas · ${ind.adherencia.periodo}` : `Sin registros · ${ind.adherencia.periodo}`} />
              <Indicador titulo="Progreso de objetivos" valor={ind.progresoObjetivos.valor} unidad="%" origen="calculado"
                detalle={`${ind.progresoObjetivos.objetivos} objetivo(s) medible(s)`} />
            </>
          )}
        </section>
        <p className="nota-clinica">
          <Origen origen="medido" /> capturado <Origen origen="calculado" /> fórmula sobre datos medidos <Origen origen="estimado" /> ecuación predictiva
          <Origen origen="prescrito" /> indicado por el profesional <Origen origen="ajustado" /> sustituido por valoración profesional · Fórmulas v{ficha?.versionFormulas || '—'}
        </p>

        {/* ---------- PESTAÑAS ---------- */}
        <nav className="ficha-pestanas no-imprimir" aria-label="Secciones del expediente">
          {PESTANAS.map(([clave, texto]) => (
            <NavLink key={clave} to={`/pacientes/${id}/${clave}`} end
              className={({ isActive }) => `ficha-pestana${isActive || (clave === 'resumen' && pestana === 'resumen') ? ' ficha-pestana--activa' : ''}`}
              aria-current={pestana === clave ? 'page' : undefined}>
              {texto}
              {clave === 'resumen' && ficha?.alertas.length > 0 && <span className="ficha-pestana__contador">{ficha.alertas.length}</span>}
            </NavLink>
          ))}
          <Link to={`/pacientes/${id}/documentos`} className="boton boton--secundario boton--chico ficha-pestanas__accion">
            <FileText aria-hidden="true" /> Documentos
          </Link>
        </nav>

        <div className="ficha-contenido">
          {ficha ? <Contenido /> : <div className="esqueleto" style={{ height: 320 }} />}
        </div>
      </FichaContext.Provider>
    </Layout>
  );
}

export default FichaPaciente;
