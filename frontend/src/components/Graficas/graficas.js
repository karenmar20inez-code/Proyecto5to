/* ==========================================
   CONFIGURACIÓN COMÚN DE GRÁFICAS (Chart.js)
   Los colores salen de los tokens --grafica-* de index.css, así que siguen el modo claro u oscuro.
   Se leen en el momento de dibujar; al cambiar de tema la aplicación vuelve a dibujar las pantallas.
========================================== */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";

/** Valor actual de un token de color (con respaldo si aún no hay estilos cargados) */
export const colorTema = (token, respaldo = '#5F6B35') => {
  if (typeof document === 'undefined') return respaldo;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || respaldo;
};

/* Paleta de la nutria (los nombres históricos se conservan por compatibilidad) */
export const COLORES = {
  get blanco() { return colorTema('--grafica-1', '#5F6B35'); },       // serie principal
  get arena() { return colorTema('--grafica-2', '#9B6F48'); },        // serie secundaria
  get verdeClaro() { return colorTema('--grafica-3', '#9B9A64'); },
  get verde() { return colorTema('--grafica-4', '#3F4A22'); },
  get coral() { return colorTema('--grafica-5', '#C0614A'); },
  get arenaSuave() { return colorTema('--grafica-2-suave', 'rgba(155, 111, 72, 0.18)'); },
  get verdeSuave() { return colorTema('--grafica-3-suave', 'rgba(155, 154, 100, 0.22)'); },
  get blancoSuave() { return colorTema('--grafica-1-suave', 'rgba(95, 107, 53, 0.16)'); },
  get rejilla() { return colorTema('--grafica-rejilla', 'rgba(78, 58, 32, 0.12)'); },
  get texto() { return colorTema('--grafica-texto', '#6B5230'); },
  get fondo() { return colorTema('--grafica-fondo', '#FAF1E0'); },
};

/* Serie para categorías (objetivos, etc.): cada posición lee su token al usarse */
export const SERIE_CATEGORICA = [];
for (let i = 0; i < 7; i += 1) {
  Object.defineProperty(SERIE_CATEGORICA, i, { enumerable: true, get: () => colorTema(`--grafica-cat-${i + 1}`) });
}

const tooltip = () => ({
  backgroundColor: COLORES.fondo,
  borderColor: colorTema('--grafica-tooltip-borde', 'rgba(122, 85, 48, 0.45)'),
  borderWidth: 1,
  titleColor: colorTema('--grafica-tooltip-titulo', '#3D2C17'),
  bodyColor: colorTema('--grafica-tooltip-texto', '#4E3A20'),
  padding: 10,
  cornerRadius: 10,
});

const ejes = () => ({
  x: { ticks: { color: COLORES.texto }, grid: { color: COLORES.rejilla } },
  y: { ticks: { color: COLORES.texto }, grid: { color: COLORES.rejilla } },
});

/** Opciones base; `extra` se mezcla en profundidad simple por nivel. */
export function opciones({ leyenda = true, unidad = '', ejesVisibles = true, apilado = false, extra = {} } = {}) {
  const e = ejes();
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 600 },
    plugins: {
      legend: { display: leyenda, position: 'bottom', labels: { color: colorTema('--grafica-leyenda', '#4E3A20'), usePointStyle: true, padding: 14 } },
      tooltip: {
        ...tooltip(),
        callbacks: unidad
          ? { label: (c) => `${c.dataset.label}: ${c.formattedValue} ${unidad}` }
          : undefined,
      },
      ...(extra.plugins || {}),
    },
    scales: ejesVisibles
      ? {
          x: { ...e.x, stacked: apilado, ...(extra.x || {}) },
          y: { ...e.y, stacked: apilado, ...(extra.y || {}) },
        }
      : undefined,
    spanGaps: true,
  };
}

/** Dataset de línea con estilo de la identidad */
export const linea = (label, data, color = COLORES.blanco, extra = {}) => ({
  label,
  data,
  borderColor: color,
  backgroundColor: color === COLORES.blanco ? COLORES.blancoSuave : `${color}33`,
  pointBackgroundColor: color,
  pointBorderColor: COLORES.fondo,
  pointRadius: 4,
  pointHoverRadius: 6,
  borderWidth: 2,
  tension: 0.3,
  ...extra,
});

/** Línea punteada para valores prescritos/objetivo */
export const lineaObjetivo = (label, data, color = COLORES.arena) => ({
  label,
  data,
  borderColor: color,
  borderDash: [6, 5],
  borderWidth: 1.5,
  pointRadius: 0,
  fill: false,
});

export const barras = (label, data, color = COLORES.verdeClaro, extra = {}) => ({
  label,
  data,
  backgroundColor: color,
  borderRadius: 6,
  maxBarThickness: 38,
  ...extra,
});
