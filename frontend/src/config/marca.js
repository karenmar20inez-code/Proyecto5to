/* ==========================================
   IDENTIDAD DE NUTRIVA (única fuente)
   Nombre, descriptor, eslogan y recursos gráficos de la marca. Cualquier pantalla que muestre la
   marca los toma de aquí: cambiar un texto o el logotipo se hace en este archivo.

   Recursos actuales (Assets/Picture):
   - LaNutria.webp: mascota (nutria con bata), se usa como logotipo mientras no exista el oficial.
   - Nutria_Mejorada.png: ilustración oficial de la nutria (fondo del inicio de sesión).
   LOGOTIPO OFICIAL: cuando exista, guárdalo en Assets/Picture (SVG o WebP, cuadrado, fondo
   transparente) y cambia solo el import de `logo`.
   Los nombres internos (archivos, rutas, colecciones, variables) se conservan por estabilidad.
========================================== */
import logo from '../Assets/Picture/LaNutria.webp';
import ilustracion from '../Assets/Picture/Nutria_Mejorada.png';

export const MARCA = {
  nombre: 'NUTRIVA',
  descriptor: 'Sistema Integral de Gestión Nutricional',
  eslogan: 'Cada persona tiene su propio equilibrio',
  nombreCompleto: 'NUTRIVA — Sistema Integral de Gestión Nutricional',
  logo,
  ilustracion,
};

export default MARCA;
