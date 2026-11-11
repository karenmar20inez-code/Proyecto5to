/**
 * Gráficas clínicas (Recharts).
 *  - Eje X temporal real (la distancia refleja los días entre mediciones).
 *  - connectNulls = false: los datos faltantes NO se interpolan.
 *  - Tooltip con fecha, valor, unidad, origen y método/procedencia.
 *  - Cada gráfica ofrece su tabla de datos (alternativa accesible).
 */
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ReferenceArea, PieChart, Pie, Cell,
} from 'recharts';

export const PALETA = {
  // Tonos claros, legibles sobre el verde La Nutria (#1F3D31)
  azul: '#FFFFFF', verde: '#A7E8C0', ambar: '#F6CD8A', rojo: '#FFB8AE', morado: '#E5D8FF', gris: '#DACCAF', turquesa: '#9EE6E0',
};
const SERIES = [PALETA.azul, PALETA.verde, PALETA.morado, PALETA.ambar, PALETA.turquesa, PALETA.gris];

/* Las fechas clínicas (medición, toma de muestra) se guardan como día calendario en UTC */
const fechaCorta = (t) => new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
const fechaLarga = (t) => new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const num = (v, d = 1) => (typeof v === 'number' ? v.toLocaleString('es-MX', { maximumFractionDigits: d }) : '—');
const ORIGEN = { medido: 'Medido', calculado: 'Calculado', estimado: 'Estimado', prescrito: 'Prescrito', ajustado: 'Ajustado' };

const EJE = { stroke: 'rgba(218, 204, 175, 0.55)', tick: { fill: '#DACCAF', fontSize: 12 } };

function TooltipClinico({ active, payload, unidad }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-clinico">
      <strong>{fechaLarga(payload[0].payload.t)}</strong>
      {payload.map((p) => (
        <p key={p.dataKey + p.name}>
          <span style={{ color: p.color }}>●</span> {p.name}: <strong>{num(p.value, 2)} {p.payload.unidad || unidad}</strong>
          {p.payload.origen && <> · {ORIGEN[p.payload.origen] || p.payload.origen}</>}
          {p.payload.metodo && <> · {p.payload.metodo}</>}
          {p.payload.procedencia && <> · {p.payload.procedencia}</>}
          {p.payload.version > 1 && <> · v{p.payload.version}</>}
        </p>
      ))}
    </div>
  );
}

