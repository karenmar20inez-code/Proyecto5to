import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiRefreshCw } from 'react-icons/fi';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';

import Card from '../../components/Card/card';
import Layout from '../../components/Layout/Layout';
import GraficaDashboard from '../../components/GraficaDashboard';
import PanelGrafica from '../../components/Graficas/PanelGrafica';
import { opciones, linea, barras, COLORES, SERIE_CATEGORICA } from '../../components/Graficas/graficas';
import { estadisticasApi } from '../../services/api';

import './Dashboard.css';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/* $dayOfWeek de MongoDB: 1 = domingo … 7 = sábado → orden lunes-domingo */
const DIAS = [[2, 'Lun'], [3, 'Mar'], [4, 'Mié'], [5, 'Jue'], [6, 'Vie'], [7, 'Sáb'], [1, 'Dom']];
const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const sumar = (a) => a.reduce((x, y) => x + (y || 0), 0);

function MapaCalor({ celdas }) {
  const maximo = Math.max(1, ...celdas.map((c) => c.total));
  const valor = (d, h) => celdas.find((c) => c.dia === d && c.hora === h)?.total || 0;
  return (
    <div className="tabla-scroll">
      <div className="mapa-calor" style={{ gridTemplateColumns: `2.6rem repeat(${HORAS.length}, minmax(1.4rem, 1fr))`, minWidth: 420 }}>
        <span />
        {HORAS.map((h) => <span key={h} className="mapa-calor__eje">{h}</span>)}
        {DIAS.map(([d, nombre]) => (
          <React.Fragment key={d}>
            <span className="mapa-calor__eje">{nombre}</span>
            {HORAS.map((h) => {
              const t = valor(d, h);
              return (
                <span key={h} className="mapa-calor__celda" title={`${nombre} ${h}:00 · ${t} cita(s)`}
                  style={t ? { background: `rgba(255, 255, 255, ${0.12 + (t / maximo) * 0.78})` } : undefined} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await estadisticasApi.resumen(anio));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const k = datos?.kpis;
  const m = datos?.mensual;
  const espera = cargando && !datos;
  const sinDatos = (arr) => !arr || arr.every((x) => !x);

  const selectorAnio = (
    <select className="selector" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año" style={{ width: 'auto' }}>
      {[anioActual, anioActual - 1, anioActual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  );

  return (
    <Layout titulo="Dashboard" acciones={
      <>
        {selectorAnio}
        <button className="boton boton--secundario" onClick={cargar} disabled={cargando}><FiRefreshCw /> {cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </>
    }>
      {error && (
        <p className="aviso aviso--error" role="alert" style={{ marginBottom: 'var(--esp-lg)' }}>
          {error}
        </p>
      )}

      {/* INDICADORES KPI (componente Card existente) */}
      <div className="cards-grid">
        <Card titulo="PACIENTES ACTIVOS" valor={k ? k.activos : '—'} descripcion={k ? `${k.inactivos} inactivos (baja).` : 'Cargando…'} />
        <Card titulo={`NUEVOS ${anio}`} valor={k ? k.nuevosAnio : '—'} descripcion="Pacientes registrados en el año." />
        <Card titulo="CITAS PRÓXIMAS" valor={k ? k.citasProximas : '—'} descripcion={k ? `${k.citasRealizadasAnio} realizadas y ${k.citasCanceladasAnio} canceladas en ${anio}.` : 'Cargando…'} />
        <Card titulo="ASISTENCIA" valor={k ? pct(k.asistenciaAnio) : '—'} descripcion="Realizadas / (realizadas + inasistencias)." />
        <Card titulo="ADHERENCIA REGISTRADA" valor={k ? pct(k.adherenciaAnio) : '—'} descripcion="Promedio de cumplimiento de planes en el año." />
        <Card titulo="PENDIENTES DE SEGUIMIENTO" valor={k ? k.pendientesSeguimiento : '—'} descripcion="Activos sin cita próxima ni medición en 30 días." />
        <Card titulo={`MEDICIONES ${anio}`} valor={k ? k.medicionesAnio : '—'} descripcion="Mediciones clínicas vigentes registradas." />
        <Card titulo="ALERTAS" valor={datos ? datos.alertas.length : '—'} descripcion="Pacientes con alguna bandera de seguimiento." />
      </div>

      <div className="rejilla-graficas">
        <PanelGrafica titulo="Pacientes activos e inactivos" cargando={espera} vacio={k && !k.activos && !k.inactivos}>
          {k && (
            <Doughnut options={{ ...opciones({ ejesVisibles: false }), cutout: '61.8%' }} data={{
              labels: ['Activos', 'Baja'],
              datasets: [{ data: [k.activos, k.inactivos], backgroundColor: [COLORES.verdeClaro, COLORES.arena], borderColor: 'rgba(11,42,29,0.9)', borderWidth: 2 }],
            }} />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Pacientes nuevos por mes" descripcion={`Altas registradas en ${anio}.`} cargando={espera} vacio={m && sinDatos(m.nuevosPacientes)}>
          {m && <Bar options={opciones({ leyenda: false })} data={{ labels: MESES, datasets: [barras('Nuevos', m.nuevosPacientes, COLORES.blanco)] }} />}
        </PanelGrafica>

        <PanelGrafica className="panel-grafica--ancho" titulo="Consultas por mes" descripcion="Programadas, realizadas, canceladas e inasistencias."
          cargando={espera} vacio={m && sinDatos([...m.citas.programada, ...m.citas.realizada, ...m.citas.cancelada, ...m.citas.no_asistio])}>
          {m && (
            <Bar options={opciones({ apilado: true })} data={{
              labels: MESES,
              datasets: [
                barras('Realizadas', m.citas.realizada, COLORES.verdeClaro),
                barras('Programadas', m.citas.programada, COLORES.blanco),
                barras('Canceladas', m.citas.cancelada, COLORES.arena),
                barras('No asistió', m.citas.no_asistio, COLORES.coral),
              ],
            }} />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Asistencia y adherencia" descripcion="Porcentajes mensuales calculados."
          cargando={espera} vacio={m && sinDatos([...m.asistencia, ...m.adherencia])}>
          {m && (
            <Line options={opciones({ unidad: '%', extra: { y: { min: 0, max: 100 } } })} data={{
              labels: MESES,
              datasets: [linea('Asistencia', m.asistencia, COLORES.blanco), linea('Adherencia', m.adherencia, COLORES.verdeClaro)],
            }} />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Evolución de indicadores agregados" descripcion="Promedio mensual de IMC y % de cambio de peso (evaluaciones vigentes)."
          cargando={espera} vacio={m && sinDatos([...m.imcPromedio, ...m.cambioPesoPromedio])}>
          {m && (
            <Line
              options={{
                ...opciones(),
                scales: {
                  x: { ticks: { color: COLORES.arena }, grid: { color: COLORES.rejilla } },
                  y: { position: 'left', ticks: { color: COLORES.arena }, grid: { color: COLORES.rejilla }, title: { display: true, text: 'IMC (kg/m²)', color: COLORES.arena } },
                  y2: { position: 'right', ticks: { color: COLORES.arena }, grid: { drawOnChartArea: false }, title: { display: true, text: '% cambio de peso', color: COLORES.arena } },
                },
              }}
              data={{
                labels: MESES,
                datasets: [
                  linea('IMC promedio', m.imcPromedio, COLORES.blanco, { yAxisID: 'y' }),
                  linea('Cambio de peso promedio (%)', m.cambioPesoPromedio, COLORES.arena, { yAxisID: 'y2' }),
                ],
              }}
            />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Distribución de objetivos nutricionales" cargando={espera} vacio={datos && !datos.objetivos.length}>
          {datos && (
            <Bar options={{ ...opciones({ leyenda: false }), indexAxis: 'y' }} data={{
              labels: datos.objetivos.map((o) => o.objetivo),
              datasets: [barras('Pacientes', datos.objetivos.map((o) => o.total), datos.objetivos.map((_, i) => SERIE_CATEGORICA[i % SERIE_CATEGORICA.length]))],
            }} />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Histograma de IMC" descripcion="Último IMC calculado de cada paciente (cortes OMS de referencia)."
          cargando={espera} vacio={datos && !datos.histogramaImc.some((b) => b.total)}>
          {datos && (
            <Bar options={opciones({ leyenda: false })} data={{
              labels: datos.histogramaImc.map((b) => b.etiqueta),
              datasets: [barras('Pacientes', datos.histogramaImc.map((b) => b.total), COLORES.verdeClaro, { categoryPercentage: 1, barPercentage: 0.96, maxBarThickness: undefined })],
            }} />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Adherencia vs cambio de peso" descripcion="Cada punto es un paciente: adherencia registrada (%) frente a su último % de cambio de peso."
          cargando={espera} vacio={datos && !datos.dispersion.length} mensajeVacio="Se necesitan pacientes con adherencia registrada y al menos una evaluación de peso.">
          {datos && (
            <Scatter
              options={{
                ...opciones({ leyenda: false }),
                interaction: { mode: 'nearest', intersect: true },
                scales: {
                  x: { min: 0, max: 100, ticks: { color: COLORES.arena }, grid: { color: COLORES.rejilla }, title: { display: true, text: 'Adherencia (%)', color: COLORES.arena } },
                  y: { ticks: { color: COLORES.arena }, grid: { color: COLORES.rejilla }, title: { display: true, text: 'Cambio de peso (%)', color: COLORES.arena } },
                },
              }}
              data={{ datasets: [{ label: 'Pacientes', data: datos.dispersion.map((d) => ({ x: d.adherencia, y: d.cambioPeso })), backgroundColor: COLORES.blanco, pointRadius: 6 }] }}
            />
          )}
        </PanelGrafica>

        <PanelGrafica titulo="Mapa de calor de consultas" descripcion={`Citas programadas y realizadas por día y hora (${datos?.zonaHoraria || ''}).`}
          cargando={espera} vacio={datos && !datos.mapaCalor.length} alto={230}>
          {datos && <MapaCalor celdas={datos.mapaCalor} />}
        </PanelGrafica>

        {/* ALERTAS */}
        <section className="panel">
          <h2>Alertas de seguimiento</h2>
          <p className="panel-descripcion">Banderas operativas para revisar; no son diagnósticos.</p>
          {espera ? <div className="esqueleto" style={{ height: 160 }} /> : datos?.alertas.length ? (
            <ul className="lista-alertas">
              {datos.alertas.slice(0, 12).map((a) => (
                <li key={a.pacienteId}>
                  <Link to={`/pacientes/${a.pacienteId}/analisis`}>{a.nombreCompleto}</Link>
                  <span className="lista-alertas__banderas">
                    {a.banderas.map((b) => (
                      <span key={b.tipo} className={`insignia insignia--${b.tipo === 'adherencia_baja' || b.tipo === 'inasistencia' ? 'no' : 'medio'}`}>{b.texto}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="vacio">Sin alertas.</p>}
        </section>

        {/* PENDIENTES */}
        <section className="panel">
          <h2>Pendientes de seguimiento</h2>
          <p className="panel-descripcion">Activos sin cita programada y sin medición en los últimos 30 días.</p>
          {espera ? <div className="esqueleto" style={{ height: 160 }} /> : datos?.pendientes.length ? (
            <ul className="lista-alertas">
              {datos.pendientes.map((p) => (
                <li key={p.pacienteId}>
                  <Link to={`/pacientes/${p.pacienteId}/analisis`}>{p.nombreCompleto}</Link>
                  <span className="insignia">{p.diasSinMedicion === null ? 'Sin mediciones' : `${p.diasSinMedicion} días sin medición`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="vacio">Sin pendientes.</p>}
        </section>

        {/* ESTADÍSTICAS MENSUALES Y ANUALES */}
        <section className="panel panel-grafica--ancho">
          <h2>Estadísticas mensuales y anuales · {anio}</h2>
          <p className="panel-descripcion">Generado {datos ? new Date(datos.generado).toLocaleString('es-MX') : '…'}.</p>
          {espera ? <div className="esqueleto" style={{ height: 200 }} /> : m && (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Mes</th><th>Nuevos</th><th>Realizadas</th><th>Canceladas</th><th>No asistió</th><th>Asistencia</th><th>Adherencia</th><th>Mediciones</th><th>IMC prom.</th></tr>
                </thead>
                <tbody>
                  {MESES.map((nombre, i) => (
                    <tr key={nombre}>
                      <td className="celda-fuerte">{nombre}</td>
                      <td>{m.nuevosPacientes[i]}</td>
                      <td>{m.citas.realizada[i]}</td>
                      <td>{m.citas.cancelada[i]}</td>
                      <td>{m.citas.no_asistio[i]}</td>
                      <td>{pct(m.asistencia[i])}</td>
                      <td>{pct(m.adherencia[i])}</td>
                      <td>{m.mediciones[i]}</td>
                      <td>{m.imcPromedio[i] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="celda-fuerte">Total {anio}</td>
                    <td className="celda-fuerte">{sumar(m.nuevosPacientes)}</td>
                    <td className="celda-fuerte">{sumar(m.citas.realizada)}</td>
                    <td className="celda-fuerte">{sumar(m.citas.cancelada)}</td>
                    <td className="celda-fuerte">{sumar(m.citas.no_asistio)}</td>
                    <td className="celda-fuerte">{pct(k.asistenciaAnio)}</td>
                    <td className="celda-fuerte">{pct(k.adherenciaAnio)}</td>
                    <td className="celda-fuerte">{sumar(m.mediciones)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Tabla de usuarios del sistema (se conserva) */}
      <GraficaDashboard mostrarGraficas={false} />
    </Layout>
  );
}

export default Dashboard;
