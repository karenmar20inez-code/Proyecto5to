import Loader from './Loaders';
import { MARCA } from '../../config/marca';

/** Pantalla de carga de NUTRIONIX (al abrir la aplicación y al entrar). Anuncia el estado a lectores de pantalla. */
function PantallaCarga({ mensaje = `Cargando ${MARCA.nombre}…` }) {
  return (
    <div className="loader-pantalla-completa" role="status" aria-live="polite">
      <Loader />
      <p className="loader-pantalla-completa__marca">{MARCA.nombre}</p>
      <p className="loader-pantalla-completa__eslogan">{MARCA.eslogan}</p>
      <p className="loader-pantalla-completa__texto">{mensaje}</p>
    </div>
  );
}

export default PantallaCarga;
