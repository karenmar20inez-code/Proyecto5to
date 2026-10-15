import { useState } from 'react';
import './Topbar.css';

const ENLACES = [
  { id: 'dashboard', texto: 'Dashboard' },
  { id: 'estudiantes', texto: 'Estudiantes' },
  { id: 'calificaciones', texto: 'Calificaciones' },
];

function Topbar({ paginaActual, onNavegar }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modoOscuro, setModoOscuro] = useState(true);

  const navegar = (id) => {
    onNavegar(id);
    setMenuAbierto(false);
  };

  const alternarTema = () => {
    setModoOscuro(!modoOscuro);
    // Agrega o quita la clase para cambiar el fondo
    document.body.classList.toggle('modo-claro');
  };

  const verNotificaciones = () => {
    alert("¡Tienes nuevos pedidos en Dulce Encanto!");
  };

  return (
    <header className="topbar">
      <button className="topbar__marca" onClick={() => navegar('dashboard')}>
        Dulce Encanto
      </button>

      <button
        className="topbar__toggle"
        aria-label="Abrir menú"
        aria-expanded={menuAbierto}
        onClick={() => setMenuAbierto(!menuAbierto)}
      >
        ☰
      </button>

      <nav className={`topbar__menu ${menuAbierto ? 'topbar__menu--abierto' : ''}`}>
        <ul className="topbar__enlaces">
          {ENLACES.map((enlace) => (
            <li key={enlace.id}>
              <button
                className={`topbar__enlace ${paginaActual === enlace.id ? 'topbar__enlace--activo' : ''}`}
                aria-current={paginaActual === enlace.id ? 'page' : undefined}
                onClick={() => navegar(enlace.id)}
              >
                {enlace.texto}
              </button>
            </li>
          ))}
        </ul>

        {/* Sección de iconos y login */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          
          <button 
            onClick={alternarTema} 
            style={{ fontSize: '1.2rem', padding: '4px', borderRadius: '50%', cursor: 'pointer', background: 'none', border: 'none' }}
            title={modoOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {modoOscuro ? '☀️' : '🌙'}
          </button>

          <button 
            onClick={verNotificaciones}
            style={{ fontSize: '1.2rem', padding: '4px', borderRadius: '50%', position: 'relative', cursor: 'pointer', background: 'none', border: 'none' }}
            title="Notificaciones"
          >
            🔔
            <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }}></span>
          </button>

          <button className="topbar__login" onClick={() => navegar('login')}>
            Iniciar sesión
          </button>
        </div>
      </nav>
    </header>
  );
}

export default Topbar;