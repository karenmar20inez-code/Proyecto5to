import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, User, LogOut, Menu, PanelLeftClose, KeyRound } from 'lucide-react';
import { useAuth, NOMBRES_ROL } from '../../context/AuthContext';
import { useNutri } from '../../context/NutriContext';
import { alertasApi } from '../../services/api';
import './Topbar.css';

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Topbar({ onMenu, menuExpandido = true }) {
  const { usuario, salir, puede } = useAuth();
  const { pacientes } = useNutri();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [alertas, setAlertas] = useState(0);
  const menuRef = useRef(null);

  /* Contador de alertas pendientes (se refresca cada 2 minutos) */
  useEffect(() => {
    if (!puede('clinico:leer')) return undefined;
    const cargar = () => alertasApi.listar().then((l) => setAlertas(l.length)).catch(() => {});
    cargar();
    const t = setInterval(cargar, 120000);
    return () => clearInterval(t);
  }, [puede]);

  /* Cerrar el menú de cuenta al hacer clic fuera o con Escape */
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const fuera = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false); };
    const escape = (e) => { if (e.key === 'Escape') setMenuAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', escape); };
  }, [menuAbierto]);

  const resultados = useMemo(() => {
    const t = normalizar(busqueda.trim());
    if (t.length < 2) return [];
    return pacientes.filter((p) => normalizar(`${p.nombreCompleto} ${p.expediente?.folio || ''} ${p.correo}`).includes(t)).slice(0, 6);
  }, [busqueda, pacientes]);

  const abrir = (p) => {
    setBusqueda('');
    navigate(puede('clinico:leer') ? `/pacientes/${p.id}` : '/pacientes');
  };

  const iniciales = (usuario?.nombre || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

  return (
    <header className="topbar no-imprimir">
      {/* Solo en móvil: en escritorio el botón vive en el encabezado del menú lateral */}
      {onMenu && (
        <button className="boton-menu" onClick={onMenu} aria-controls="menu-lateral" aria-expanded={menuExpandido}
          aria-label={menuExpandido ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          title={menuExpandido ? 'Cerrar menú' : 'Abrir menú'}>
          {menuExpandido ? <PanelLeftClose aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      )}

      <div className="topbar__buscador" role="search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          placeholder="Buscar paciente por nombre o folio…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) abrir(resultados[0]); }}
          aria-label="Buscar paciente"
          aria-controls="resultados-busqueda"
          aria-expanded={resultados.length > 0}
        />
        {busqueda.trim().length >= 2 && (
          <ul className="topbar__resultados" id="resultados-busqueda" role="listbox">
            {resultados.length === 0 && <li><span>Sin coincidencias</span></li>}
            {resultados.map((p) => (
              <li key={p.id} role="option" aria-selected="false">
                <Link to={puede('clinico:leer') ? `/pacientes/${p.id}` : '/pacientes'} onClick={() => setBusqueda('')}>
                  {p.nombreCompleto}<small>{p.expediente?.folio}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="topbar__acciones" ref={menuRef}>
        {puede('clinico:leer') && (
          <Link className="topbar__notificaciones" to="/alertas" aria-label={`Alertas clínicas: ${alertas} pendientes`}>
            <Bell size={18} aria-hidden="true" />
            {alertas > 0 && <span className="topbar__contador">{alertas > 99 ? '99+' : alertas}</span>}
          </Link>
        )}

        <button className="topbar__avatar" onClick={() => setMenuAbierto(!menuAbierto)} aria-expanded={menuAbierto} aria-haspopup="menu" aria-label="Menú de cuenta">
          {iniciales}
        </button>

        {menuAbierto && (
          <div className="topbar__dropdown" role="menu">
            <div className="topbar__cuenta">
              <strong>{usuario?.nombre}</strong>
              <span>{usuario?.correo} · {NOMBRES_ROL[usuario?.rol]}</span>
            </div>
            <Link to="/perfil" className="topbar__opcion" role="menuitem" onClick={() => setMenuAbierto(false)}>
              <User aria-hidden="true" /> Mi perfil
            </Link>
            <Link to="/perfil#contrasena" className="topbar__opcion" role="menuitem" onClick={() => setMenuAbierto(false)}>
              <KeyRound aria-hidden="true" /> Cambiar contraseña
            </Link>
            <button className="topbar__opcion topbar__salir" role="menuitem" onClick={() => { setMenuAbierto(false); salir(); }}>
              <LogOut aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
