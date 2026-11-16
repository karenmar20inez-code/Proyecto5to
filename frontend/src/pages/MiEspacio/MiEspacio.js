import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Utensils, TrendingUp, UserRound, RefreshCw, Lock } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import { SerieTemporal } from '../../components/Graficas/GraficasClinicas';
import { portalApi } from '../../services/api';
import { formatoFecha, resumenCumplimiento } from '../../context/NutriContext';
import { comidasEvaluables } from '../../data/dietas';
import '../Dietas/Dietas.css';
import './MiEspacio.css';

const fechaHora = (f) => new Date(f).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const ESTADO_CITA = { programada: ['Programada', 'info'], realizada: ['Realizada', 'ok'], cancelada: ['Cancelada', 'no'], no_asistio: ['No asistió', 'no'] };
const SECCIONES = [
  ['', 'Inicio', UserRound],
  ['dieta', 'Mi dieta', Utensils],
  ['citas', 'Mis citas', CalendarDays],
  ['progreso', 'Mi progreso', TrendingUp],
];
const INDICADORES = [
  ['pesoKg', 'Peso', 'kg'], ['imc', 'IMC', 'kg/m²'], ['cinturaCm', 'Cintura', 'cm'], ['grasaPorcentaje', 'Grasa corporal', '%'],
  ['masaMuscularKg', 'Masa muscular', 'kg'], ['presionSistolica', 'Presión sistólica', 'mmHg'], ['glucosaMgDl', 'Glucosa', 'mg/dL'],
  ['colesterolTotalMgDl', 'Colesterol total', 'mg/dL'], ['trigliceridosMgDl', 'Triglicéridos', 'mg/dL'], ['hba1cPct', 'HbA1c', '%'],
];

/* Aviso cuando el nutriólogo aún no comparte una sección */
const NoCompartido = ({ que }) => (
  <section className="panel vacio mi-espacio__bloqueado">
    <Lock aria-hidden="true" />
    <p>Tu nutriólogo aún no ha compartido {que} contigo. Puedes pedírselo en tu próxima consulta.</p>
  </section>
);

