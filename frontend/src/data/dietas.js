/* ==========================================
   PLANES DE ALIMENTACIÓN · utilidades compartidas
   El catálogo de dietas vive en MongoDB (GET /api/dietas) y se obtiene con
   useNutri(): { dietas, buscarDieta, guardarDieta }.
   La dieta "semana-2" que antes estaba escrita aquí se migró tal cual
   a backend/src/data/dietas-base.json y se carga sola la primera vez.
   Cada ingrediente: { alimento, cantidad }
========================================== */

/* Tiempos de comida sugeridos en el editor (se puede escribir otro) */
export const TIEMPOS_COMIDA = ['Al despertar', 'Desayuno', 'Medio día', 'Comida', 'Media tarde', 'Cena', 'Antes de dormir'];

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/* Comidas que sí se pueden evaluar (tienen platillo definido) */
export const comidasEvaluables = (dia) =>
  (dia?.comidas || []).filter((c) => c.platillo);

/* Días con su nombre entre dos fechas AAAA-MM-DD (máximo 14). Conserva las comidas de `previos` por fecha. */
export function diasEntre(inicio, fin, previos = []) {
  if (!inicio || !fin || fin < inicio) return previos;
  const dias = [];
  const fecha = new Date(`${inicio}T00:00:00Z`);
  const limite = new Date(`${fin}T00:00:00Z`);
  while (fecha <= limite && dias.length < 14) {
    const iso = fecha.toISOString().slice(0, 10);
    const previo = previos.find((d) => d.fecha === iso);
    dias.push(previo ? { ...previo, dia: NOMBRES_DIA[fecha.getUTCDay()] } : { dia: NOMBRES_DIA[fecha.getUTCDay()], fecha: iso, comidas: [] });
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  return dias;
}

/* Alimentos únicos de una dieta (para revisar alergias en el servidor) */
export const alimentosDeDieta = (dieta) =>
  dieta ? [...new Set(dieta.dias.flatMap((dia) => dia.comidas.flatMap((c) => c.ingredientes.map((i) => i.alimento))))] : [];
