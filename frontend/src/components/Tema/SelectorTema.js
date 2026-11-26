import { Moon, Sun } from 'lucide-react';
import { useTema } from '../../context/TemaContext';
import './SelectorTema.css';

/** Botón para cambiar entre modo claro y modo oscuro (barra superior e inicio de sesión). */
function SelectorTema({ className = '' }) {
  const { tema, alternar } = useTema();
  const oscuro = tema === 'oscuro';
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button type="button" className={`selector-tema ${className}`.trim()} onClick={alternar}
      aria-label={etiqueta} aria-pressed={oscuro} title={etiqueta}>
      {oscuro ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

export default SelectorTema;