function TablaAlternativa({ series, unidad }) {
  const filas = series.flatMap((s) => s.puntos.map((p) => ({ ...p, serie: s.nombre }))).sort((a, b) => a.t - b.t);
  return (
    <details className="grafica-pie">
      <summary>Ver datos en tabla ({filas.length})</summary>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Serie</th><th className="celda-num">Valor</th><th>Origen</th><th>Método / procedencia</th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>{fechaLarga(f.t)}</td><td>{f.serie}</td>
                <td className="celda-num">{num(f.valor, 2)} {f.unidad || unidad}</td>
                <td>{ORIGEN[f.origen] || f.origen || '—'}</td><td>{f.metodo || f.procedencia || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Serie(s) temporales.
 * series: [{ nombre, color?, puntos: [{ t (ms), valor, origen?, metodo?, procedencia?, version? }] }]
 * objetivo: { valor, etiqueta }  (línea punteada · prescrito)
 * rango: { min, max, etiqueta }  (banda de referencia)
 */
export function SerieTemporal({ series, unidad, objetivo, rango, alto = 260, dominio }) {
  const conDatos = series.filter((s) => s.puntos.length);
  if (!conDatos.length) return <p className="vacio">Sin mediciones registradas para este indicador.</p>;
  const ts = conDatos.flatMap((s) => s.puntos.map((p) => p.t));
  const valores = conDatos.flatMap((s) => s.puntos.map((p) => p.valor)).concat(objetivo?.valor ?? [], rango?.min ?? [], rango?.max ?? []);
  const margen = Math.max(1, (Math.max(...valores) - Math.min(...valores)) * 0.15);
  const unPunto = ts.length === 1;

  return (
    <>
      <div style={{ width: '100%', height: alto }}>
        <ResponsiveContainer>
          <LineChart margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="t" type="number" scale="time" domain={unPunto ? [ts[0] - 864e5 * 7, ts[0] + 864e5 * 7] : ['dataMin', 'dataMax']}
              tickFormatter={fechaCorta} {...EJE} allowDuplicatedCategory={false} />
            <YAxis {...EJE} width={48} domain={dominio || [Math.floor(Math.min(...valores) - margen), Math.ceil(Math.max(...valores) + margen)]}
              tickFormatter={(v) => num(v)} label={{ value: unidad, angle: -90, position: 'insideLeft', fill: '#DACCAF', fontSize: 11 }} />
            <Tooltip content={<TooltipClinico unidad={unidad} />} />
            {conDatos.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {rango && (rango.min != null || rango.max != null) && (
              <ReferenceArea y1={rango.min ?? undefined} y2={rango.max ?? undefined} fill={PALETA.verde} fillOpacity={0.08}
                label={{ value: rango.etiqueta || 'Rango de referencia', position: 'insideTopRight', fill: PALETA.verde, fontSize: 11 }} />
            )}
            {objetivo?.valor != null && (
              <ReferenceLine y={objetivo.valor} stroke={PALETA.morado} strokeDasharray="6 4"
                label={{ value: objetivo.etiqueta || `Objetivo ${objetivo.valor} ${unidad}`, position: 'insideBottomRight', fill: PALETA.morado, fontSize: 11 }} />
            )}
            {conDatos.map((s, i) => (
              <Line key={s.nombre} data={s.puntos} dataKey="valor" name={s.nombre} stroke={s.color || SERIES[i % SERIES.length]}
                strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#24443A' }} activeDot={{ r: 6 }}
                connectNulls={false} isAnimationActive={false} strokeDasharray={s.punteada ? '5 4' : undefined} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TablaAlternativa series={conDatos} unidad={unidad} />
    </>
  );
}

/** Barras por fecha con línea de objetivo opcional (consumo, adherencia, agua, actividad) */
export function BarrasTemporales({ puntos, nombre, unidad, objetivo, color = PALETA.azul, colorPorValor, alto = 240, maximo }) {
  if (!puntos.length) return <p className="vacio">Sin registros en el periodo.</p>;
  const datos = puntos.map((p) => ({ ...p, etiqueta: fechaCorta(p.t) }));
  return (
    <>
      <div style={{ width: '100%', height: alto }}>
        <ResponsiveContainer>
          <BarChart data={datos} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.12)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="etiqueta" {...EJE} />
            <YAxis {...EJE} width={48} domain={[0, maximo || 'auto']} tickFormatter={(v) => num(v, 0)} />
            <Tooltip content={<TooltipClinico unidad={unidad} />} cursor={{ fill: 'rgba(255,255,255,0.08)' }} />
            {objetivo?.valor != null && (
              <ReferenceLine y={objetivo.valor} stroke={PALETA.morado} strokeDasharray="6 4"
                label={{ value: objetivo.etiqueta, position: 'insideTopRight', fill: PALETA.morado, fontSize: 11 }} />
            )}
            <Bar dataKey="valor" name={nombre} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {datos.map((d, i) => <Cell key={i} fill={colorPorValor ? colorPorValor(d.valor) : color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TablaAlternativa series={[{ nombre, puntos }]} unidad={unidad} />
    </>
  );
}

/** Distribución de macronutrientes prescrita (gramos y % de energía) */
export function GraficaMacros({ macros }) {
  if (!macros) return <p className="vacio">Sin distribución prescrita (energía y porcentajes en la prescripción).</p>;
  const datos = [
    { nombre: 'Proteínas', ...macros.proteinas, color: PALETA.azul },
    { nombre: 'Carbohidratos', ...macros.carbohidratos, color: PALETA.verde },
    { nombre: 'Grasas', ...macros.grasas, color: PALETA.ambar },
  ];
  return (
    <div className="rejilla-2" style={{ alignItems: 'center' }}>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={datos} dataKey="kcal" nameKey="nombre" innerRadius="58%" outerRadius="90%" isAnimationActive={false}>
              {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, n, p) => [`${p.payload.porcentaje} % · ${p.payload.gramos} g · ${v} kcal`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <table className="tabla">
        <thead><tr><th>Macronutriente</th><th className="celda-num">%</th><th className="celda-num">g/día</th><th className="celda-num">kcal</th></tr></thead>
        <tbody>
          {datos.map((d) => (
            <tr key={d.nombre}>
              <td><span style={{ color: d.color }}>●</span> {d.nombre}</td>
              <td className="celda-num">{d.porcentaje}</td><td className="celda-num">{num(d.gramos)}</td><td className="celda-num">{num(d.kcal, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Avance de objetivos (barras horizontales 0–100 %) */
export function GraficaObjetivos({ objetivos }) {
  const datos = objetivos.filter((o) => o.progreso != null).map((o) => ({
    nombre: o.descripcion.length > 34 ? `${o.descripcion.slice(0, 32)}…` : o.descripcion,
    avance: Math.max(0, Math.min(100, o.progreso)), real: o.progreso,
  }));
  if (!datos.length) return <p className="vacio">Sin objetivos con avance medible (requieren valor inicial, meta y un registro posterior).</p>;
  return (
    <div style={{ width: '100%', height: Math.max(120, datos.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="rgba(255, 255, 255, 0.12)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...EJE} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="nombre" width={200} {...EJE} />
          <Tooltip formatter={(v, n, p) => [`${num(p.payload.real)} % (acotado a 0–100)`, 'Avance']} />
          <Bar dataKey="avance" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            {datos.map((d, i) => <Cell key={i} fill={d.avance >= 100 ? PALETA.verde : PALETA.azul} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { fechaCorta, fechaLarga, num };
