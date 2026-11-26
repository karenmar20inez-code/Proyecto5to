import { Moon, Sun } from 'lucide-react';
import { useTema } from '../../context/TemaContext';
import './SelectorTema.css';

const OPCIONES = [
  ['claro', 'Modo claro', Sun],
  ['oscuro', 'Modo oscuro', Moon],
];

/** Selector de tema: sol = modo claro, luna = modo oscuro. Se usa en la barra superior y en el inicio de sesión. */
function SelectorTema({ className = '' }) {
  const { tema, cambiar } = useTema();
  return (
    <div className={`selector-tema ${className}`.trim()} role="group" aria-label="Apariencia">
      {OPCIONES.map(([valor, etiqueta, Icono]) => (
        <button key={valor} type="button" className={`selector-tema__opcion${tema === valor ? ' selector-tema__opcion--activa' : ''}`}
          onClick={() => cambiar(valor)} aria-pressed={tema === valor} aria-label={etiqueta} title={etiqueta}>
          <Icono aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default SelectorTema;
