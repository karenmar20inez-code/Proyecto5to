import { useCallback, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderOpen, Stethoscope, ClipboardList, Utensils,
  TrendingUp, FlaskConical, CalendarDays, FileText, Settings, Menu, PanelLeftClose, ChevronDown, UserRound,
} from 'lucide-react';
import { useAuth, nombreRolCompleto } from '../../context/AuthContext';
import { MARCA } from '../../config/marca';
import LogoNutriva from '../Marca/LogoNutriva';

/* Navegación principal. `permiso` oculta lo que el rol no puede usar.
   `soloPaciente`: opciones del portal propio (solo cuentas con rol paciente). */
const SECCIONES = [
  {
    titulo: 'Mi espacio',
    items: [
      { to: '/mi-espacio', label: 'Inicio', icon: UserRound, end: true, permiso: 'portal:propio', soloPaciente: true },
      { to: '/mi-espacio/dieta', label: 'Mi dieta', icon: Utensils, permiso: 'portal:propio', soloPaciente: true },
      { to: '/mi-espacio/citas', label: 'Mis citas', icon: CalendarDays, permiso: 'portal:propio', soloPaciente: true },
      { to: '/mi-espacio/progreso', label: 'Mi progreso', icon: TrendingUp, permiso: 'portal:propio', soloPaciente: true },
    ],
  },
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
      { to: '/dietas', label: 'Dietas', icon: Utensils, permiso: 'dietas:leer' },
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

/* Categorías desplegables: el estado (abierta/cerrada) se recuerda en este navegador.
   Es solo una preferencia de la interfaz; no guarda datos del consultorio. */
const CLAVE_CATEGORIAS = 'la-nutria:menu-categorias';
function leerCategorias() {
  try { return JSON.parse(window.localStorage.getItem(CLAVE_CATEGORIAS)) || {}; } catch { return {}; }
}

/* ¿La ruta actual pertenece a esta opción del menú? (misma regla que NavLink) */
const esActiva = (pathname, { to, end }) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

/**
 * Menú lateral único.
 *  - Encabezado: logotipo de NUTRIONIX + nombre + descriptor + botón de hamburguesa.
 *  - colapsado: barra estrecha; el encabezado muestra solo la imagen y el botón queda
 *    en el borde del menú para volver a expandirlo. Iconos con tooltip.
 *  - expandido: imagen, nombre, subtítulo y nombre de cada sección.
 * En pantallas pequeñas se muestra como panel deslizable (lo controla Layout);
 * ahí el botón del encabezado cierra el panel.
 */
function Sidebar({ colapsado = false, onNavegar, onMenu, menuExpandido = true, movil = false }) {
  const { usuario, puede } = useAuth();
  const { pathname } = useLocation();
  const [cerradas, setCerradas] = useState(leerCategorias); // { General: true } = contraída

  const alternarCategoria = useCallback((titulo) => {
    setCerradas((c) => {
      const sig = { ...c, [titulo]: !c[titulo] };
      try { window.localStorage.setItem(CLAVE_CATEGORIAS, JSON.stringify(sig)); } catch { /* sin almacenamiento */ }
      return sig;
    });
  }, []);

  const etiquetaMenu = movil
    ? 'Cerrar menú de navegación'
    : (menuExpandido ? 'Contraer menú de navegación' : 'Expandir menú de navegación');

  return (
    <aside id="menu-lateral" className={`sidebar${colapsado ? ' sidebar--colapsado' : ''}`} aria-label="Navegación principal">
      <div className="sidebar__encabezado">
        <NavLink to="/" className="sidebar__marca" onClick={onNavegar} aria-label={`${MARCA.nombre} · inicio`} data-tooltip={MARCA.nombre}>
          <LogoNutriva tamano={44} className="sidebar__logo-img" />
          {/* En el menú, nombre + eslogan (el descriptor completo aparece al pasar el cursor) */}
          <span className="sidebar__nombre" title={MARCA.nombreCompleto}>{MARCA.nombre}<small>{MARCA.eslogan}</small></span>
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
          const esPaciente = usuario?.rol === 'paciente';
          const visibles = s.items.filter((i) => (!i.permiso || puede(i.permiso)) && (!i.soloPaciente || esPaciente));
          if (!visibles.length) return null;
          const abierta = !cerradas[s.titulo];
          const idOpciones = `menu-categoria-${s.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}`;
          const contieneActiva = visibles.some((i) => esActiva(pathname, i));
          return (
            <div key={s.titulo} className={`sidebar__grupo${abierta ? '' : ' sidebar__grupo--cerrado'}`}>
              <button type="button" className="sidebar__seccion" onClick={() => alternarCategoria(s.titulo)}
                aria-expanded={abierta} aria-controls={idOpciones}
                data-tooltip={`${s.titulo} · ${abierta ? 'contraer' : 'expandir'}`}
                aria-label={colapsado ? `${s.titulo}: ${abierta ? 'contraer' : 'expandir'} categoría` : undefined}>
                <span className="sidebar__seccion-texto">{s.titulo}</span>
                {!abierta && contieneActiva && <span className="sidebar__seccion-activa" title="Aquí está la sección abierta" />}
                <ChevronDown className="sidebar__seccion-flecha" aria-hidden="true" />
              </button>
              {/* Contraída: las opciones se ocultan por completo (y no reciben el foco del teclado) */}
              <div className="sidebar__opciones" id={idOpciones} inert={!abierta} aria-hidden={!abierta}>
                <div className="sidebar__opciones-interior">
                  {visibles.map(({ to, label, icon: Icono, end }) => (
                    <NavLink key={to} to={to} end={end} onClick={onNavegar} data-tooltip={label}
                      aria-label={colapsado ? label : undefined}
                      className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
                      <Icono aria-hidden="true" />
                      <span className="menu-item__texto">{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      {usuario && (
        <div className="sidebar__usuario" data-tooltip={`${usuario.nombre} · ${nombreRolCompleto(usuario)}`}>
          <span className="sidebar__usuario-iniciales" aria-hidden="true">
            {usuario.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}
          </span>
          <span className="sidebar__usuario-texto">
            <strong>{usuario.nombre}</strong>
            {nombreRolCompleto(usuario)}{usuario.cedulaProfesional ? ` · Céd. ${usuario.cedulaProfesional}` : ''}
          </span>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