function Inicio({ datos }) {
  const { paciente, responsable, consultorio, proximaCita, progreso, dieta, portal, plan, cumplimiento } = datos;
  const ultimo = [...progreso].reverse().find((m) => m.pesoKg);
  const primero = progreso.find((m) => m.pesoKg);
  const cambio = ultimo && primero && ultimo !== primero ? Math.round((ultimo.pesoKg - primero.pesoKg) * 10) / 10 : null;
  const resumen = dieta && portal.cumplimiento ? resumenCumplimiento(
    Object.fromEntries(cumplimiento.map((r) => [`yo|${dieta.id}|${r.fecha}|${r.tiempo}`, r.estado])), 'yo', dieta,
  ) : null;

  return (
    <>
      <div className="rejilla-kpi">
        <div className="kpi"><span>Próxima cita</span><strong className="mi-espacio__kpi-texto">{proximaCita ? fechaHora(proximaCita.fechaHora) : 'Sin cita programada'}</strong></div>
        <div className="kpi"><span>Peso actual</span><strong>{ultimo ? `${ultimo.pesoKg} kg` : '—'}</strong>{cambio != null && <span className="indicador__pie">{cambio > 0 ? '+' : ''}{cambio} kg desde tu primera medición</span>}</div>
        <div className="kpi"><span>Mi plan</span><strong className="mi-espacio__kpi-texto">{dieta?.nombre || (portal.dieta ? 'Sin dieta asignada' : 'No compartido')}</strong></div>
        <div className="kpi"><span>Cumplimiento</span><strong>{resumen?.porcentaje != null ? `${resumen.porcentaje}%` : '—'}</strong>{resumen && <span className="indicador__pie">{resumen.registrados} de {resumen.posibles} comidas registradas</span>}</div>
      </div>

      <div className="rejilla-aurea">
        <section className="panel">
          <h2>Mis datos</h2>
          <p className="panel-descripcion">Si algún dato no es correcto, avisa a tu consultorio para corregirlo.</p>
          <dl className="datos">
            <dt>Nombre</dt><dd>{paciente.nombreCompleto}</dd>
            <dt>Fecha de nacimiento</dt><dd>{paciente.fechaNacimiento ? formatoFecha(String(paciente.fechaNacimiento).slice(0, 10)) : '—'}{paciente.edad != null && ` · ${paciente.edad} años`}</dd>
            <dt>Correo</dt><dd>{paciente.correo}</dd>
            <dt>Teléfono</dt><dd>{paciente.telefono}</dd>
            <dt>Objetivo</dt><dd>{paciente.objetivo || '—'}</dd>
            <dt>Expediente</dt><dd>{datos.expediente.folio}</dd>
          </dl>
        </section>
        <div className="pila">
          <section className="panel">
            <h2>Mi nutriólogo(a)</h2>
            {responsable ? (
              <dl className="datos">
                <dt>Nombre</dt><dd>{responsable.nombre}</dd>
                {responsable.cedulaProfesional && <><dt>Cédula</dt><dd>{responsable.cedulaProfesional}</dd></>}
                {responsable.especialidad && <><dt>Especialidad</dt><dd>{responsable.especialidad}</dd></>}
                {consultorio && <><dt>Consultorio</dt><dd>{consultorio.nombre}{consultorio.telefono ? ` · ${consultorio.telefono}` : ''}</dd></>}
              </dl>
            ) : <p className="vacio">Aún no tienes un nutriólogo asignado.</p>}
          </section>
          {portal.recomendaciones && plan?.recomendaciones && (
            <section className="panel">
              <h2>Recomendaciones</h2>
              <p className="panel-descripcion">{plan.nombre}</p>
              <p className="mi-espacio__texto">{plan.recomendaciones}</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function MiDieta({ datos }) {
  const { dieta, portal, plan, cumplimiento } = datos;
  const [diaActivo, setDiaActivo] = useState('');
  const registros = useMemo(() => Object.fromEntries((cumplimiento || []).map((r) => [`${r.fecha}|${r.tiempo}`, r.estado])), [cumplimiento]);
  if (!portal.dieta) return <NoCompartido que="tu dieta" />;
  if (!dieta) return <section className="panel vacio">Aún no tienes una dieta asignada.</section>;
  const dia = dieta.dias.find((d) => d.fecha === diaActivo) || dieta.dias[0];
  const ETIQUETA = { cumplio: ['Cumplida', 'ok'], parcial: ['Parcial', 'medio'], no: ['No cumplida', 'no'] };

  return (
    <div className="pila">
      <section className="panel">
        <div className="panel-encabezado">
          <div>
            <h2>{dieta.nombre}</h2>
            <p className="panel-descripcion">
              {formatoFecha(dieta.inicio, { weekday: 'long', day: 'numeric', month: 'long' })} – {formatoFecha(dieta.fin, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button className="boton boton--secundario no-imprimir" onClick={() => window.print()}>Imprimir</button>
        </div>
        <div className="pestanas" role="tablist">
          {dieta.dias.map((d) => (
            <button key={d.fecha} role="tab" aria-selected={d.fecha === dia.fecha}
              className={`pestana${d.fecha === dia.fecha ? ' pestana--activa' : ''}`} onClick={() => setDiaActivo(d.fecha)}>
              {d.dia} <small>{formatoFecha(d.fecha, { day: 'numeric' })}</small>
            </button>
          ))}
        </div>
        {comidasEvaluables(dia).length === 0 ? (
          <div className="comida comida--pendiente vacio">{dia.pendiente || 'Sin alimentos registrados para este día.'}</div>
        ) : (
          <div className="comidas-grid">
            {comidasEvaluables(dia).map((c, n) => {
              const estado = portal.cumplimiento ? ETIQUETA[registros[`${dia.fecha}|${c.tiempo}`]] : null;
              return (
                <article key={`${c.tiempo}-${n}`} className="comida">
                  <span className="comida__tiempo">{c.tiempo}{estado && <span className={`insignia insignia--${estado[1]}`} style={{ marginLeft: 8 }}>{estado[0]}</span>}</span>
                  <h3>{c.platillo}</h3>
                  <ul>
                    {c.ingredientes.map((ing, k) => <li key={k}><span>{ing.alimento}</span><span>{ing.cantidad || 'Al gusto'}</span></li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
        {dieta.nota && <p className="aviso"><strong>Nota:</strong> {dieta.nota}</p>}
      </section>
      {portal.recomendaciones && plan?.recomendaciones && (
        <section className="panel">
          <h2>Recomendaciones de tu plan</h2>
          <p className="mi-espacio__texto">{plan.recomendaciones}</p>
        </section>
      )}
    </div>
  );
}

function MisCitas({ datos }) {
  if (!datos.portal.citas) return <NoCompartido que="tus citas" />;
  const ahora = Date.now();
  const proximas = datos.citas.filter((c) => new Date(c.fechaHora) >= ahora).sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));
  const pasadas = datos.citas.filter((c) => new Date(c.fechaHora) < ahora);
  const Lista = ({ citas, vacio }) => (citas.length ? (
    <ul className="lista-registros">
      {citas.map((c) => (
        <li key={c._id}>
          <div>
            <div className="lista-registros__titulo">{fechaHora(c.fechaHora)}</div>
            <div className="lista-registros__meta">{c.motivo || 'Consulta de seguimiento'} · {c.duracionMin} min</div>
          </div>
          <span className={`insignia insignia--${ESTADO_CITA[c.estado]?.[1] || ''}`}>{ESTADO_CITA[c.estado]?.[0] || c.estado}</span>
        </li>
      ))}
    </ul>
  ) : <p className="vacio">{vacio}</p>);
  return (
    <div className="rejilla-2">
      <section className="panel"><h2>Próximas citas</h2><Lista citas={proximas} vacio="No tienes citas programadas." /></section>
      <section className="panel"><h2>Citas anteriores</h2><Lista citas={pasadas} vacio="Aún no hay citas anteriores." /></section>
    </div>
  );
}

function MiProgreso({ datos }) {
  const { portal, progreso } = datos;
  if (!portal.progreso && !portal.indicadoresClinicos) return <NoCompartido que="tus mediciones" />;
  const disponibles = INDICADORES.filter(([c]) => progreso.some((m) => m[c] != null));
  if (!disponibles.length) return <section className="panel vacio">Aún no hay mediciones registradas.</section>;
  return (
    <div className="rejilla-2">
      {disponibles.map(([campo, nombre, unidad]) => (
        <section key={campo} className="panel">
          <h2>{nombre}</h2>
          <SerieTemporal unidad={unidad} alto={220}
            series={[{ nombre, puntos: progreso.filter((m) => m[campo] != null).map((m) => ({ t: new Date(m.fecha).getTime(), valor: m[campo] })) }]} />
        </section>
      ))}
    </div>
  );
}

/** Espacio propio del paciente: solo su información y lo que su nutriólogo autorizó */
function MiEspacio() {
  const { seccion = '' } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const cargar = () => { setError(''); portalApi.miEspacio().then(setDatos).catch((e) => setError(e.message)); };
  useEffect(cargar, []);

  const Contenido = { '': Inicio, dieta: MiDieta, citas: MisCitas, progreso: MiProgreso }[seccion] || Inicio;
  const titulo = SECCIONES.find(([k]) => k === seccion)?.[1] || 'Inicio';

  return (
    <Layout titulo={seccion ? titulo : `Hola${datos ? `, ${datos.paciente.nombreCompleto.split(' ')[0]}` : ''}`}
      subtitulo="Tu espacio personal en La Nutria. Solo tú puedes ver esta información.">
      <div className="pestanas no-imprimir" role="tablist" aria-label="Secciones de mi espacio">
        {SECCIONES.map(([k, t, Icono]) => (
          <Link key={k || 'inicio'} to={`/mi-espacio${k ? `/${k}` : ''}`} role="tab" aria-selected={seccion === k}
            className={`pestana${seccion === k ? ' pestana--activa' : ''}`} style={{ textDecoration: 'none' }}>
            <Icono size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {t}
          </Link>
        ))}
      </div>
      {error && (
        <p className="aviso aviso--error" role="alert">
          {error} <button className="boton boton--secundario boton--chico" onClick={cargar}><RefreshCw aria-hidden="true" /> Reintentar</button>
        </p>
      )}
      {!datos && !error && <div className="esqueleto" style={{ height: 320 }} />}
      {datos && <Contenido datos={datos} />}
    </Layout>
  );
}

export default MiEspacio;
