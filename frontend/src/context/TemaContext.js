import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/* ==========================================
   MODO CLARO / MODO OSCURO (administración centralizada)
   - Prioridad: 1) tema elegido a mano (se guarda en este navegador y se conserva al cerrar y volver
     a abrir); 2) si nunca se eligió, el tema del dispositivo detectado al abrir la aplicación.
   - Durante el uso no se escuchan cambios del sistema: el tema no cambia inesperadamente.
   - Es una preferencia de interfaz (no un dato clínico). La aplicación no tiene preferencias por
     usuario en la base de datos, así que no se modifica el modelo ni la API.
   - El tema se aplica con <html data-tema="claro|oscuro">; los colores viven en index.css.
     index.html aplica el mismo cálculo antes de pintar para evitar un destello del otro tema.
========================================== */
export const CLAVE_TEMA = 'nutriva:tema';
const TemaContext = createContext({ tema: 'claro', elegidoManual: false, alternar: () => {}, cambiar: () => {} });

const leerGuardado = () => {
  try {
    const t = window.localStorage.getItem(CLAVE_TEMA);
    return t === 'claro' || t === 'oscuro' ? t : null;
  } catch { return null; }
};
const temaDispositivo = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');

/* Se aplica al documento en el mismo momento del cambio, antes de que React vuelva a dibujar:
   así las gráficas, que leen los colores al dibujarse, ya toman los del tema nuevo. */
const aplicar = (tema) => {
  const raiz = document.documentElement;
  raiz.dataset.tema = tema;
  raiz.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'oscuro' ? '#0F1F1A' : '#EFE0C3');
};

export function TemaProvider({ children }) {
  const [estado, setEstado] = useState(() => {
    const guardado = leerGuardado();
    const tema = guardado || temaDispositivo();
    aplicar(tema);
    return { tema, elegidoManual: Boolean(guardado) };
  });

  /* Selección manual: tiene prioridad sobre el dispositivo y se guarda */
  const cambiar = useCallback((t) => {
    const tema = t === 'oscuro' ? 'oscuro' : 'claro';
    aplicar(tema);
    try { window.localStorage.setItem(CLAVE_TEMA, tema); } catch { /* sin almacenamiento */ }
    setEstado({ tema, elegidoManual: true });
  }, []);
  const alternar = useCallback(() => cambiar(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro'), [cambiar]);

  const valor = useMemo(() => ({ ...estado, cambiar, alternar }), [estado, cambiar, alternar]);
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export const useTema = () => useContext(TemaContext);
