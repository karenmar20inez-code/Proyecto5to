import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderOpen, Stethoscope, ClipboardList, Utensils,
  TrendingUp, FlaskConical, CalendarDays, FileText, Settings, Menu, PanelLeftClose,
} from 'lucide-react';
import { useAuth, NOMBRES_ROL } from '../../context/AuthContext';
import logoNutria from '../../Assets/Picture/LaNutria.webp';

/* Navegación principal. `permiso` oculta lo que el rol no puede usar. */
const SECCIONES = [
  {
    titulo: 'General',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, permiso: 'estadisticas:leer' },
      { to: '/pacientes', label: 'Pacientes', icon: Users, permiso: 'pacientes:leer' },
      { to: '/agenda', label: 'Agenda', icon: CalendarDays, permiso: 'agenda:leer' },
    ],
  },
  {
    titulo: 'Clínica',
    items: [
      { to: '/expedientes', label: 'Historial clínico', icon: FolderOpen, permiso: 'clinico:leer' },
      { to: '/consultas', label: 'Consultas', icon: Stethoscope, permiso: 'clinico:leer' },
      { to: '/evaluaciones', label: 'Evaluaciones', icon: ClipboardList, permiso: 'clinico:leer' },
      { to: '/dietas', label: 'Dietas', icon: Utensils, permiso: 'clinico:leer' },
      { to: '/cumplimiento', label: 'Cumplimiento', icon: TrendingUp, permiso: 'clinico:leer' },
      { to: '/laboratorio', label: 'Laboratorio', icon: FlaskConical, permiso: 'clinico:leer' },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { to: '/reportes', label: 'Reportes', icon: FileText, permiso: 'reportes:generar' },
      { to: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

/**
 * Menú lateral único.
 *  - Encabezado: imagen de La Nutria + nombre + subtítulo + botón de hamburguesa.
 *  - colapsado: barra estrecha; el encabezado muestra solo la imagen y el botón queda
 *    en el borde del menú para volver a expandirlo. Iconos con tooltip.
 *  - expandido: imagen, nombre, subtítulo y nombre de cada sección.
 * En pantallas pequeñas se muestra como panel deslizable (lo controla Layout);
 * ahí el botón del encabezado cierra el panel.
 */
function Sidebar({ colapsado = false, onNavegar, onMenu, menuExpandido = true, movil = false }) {
  const { usuario, puede } = useAuth();
  const etiquetaMenu = movil
    ? 'Cerrar menú de navegación'
    : (menuExpandido ? 'Contraer menú de navegación' : 'Expandir menú de navegación');

  return (
    <aside id="menu-lateral" className={`sidebar${colapsado ? ' sidebar--colapsado' : ''}`} aria-label="Navegación principal">
      <div className="sidebar__encabezado">
        <NavLink to="/" className="sidebar__marca" onClick={onNavegar} aria-label="La Nutria · inicio" data-tooltip="La Nutria">
          <img src={logoNutria} alt="" className="sidebar__logo-img" width="44" height="44" />
          <span className="sidebar__nombre">La Nutria<small>Gestión clínica nutricional</small></span>
        </NavLink>
        {onMenu && (
          <button type="button" className="boton-menu sidebar__boton-menu" onClick={onMenu}
            aria-controls="menu-lateral" aria-expanded={menuExpandido}
            aria-label={etiquetaMenu} title={etiquetaMenu.replace(' de navegación', '')}>
            {menuExpandido ? <PanelLeftClose aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        )}
      </div>
      <nav>
        {SECCIONES.map((s) => {
          const visibles = s.items.filter((i) => !i.permiso || puede(i.permiso));
          if (!visibles.length) return null;
          return (
            <div key={s.titulo} className="sidebar__grupo">
              <p className="sidebar__seccion">{s.titulo}</p>
              {visibles.map(({ to, label, icon: Icono, end }) => (
                <NavLink key={to} to={to} end={end} onClick={onNavegar} data-tooltip={label}
                  aria-label={colapsado ? label : undefined}
                  className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
                  <Icono aria-hidden="true" />
                  <span className="menu-item__texto">{label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      {usuario && (
        <div className="sidebar__usuario" data-tooltip={`${usuario.nombre} · ${NOMBRES_ROL[usuario.rol]}`}>
          <span className="sidebar__usuario-iniciales" aria-hidden="true">
            {usuario.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}
          </span>
          <span className="sidebar__usuario-texto">
            <strong>{usuario.nombre}</strong>
            {NOMBRES_ROL[usuario.rol]}{usuario.cedulaProfesional ? ` · Céd. ${usuario.cedulaProfesional}` : ''}
          </span>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
