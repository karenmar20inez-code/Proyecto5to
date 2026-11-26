import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFicha } from '../FichaPaciente';
import FiltroPeriodo from '../../../components/FiltroPeriodo/FiltroPeriodo';
import {
  SerieTemporal, BarrasTemporales, GraficaMacros, GraficaObjetivos, PALETA,
} from '../../../components/Graficas/GraficasClinicas';
import { estadisticasApi, laboratorioApi, planeacionApi, expedienteApi, consultasApi } from '../../../services/api';
import { formatoFecha, fechaISO } from '../../../context/NutriContext';
import { useTema } from '../../../context/TemaContext';

const t = (f) => new Date(f).getTime();
const fecha = (f) => formatoFecha(fechaISO(f));
const METODOS = { bascula_digital: 'Báscula digital', bascula_mecanica: 'Báscula mecánica', bioimpedancia: 'Bioimpedancia', autorreporte: 'Autorreporte', plicometria: 'Plicometría', dexa: 'DEXA', cinta_metrica: 'Cinta métrica', otro: 'Otro' };
const PUNTAJE = { cumplio: 1, parcial: 0.5, no: 0 };
const NOMBRES = { pesoKg: ['Peso', 'kg'], cinturaCm: ['Cintura', 'cm'], caderaCm: ['Cadera', 'cm'], grasaPorcentaje: ['Grasa corporal', '%'], masaMuscularKg: ['Masa muscular', 'kg'] };

function Panel({ titulo, descripcion, children, ancho }) {
  return (
    <section className={`panel${ancho ? ' panel-grafica--ancho' : ''}`}>
      <h2>{titulo}</h2>
      {descripcion && <p className="panel-descripcion">{descripcion}</p>}
      {children}
    </section>
  );
}

/* Puntos medidos de un campo de Medicion */
const medidos = (mediciones, campo, metodoClave) => mediciones.filter((m) => m[campo] != null).map((m) => ({
  t: t(m.fecha), valor: m[campo], origen: 'medido', metodo: METODOS[m.metodos?.[metodoClave]], version: m.version,
}));

/* Puntos calculados a partir de la evaluación de cada medición */
const calculados = (mediciones, obtener) => mediciones.map((m) => ({ m, v: obtener(m.evaluacion?.resultadosFinales || {}) }))
  .filter((x) => x.v != null).map((x) => ({ t: t(x.m.fecha), valor: x.v, origen: 'calculado' }));

