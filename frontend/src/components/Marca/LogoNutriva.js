import { MARCA } from '../../config/marca';

/**
 * Símbolo de NUTRIVA. Todas las pantallas usan este componente: al cambiar `MARCA.logo`
 * (config/marca.js) se actualiza el logotipo en el inicio de sesión, el menú lateral y el resto.
 * Es decorativo (alt=""): el nombre NUTRIVA siempre se muestra o se anuncia junto a él.
 */
function LogoNutriva({ tamano = 44, className = '' }) {
  return <img src={MARCA.logo} alt="" width={tamano} height={tamano} className={className} />;
}

export default LogoNutriva;
