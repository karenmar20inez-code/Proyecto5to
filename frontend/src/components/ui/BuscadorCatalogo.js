import { useEffect, useState } from 'react';
import { catalogosApi } from '../../services/api';

/**
 * Búsqueda en un catálogo autorizado importado (p. ej. CIE-10).
 * Si el catálogo no se ha importado, lo indica y permite texto libre.
 * onElegir({ sistema, codigo, texto })
 */
function BuscadorCatalogo({ sistema = 'CIE-10', valor, onElegir, etiqueta = 'Código de catálogo (opcional)', id = 'buscador-catalogo' }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [disponible, setDisponible] = useState(null);

  useEffect(() => {
    catalogosApi.sistemas().then((l) => setDisponible(l.some((s) => s.sistema === sistema))).catch(() => setDisponible(false));
  }, [sistema]);

  useEffect(() => {
    if (!disponible || q.trim().length < 2) { setResultados([]); return undefined; }
    const t = setTimeout(() => catalogosApi.buscar(sistema, q.trim()).then(setResultados).catch(() => setResultados([])), 250);
    return () => clearTimeout(t);
  }, [q, sistema, disponible]);

  return (
    <div className="campo campo--completo">
      <label htmlFor={id}>{etiqueta}</label>
      {valor?.codigo ? (
        <div className="encabezado-acciones">
          <span className="insignia insignia--info">{valor.sistema} {valor.codigo} · {valor.texto}</span>
          <button type="button" className="boton boton--fantasma boton--chico" onClick={() => onElegir(null)}>Quitar</button>
        </div>
      ) : disponible === false ? (
        <span className="campo__ayuda">
          El catálogo {sistema} no está importado (npm run importar-catalogo). Se registrará como texto libre.
        </span>
      ) : (
        <>
          <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar en ${sistema} por código o descripción`} autoComplete="off" />
          {resultados.length > 0 && (
            <ul className="lista-alertas" role="listbox" aria-label={`Resultados de ${sistema}`}>
              {resultados.map((r) => (
                <li key={r.codigo}>
                  <span><strong className="celda-fuerte">{r.codigo}</strong> {r.texto}</span>
                  <button type="button" className="boton boton--secundario boton--chico"
                    onClick={() => { onElegir({ sistema, codigo: r.codigo, texto: r.texto }); setQ(''); }}>Elegir</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default BuscadorCatalogo;