function Evolucion() {
  useTema(); // al cambiar de modo claro/oscuro se vuelven a dibujar las gráficas con los colores del tema
  const { pacienteId } = useFicha();
  const [rango, setRango] = useState({});
  const [datos, setDatos] = useState(null);
  const [labs, setLabs] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [comp, setComp] = useState({ a: '', b: '', datos: null });
  const [analito, setAnalito] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [d, l, o, c] = await Promise.all([
        estadisticasApi.dashboardPaciente(pacienteId, rango), laboratorioApi.listar(pacienteId, rango),
        planeacionApi.objetivos(pacienteId), consultasApi.listar(pacienteId),
      ]);
      setDatos(d); setLabs(l); setObjetivos(o.objetivos); setConsultas(c);
      setAnalito((x) => x || l[0]?.analito || '');
      setError('');
    } catch (e) { setError(e.message); }
  }, [pacienteId, rango]);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    expedienteApi.comparacion(pacienteId, { a: comp.a || undefined, b: comp.b || undefined })
      .then((r) => setComp((x) => ({ ...x, datos: r }))).catch(() => {});
  }, [pacienteId, comp.a, comp.b]);

  const v = useMemo(() => {
    if (!datos) return null;
    const m = datos.mediciones;
    const metaPeso = objetivos.find((o) => o.estado === 'activo' && o.indicador === 'pesoKg')?.valorMeta ?? datos.prescripcionVigente?.pesoObjetivoKg;
    const metaCintura = objetivos.find((o) => o.estado === 'activo' && o.indicador === 'cinturaCm')?.valorMeta ?? datos.prescripcionVigente?.cinturaObjetivoCm;

    /* Adherencia semanal (%): solo semanas con registros */
    const semanas = {};
    datos.adherencia.forEach((r) => {
      const d = new Date(`${r.fecha}T00:00:00Z`);
      const lunes = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).getTime();
      semanas[lunes] = semanas[lunes] || { p: 0, n: 0 };
      semanas[lunes].p += PUNTAJE[r.estado]; semanas[lunes].n += 1;
    });

    return {
      peso: medidos(m, 'pesoKg', 'peso'), metaPeso, metaCintura,
      imc: calculados(m, (r) => r.imc?.valor),
      cintura: medidos(m, 'cinturaCm', 'circunferencias'), cadera: medidos(m, 'caderaCm', 'circunferencias'),
      masaGrasa: calculados(m, (r) => r.composicion?.valor?.masaGrasaKg),
      mlg: calculados(m, (r) => r.composicion?.valor?.masaLibreGrasaKg),
      masaMuscular: medidos(m, 'masaMuscularKg', 'composicion'),
      consumo: m.filter((x) => x.consumoKcal != null).map((x) => ({ t: t(x.fecha), valor: x.consumoKcal, origen: 'medido', metodo: x.metodos?.registro?.replace('_', ' ') })),
      agua: m.filter((x) => x.aguaMl != null).map((x) => ({ t: t(x.fecha), valor: x.aguaMl, origen: 'medido' })),
      actividad: m.filter((x) => x.actividadMinutos != null).map((x) => ({ t: t(x.fecha), valor: x.actividadMinutos, origen: 'medido', metodo: x.actividadTipo })),
      adherencia: Object.entries(semanas).sort(([a], [b]) => a - b).map(([lunes, s]) => ({ t: Number(lunes), valor: Math.round((s.p / s.n) * 100), unidad: '%', origen: 'calculado', metodo: `${s.n} comidas registradas` })),
    };
  }, [datos, objetivos]);

  const presentes = [...new Map(labs.map((l) => [l.analito, l.nombre])).entries()];
  const serieLab = labs.filter((l) => l.analito === analito).sort((a, b) => t(a.fechaMuestra) - t(b.fechaMuestra));
  const r = datos?.resumen;

  return (
    <div>
      <div className="barra-filtros">
        <FiltroPeriodo onCambio={setRango} />
        <span className="campo__ayuda">Fórmulas v{datos?.versionFormulas || '—'} · los datos faltantes no se interpolan</span>
      </div>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      {!v ? <div className="esqueleto" style={{ height: 420 }} /> : (
        <div className="rejilla-graficas">
          <Panel titulo="Evolución del peso" descripcion="Medido. Línea punteada: objetivo.">
            <SerieTemporal unidad="kg" series={[{ nombre: 'Peso', puntos: v.peso }]} objetivo={v.metaPeso != null && { valor: v.metaPeso, etiqueta: `Objetivo ${v.metaPeso} kg` }} />
          </Panel>
          <Panel titulo="Evolución del IMC" descripcion="Calculado en cada medición (peso / estatura²).">
            <SerieTemporal unidad="kg/m²" series={[{ nombre: 'IMC', puntos: v.imc, color: PALETA.verde }]} />
          </Panel>
          <Panel titulo="Composición corporal" descripcion="Masa grasa y libre de grasa: calculadas desde el % de grasa medido. Masa muscular: medida.">
            <SerieTemporal unidad="kg" series={[
              { nombre: 'Masa grasa (calc.)', puntos: v.masaGrasa, color: PALETA.ambar },
              { nombre: 'Masa libre de grasa (calc.)', puntos: v.mlg, color: PALETA.gris, punteada: true },
              { nombre: 'Masa muscular (medida)', puntos: v.masaMuscular, color: PALETA.verde },
            ]} />
          </Panel>
          <Panel titulo="Circunferencia de cintura y cadera" descripcion="Medido con cinta métrica.">
            <SerieTemporal unidad="cm" series={[{ nombre: 'Cintura', puntos: v.cintura }, { nombre: 'Cadera', puntos: v.cadera, color: PALETA.gris }]}
              objetivo={v.metaCintura != null && { valor: v.metaCintura, etiqueta: `Objetivo cintura ${v.metaCintura} cm` }} />
          </Panel>
          <Panel titulo="Resultados bioquímicos" descripcion="Banda verde: rango de referencia del laboratorio.">
            {presentes.length > 0 && (
              <select className="selector" style={{ width: 'auto', marginBottom: 'var(--e2)' }} value={analito} onChange={(e) => setAnalito(e.target.value)} aria-label="Estudio">
                {presentes.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            )}
            <SerieTemporal unidad={serieLab[0]?.unidad || ''} rango={serieLab[serieLab.length - 1]?.rangoReferencia}
              series={[{ nombre: serieLab[0]?.nombre || 'Resultado', color: PALETA.morado, puntos: serieLab.map((l) => ({ t: t(l.fechaMuestra), valor: l.valor, unidad: l.unidad, origen: 'medido', procedencia: l.procedencia })) }]} />
          </Panel>
          <Panel titulo="Consumo energético frente al objetivo" descripcion="Consumo registrado (medido/autorreporte) vs energía prescrita.">
            <BarrasTemporales nombre="Consumo" unidad="kcal" puntos={v.consumo}
              objetivo={r.consumo.objetivo.valor != null && { valor: r.consumo.objetivo.valor, etiqueta: `Prescrito ${r.consumo.objetivo.valor} kcal` }} />
            {r.consumo.promedio.valor != null && <p className="grafica-pie">Promedio del periodo: {r.consumo.promedio.valor} kcal/día ({r.consumo.promedio.advertencias.join(' ')})</p>}
          </Panel>
          <Panel titulo="Distribución de macronutrientes" descripcion="Prescrita (energía y porcentajes de la prescripción vigente).">
            <GraficaMacros macros={datos.evaluacionActual?.macronutrientes?.valor} />
          </Panel>
          <Panel titulo="Cumplimiento de objetivos" descripcion="Avance de objetivos activos con indicador medible.">
            <GraficaObjetivos objetivos={objetivos.filter((o) => o.estado === 'activo')} />
          </Panel>
          <Panel titulo="Tendencia de adherencia" descripcion="Porcentaje semanal calculado con el registro de comidas (cumplió 1 · parcial 0.5 · no 0).">
            <BarrasTemporales nombre="Adherencia" unidad="%" puntos={v.adherencia} maximo={100}
              colorPorValor={(x) => (x >= 80 ? PALETA.verde : x >= 50 ? PALETA.ambar : PALETA.rojo)} />
          </Panel>
          <Panel titulo="Hidratación" descripcion="Agua registrada por día.">
            <BarrasTemporales nombre="Agua" unidad="ml" puntos={v.agua} color={PALETA.turquesa}
              objetivo={(r.hidratacion.objetivoPrescritoMl ?? r.hidratacion.estimado?.valor) != null && {
                valor: r.hidratacion.objetivoPrescritoMl ?? r.hidratacion.estimado.valor,
                etiqueta: r.hidratacion.objetivoPrescritoMl ? `Prescrito ${r.hidratacion.objetivoPrescritoMl} ml` : `Estimación orientativa ${r.hidratacion.estimado.valor} ml`,
              }} />
          </Panel>
          <Panel titulo="Actividad física" descripcion={r.actividad.objetivoSemanalMin ? `Objetivo prescrito: ${r.actividad.objetivoSemanalMin} min/semana` : 'Minutos registrados por día.'}>
            <BarrasTemporales nombre="Actividad" unidad="min" puntos={v.actividad} color={PALETA.verde} />
          </Panel>

          <Panel titulo="Variación semanal y mensual" descripcion="Último valor contra la medición más cercana anterior a 7 y 30 días (días realmente comparados entre paréntesis).">
            <div className="tabla-scroll">
              <table className="tabla">
                <thead><tr><th>Indicador</th><th className="celda-num">Semanal</th><th className="celda-num">Mensual</th><th className="celda-num">Tasa/semana</th></tr></thead>
                <tbody>
                  {Object.entries(NOMBRES).map(([c, [n, u]]) => {
                    const s = r.variaciones[c]?.semanal?.valor;
                    const mm = r.variaciones[c]?.mensual?.valor;
                    const fmt = (x) => (x ? `${x.delta > 0 ? '+' : ''}${x.delta} ${u} (${x.diasComparados} d)` : '—');
                    return <tr key={c}><td className="celda-fuerte">{n}</td><td className="celda-num">{fmt(s)}</td><td className="celda-num">{fmt(mm)}</td><td className="celda-num">{(mm || s) ? `${(mm || s).tasaSemanal} ${u}` : '—'}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel titulo="Comparación entre consultas" descripcion="Mediciones vinculadas a cada consulta (por omisión, la última contra la anterior)." ancho>
            <div className="filtros-tabla">
              <label className="campo__ayuda" htmlFor="cmp-a">Consulta</label>
              <select id="cmp-a" className="selector" value={comp.a} onChange={(e) => setComp({ ...comp, a: e.target.value })}>
                <option value="">Última medición</option>{consultas.map((c) => <option key={c._id} value={c._id}>{fecha(c.fecha)} · {c.motivo || 'Consulta'}</option>)}
              </select>
              <label className="campo__ayuda" htmlFor="cmp-b">contra</label>
              <select id="cmp-b" className="selector" value={comp.b} onChange={(e) => setComp({ ...comp, b: e.target.value })}>
                <option value="">Medición anterior</option>{consultas.map((c) => <option key={c._id} value={c._id}>{fecha(c.fecha)} · {c.motivo || 'Consulta'}</option>)}
              </select>
            </div>
            {!comp.datos?.actual ? <p className="vacio">Sin mediciones para comparar.</p> : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Indicador</th><th className="celda-num">{comp.datos.anterior ? fecha(comp.datos.anterior.fecha) : 'Anterior'}</th><th className="celda-num">{fecha(comp.datos.actual.fecha)}</th><th className="celda-num">Cambio</th></tr></thead>
                  <tbody>
                    {comp.datos.filas.filter((f) => f.actual != null || f.anterior != null).map((f) => (
                      <tr key={f.campo}><td>{NOMBRES[f.campo]?.[0] || f.campo}</td><td className="celda-num">{f.anterior ?? '—'}</td>
                        <td className="celda-num celda-fuerte">{f.actual ?? '—'} {f.unidad}</td><td className="celda-num">{f.delta != null ? `${f.delta > 0 ? '+' : ''}${f.delta}` : 'Dato faltante'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export default Evolucion;
