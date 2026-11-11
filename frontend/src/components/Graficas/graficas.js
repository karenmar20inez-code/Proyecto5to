/* ==========================================
   CONFIGURACIÓN COMÚN DE GRÁFICAS (Chart.js)
   Usa la paleta de La Nutria: verde · #daccaf · #ffffff
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

/* Paleta sobre el verde glassmorphic (los nombres se conservan por compatibilidad) */
export const COLORES = {
  blanco: '#FFFFFF',      // serie principal
  arena: '#DACCAF',       // serie secundaria (beige)
  verdeClaro: '#A7E8C0',
  verde: '#2E7A5E',
  coral: '#FFB8AE',
  arenaSuave: 'rgba(218, 204, 175, 0.22)',
  verdeSuave: 'rgba(167, 232, 192, 0.22)',
  blancoSuave: 'rgba(255, 255, 255, 0.16)',
  rejilla: 'rgba(255, 255, 255, 0.12)',
};

/* Serie para categorías (objetivos, etc.) */
export const SERIE_CATEGORICA = ['#FFFFFF', '#DACCAF', '#A7E8C0', '#F6CD8A', '#E5D8FF', '#9EE6E0', '#FFB8AE'];

const tooltip = {
  backgroundColor: '#24443A',
  borderColor: 'rgba(218, 204, 175, 0.6)',
  borderWidth: 1,
  titleColor: '#FFFFFF',
  bodyColor: '#F2ECDF',
  padding: 10,
  cornerRadius: 10,
};

const ejes = {
  x: { ticks: { color: '#DACCAF' }, grid: { color: COLORES.rejilla } },
  y: { ticks: { color: '#DACCAF' }, grid: { color: COLORES.rejilla } },
};

/** Opciones base; `extra` se mezcla en profundidad simple por nivel. */
export function opciones({ leyenda = true, unidad = '', ejesVisibles = true, apilado = false, extra = {} } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 600 },
    plugins: {
      legend: { display: leyenda, position: 'bottom', labels: { color: '#F2ECDF', usePointStyle: true, padding: 14 } },
      tooltip: {
        ...tooltip,
        callbacks: unidad
          ? { label: (c) => `${c.dataset.label}: ${c.formattedValue} ${unidad}` }
          : undefined,
      },
      ...(extra.plugins || {}),
    },
    scales: ejesVisibles
      ? {
          x: { ...ejes.x, stacked: apilado, ...(extra.x || {}) },
          y: { ...ejes.y, stacked: apilado, ...(extra.y || {}) },
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
  pointBorderColor: '#24443A',
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
