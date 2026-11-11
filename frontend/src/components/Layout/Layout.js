import React, { useCallback, useEffect, useState } from 'react';
import Topbar from '../Topbar/Topbar';
import Sidebar from '../Sidebar/Sidebar';
import '../../pages/Dashboard/Dashboard.css';
import '../../styles/modulos.css';

const CLAVE_MENU = 'la-nutria:menu-colapsado';
const ES_MOVIL = '(max-width: 860px)';

function leerPreferencia() {
  try { return window.localStorage.getItem(CLAVE_MENU) === '1'; } catch { return false; }
}

/**
 * Estructura común: menú lateral + barra superior + contenido.
 * El estado del menú vive aquí (un solo menú para toda la aplicación):
 *  - escritorio: expandido / contraído (se recuerda como preferencia del navegador)
 *  - móvil: panel deslizable abierto / cerrado
 */
function Layout({ titulo, subtitulo, acciones, children }) {
  const [colapsado, setColapsado] = useState(leerPreferencia);
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const [movil, setMovil] = useState(() => window.matchMedia(ES_MOVIL).matches);

  useEffect(() => {
    const mq = window.matchMedia(ES_MOVIL);
    const cambio = (e) => { setMovil(e.matches); setAbiertoMovil(false); };
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);

  /* Escape cierra el panel en móvil */
  useEffect(() => {
    if (!abiertoMovil) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') setAbiertoMovil(false); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abiertoMovil]);

  const alternarMenu = useCallback(() => {
    if (movil) { setAbiertoMovil((a) => !a); return; }
    setColapsado((c) => {
      try { window.localStorage.setItem(CLAVE_MENU, c ? '0' : '1'); } catch { /* sin almacenamiento */ }
      return !c;
    });
  }, [movil]);

  const expandido = movil ? abiertoMovil : !colapsado;

  return (
    <div className={`dashboard-layout${abiertoMovil ? ' dashboard-layout--menu-abierto' : ''}`}
      onClick={(e) => { if (abiertoMovil && e.target === e.currentTarget) setAbiertoMovil(false); }}>
      <a href="#contenido" className="sr-only">Saltar al contenido</a>
      <Sidebar colapsado={!movil && colapsado} onNavegar={() => setAbiertoMovil(false)}
        onMenu={alternarMenu} menuExpandido={expandido} movil={movil} />
      <main className="main-area">
        {/* En móvil el menú está oculto: la barra superior conserva un botón para abrirlo */}
        <Topbar onMenu={movil ? alternarMenu : undefined} menuExpandido={expandido} />
        <section className="content" id="contenido" tabIndex={-1}>
          {titulo && (
            <div className="encabezado-pagina">
              <div>
                <h1>{titulo}</h1>
                {subtitulo && <p className="encabezado-pagina__sub">{subtitulo}</p>}
              </div>
              {acciones && <div className="encabezado-acciones">{acciones}</div>}
            </div>
          )}
          {children}
        </section>
      </main>
    </div>
  );
}

export default Layout;
