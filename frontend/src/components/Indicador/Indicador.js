/* Tarjeta de indicador con origen del dato (medido / calculado / estimado / prescrito / ajustado) */

export const ORIGENES = {
  medido: { texto: 'Medido', clase: 'origen--medido' },
  calculado: { texto: 'Calculado', clase: 'origen--calculado' },
  estimado: { texto: 'Estimado', clase: 'origen--estimado' },
  prescrito: { texto: 'Prescrito', clase: 'origen--prescrito' },
  ajustado: { texto: 'Ajustado', clase: 'origen--ajustado' },
  error: { texto: 'Dato inválido', clase: 'origen--error' },
};

export function Origen({ origen }) {
  const o = ORIGENES[origen];
  if (!o) return null;
  return <span className={`origen ${o.clase}`}>{o.texto}</span>;
}

const formatear = (v, decimales) =>
  typeof v === 'number' ? v.toLocaleString('es-MX', { maximumFractionDigits: decimales }) : v;

/**
 * @param {object} props
 * @param {string} props.titulo
 * @param {object} [props.resultado]  Resultado del motor ({ valor, unidad, origen, faltantes, advertencias })
 * @param {*}      [props.valor]      Valor directo (si no hay `resultado`)
 */
function Indicador({ titulo, resultado, valor, unidad, origen, detalle, decimales = 1, accion }) {
  const v = resultado ? resultado.valor : valor;
  const u = unidad ?? resultado?.unidad ?? '';
  const o = origen ?? resultado?.origen;
  const faltantes = resultado?.faltantes || [];
  const advertencias = resultado?.advertencias || [];
  const ayuda = [
    resultado?.error,
    faltantes.length ? `Faltan datos: ${faltantes.join(', ')}` : null,
    ...advertencias,
    resultado?.ajuste ? `Ajustado: ${resultado.ajuste.motivo} (original ${resultado.valorOriginal})` : null,
  ].filter(Boolean);

  return (
    <div className="kpi indicador" title={ayuda.join('\n') || undefined}>
      <span>{titulo}</span>
      <strong>
        {v === null || v === undefined ? '—' : formatear(v, decimales)}
        {v !== null && v !== undefined && u && <small className="indicador__unidad"> {u}</small>}
      </strong>
      <div className="indicador__pie">
        <Origen origen={v === null || v === undefined ? (resultado?.error ? 'error' : null) : o} />
        {detalle && <small>{detalle}</small>}
        {(v === null || v === undefined) && faltantes.length > 0 && <small>Faltan: {faltantes.join(', ')}</small>}
        {advertencias.length > 0 && v !== null && <small className="indicador__aviso">⚠ {advertencias.length} nota(s)</small>}
        {accion}
      </div>
    </div>
  );
}

export default Indicador;
