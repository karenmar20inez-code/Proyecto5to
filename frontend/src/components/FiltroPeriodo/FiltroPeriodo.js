import { useState } from 'react';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export const PERIODOS = [
  { id: '7d', texto: 'Semana', rango: () => ({ desde: haceDias(7), hasta: hoyISO() }) },
  { id: '30d', texto: 'Mes', rango: () => ({ desde: haceDias(30), hasta: hoyISO() }) },
  { id: '90d', texto: '3 meses', rango: () => ({ desde: haceDias(90), hasta: hoyISO() }) },
  { id: '365d', texto: 'Año', rango: () => ({ desde: haceDias(365), hasta: hoyISO() }) },
  { id: 'todo', texto: 'Todo', rango: () => ({}) },
];

/** Filtro de periodo: atajos + rango personalizado. Llama a onCambio({ desde, hasta }). */
function FiltroPeriodo({ valorInicial = 'todo', onCambio }) {
  const [activo, setActivo] = useState(valorInicial);
  const [personal, setPersonal] = useState({ desde: haceDias(30), hasta: hoyISO() });

  const elegir = (p) => {
    setActivo(p.id);
    onCambio(p.rango());
  };

  const aplicarPersonal = (cambios) => {
    const nuevo = { ...personal, ...cambios };
    setPersonal(nuevo);
    setActivo('personalizado');
    if (nuevo.desde && nuevo.hasta && nuevo.desde <= nuevo.hasta) onCambio(nuevo);
  };

  return (
    <div className="filtro-periodo" role="group" aria-label="Periodo">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`pestana${activo === p.id ? ' pestana--activa' : ''}`}
          onClick={() => elegir(p)}
          aria-pressed={activo === p.id}
        >
          {p.texto}
        </button>
      ))}
      <span className={`filtro-periodo__personal${activo === 'personalizado' ? ' filtro-periodo__personal--activo' : ''}`}>
        <input type="date" aria-label="Desde" value={personal.desde} max={personal.hasta} onChange={(e) => aplicarPersonal({ desde: e.target.value })} />
        <span>–</span>
        <input type="date" aria-label="Hasta" value={personal.hasta} min={personal.desde} onChange={(e) => aplicarPersonal({ hasta: e.target.value })} />
      </span>
    </div>
  );
}

export default FiltroPeriodo;
