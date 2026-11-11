import { Link } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import SelectorPaciente, { usePacienteSeleccionado } from '../../components/SelectorPaciente/SelectorPaciente';
import { useNutri, resumenCumplimiento, formatoFecha, nombreCompleto } from '../../context/NutriContext';
import { buscarDieta } from '../../data/dietas';
import './Cumplimiento.css';

const TIEMPOS = ['Al despertar', 'Desayuno', 'Medio día', 'Comida', 'Media tarde', 'Cena'];

/* Ciclo al hacer clic: sin registro → cumplió → parcial → no cumplió → sin registro */
const SIGUIENTE = { '': 'cumplio', cumplio: 'parcial', parcial: 'no', no: '' };
const ETIQUETA = { cumplio: '✓', parcial: '½', no: '✕', '': '·' };
const TEXTO = { cumplio: 'Cumplió', parcial: 'Parcial', no: 'No cumplió', '': 'Sin registro' };

const tono = (pct) => (pct == null ? '' : pct >= 80 ? 'ok' : pct >= 50 ? 'medio' : 'no');

function Cumplimiento() {
  const { cumplimiento, marcarCumplimiento } = useNutri();
  const [paciente, seleccionar] = usePacienteSeleccionado();
  const dieta = paciente ? buscarDieta(paciente.dietaId) : null;

  const selector = <SelectorPaciente paciente={paciente} onCambio={seleccionar} />;

  if (!paciente || !dieta) {
    return (
      <Layout titulo="Cumplimiento" acciones={selector}>
        <section className="panel vacio">
          {paciente
            ? <>{nombreCompleto(paciente)} no tiene una dieta asignada. <Link to="/dietas" className="celda-fuerte">Asignar una dieta</Link></>
            : <>Aún no hay pacientes. <Link to="/pacientes" className="celda-fuerte">Registrar paciente</Link></>}
        </section>
      </Layout>
    );
  }

  const estadoDe = (fecha, tiempo) =>
    cumplimiento[`${paciente.id}|${dieta.id}|${fecha}|${tiempo}`] || '';

  const semana = resumenCumplimiento(cumplimiento, paciente.id, dieta);
  const porDia = dieta.dias.map((d) => ({
    ...d,
    resumen: resumenCumplimiento(cumplimiento, paciente.id, dieta, d.fecha),
  }));
  const conRegistro = porDia.filter((d) => d.resumen.porcentaje != null);
  const mejor = conRegistro.reduce((a, b) => (!a || b.resumen.porcentaje > a.resumen.porcentaje ? b : a), null);
  const tiempos = TIEMPOS.filter((t) => dieta.dias.some((d) => d.comidas.some((c) => c.tiempo === t)));

  return (
    <Layout titulo="Cumplimiento" acciones={selector}>
      <div className="rejilla-kpi">
        <div className="kpi"><span>Cumplimiento semanal</span><strong>{semana.porcentaje ?? '—'}{semana.porcentaje != null && '%'}</strong></div>
        <div className="kpi"><span>Comidas registradas</span><strong>{semana.registrados}/{semana.posibles}</strong></div>
        <div className="kpi"><span>Mejor día</span><strong>{mejor ? mejor.dia : '—'}</strong></div>
        <div className="kpi"><span>Plan</span><strong style={{ fontSize: 'var(--fs-subtitulo-sm)' }}>{dieta.nombre}</strong></div>
      </div>

      <section className="panel">
        <div className="panel-encabezado">
          <div>
            <h2>Registro semanal</h2>
            <p className="panel-descripcion">
              Haz clic en cada casilla para marcar: cumplió → parcial → no cumplió → sin registro.
            </p>
          </div>
          <div className="leyenda">
            {['cumplio', 'parcial', 'no'].map((e) => (
              <span key={e}><i className={`marca marca--${e}`}>{ETIQUETA[e]}</i>{TEXTO[e]}</span>
            ))}
          </div>
        </div>

        <div className="tabla-scroll">
          <table className="tabla tabla-cumplimiento">
            <thead>
              <tr>
                <th>Tiempo</th>
                {dieta.dias.map((d) => (
                  <th key={d.fecha}>
                    {d.dia}
                    <small>{formatoFecha(d.fecha, { day: 'numeric', month: 'short' })}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiempos.map((t) => (
                <tr key={t}>
                  <td className="celda-fuerte">{t}</td>
                  {dieta.dias.map((d) => {
                    const comida = d.comidas.find((c) => c.tiempo === t);
                    if (!comida || !comida.platillo) return <td key={d.fecha} className="sin-plan">—</td>;
                    const estado = estadoDe(d.fecha, t);
                    return (
                      <td key={d.fecha}>
                        <button
                          className={`marca marca--${estado || 'vacia'}`}
                          title={`${comida.platillo} · ${TEXTO[estado]}`}
                          aria-label={`${d.dia}, ${t}: ${TEXTO[estado]}`}
                          onClick={() => marcarCumplimiento(paciente.id, dieta.id, d.fecha, t, SIGUIENTE[estado])}
                        >
                          {ETIQUETA[estado]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Del día</td>
                {porDia.map((d) => (
                  <td key={d.fecha}>
                    {d.resumen.porcentaje != null
                      ? <span className={`insignia insignia--${tono(d.resumen.porcentaje)}`}>{d.resumen.porcentaje}%</span>
                      : '—'}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Historial de cumplimiento</h2>
        <p className="panel-descripcion">Avance diario de {nombreCompleto(paciente)}.</p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Día</th><th>Registradas</th><th style={{ width: '38%' }}>Avance</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              {porDia.map((d) => (
                <tr key={d.fecha}>
                  <td className="celda-fuerte">{d.dia} {formatoFecha(d.fecha, { day: 'numeric', month: 'short' })}</td>
                  <td>{d.resumen.posibles ? `${d.resumen.registrados} de ${d.resumen.posibles}` : 'Sin plan'}</td>
                  <td>
                    <div className="progreso"><span style={{ width: `${d.resumen.porcentaje ?? 0}%` }} /></div>
                  </td>
                  <td>
                    {d.resumen.porcentaje != null
                      ? <span className={`insignia insignia--${tono(d.resumen.porcentaje)}`}>{d.resumen.porcentaje}%</span>
                      : <span className="insignia">Pendiente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}

export default Cumplimiento;
