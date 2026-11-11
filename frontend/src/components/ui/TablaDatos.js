import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';

const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Tabla profesional con ordenamiento por columna y búsqueda.
 * columnas: [{ clave, titulo, valor?: (fila) => valorOrdenable, render?: (fila) => nodo, numerica?, ordenable? }]
 */
function TablaDatos({
  columnas, filas, clave = (f) => f._id || f.id, onFila, vacio = 'Sin registros.', buscable = true,
  placeholder = 'Filtrar…', ordenInicial, filtros, cargando, etiqueta,
}) {
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState(ordenInicial || null); // { clave, dir: 'asc' | 'desc' }

  const valorDe = (col, fila) => (col.valor ? col.valor(fila) : fila[col.clave]);

  const visibles = useMemo(() => {
    const t = normalizar(texto.trim());
    let lista = t
      ? filas.filter((f) => columnas.some((c) => normalizar(valorDe(c, f)).includes(t)))
      : filas;
    if (orden) {
      const col = columnas.find((c) => c.clave === orden.clave);
      if (col) {
        lista = [...lista].sort((a, b) => {
          const va = valorDe(col, a);
          const vb = valorDe(col, b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1; // faltantes siempre al final
          if (vb == null) return -1;
          const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true });
          return orden.dir === 'asc' ? r : -r;
        });
      }
    }
    return lista;
  }, [filas, texto, orden, columnas]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (c) => setOrden((o) => (o?.clave === c ? { clave: c, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { clave: c, dir: 'asc' }));

  return (
    <div>
      {(buscable || filtros) && (
        <div className="filtros-tabla">
          {buscable && (
            <label className="buscador-tabla">
              <Search aria-hidden="true" />
              <span className="sr-only">{placeholder}</span>
              <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} />
            </label>
          )}
          {filtros}
          <span className="campo__ayuda" aria-live="polite">{visibles.length} de {filas.length}</span>
        </div>
      )}
      <div className="tabla-scroll">
        <table className="tabla" aria-label={etiqueta}>
          <thead>
            <tr>
              {columnas.map((c) => {
                const activo = orden?.clave === c.clave;
                const Icono = !activo ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th key={c.clave} className={c.numerica ? 'celda-num' : undefined}
                    aria-sort={activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {c.ordenable === false ? c.titulo : (
                      <button type="button" onClick={() => alternar(c.clave)}>
                        {c.titulo} <Icono aria-hidden="true" />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={columnas.length} className="vacio">Cargando…</td></tr>}
            {!cargando && visibles.length === 0 && <tr><td colSpan={columnas.length} className="vacio">{vacio}</td></tr>}
            {!cargando && visibles.map((f) => (
              <tr key={clave(f)} className={onFila ? 'fila--enlace' : undefined}
                onClick={onFila ? () => onFila(f) : undefined}
                onKeyDown={onFila ? (e) => { if (e.key === 'Enter') onFila(f); } : undefined}
                tabIndex={onFila ? 0 : undefined}>
                {columnas.map((c) => (
                  <td key={c.clave} className={c.numerica ? 'celda-num' : undefined}>
                    {c.render ? c.render(f) : (valorDe(c, f) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TablaDatos;
