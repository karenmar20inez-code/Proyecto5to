import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* ==========================================
   MODO CLARO / MODO OSCURO
   - La preferencia es de la interfaz (no es un dato clínico): se recuerda en este navegador.
   - Sin preferencia guardada se usa la del sistema operativo.
   - El tema se aplica con <html data-tema="claro|oscuro">; los colores viven en index.css.
========================================== */
const CLAVE = 'nutriva:tema';
const TemaContext = createContext({ tema: 'claro', alternar: () => {}, cambiar: () => {} });

const temaInicial = () => {
  try {
    const guardado = window.localStorage.getItem(CLAVE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch { /* sin almacenamiento */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
};

export function TemaProvider({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.tema = tema;
    raiz.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'oscuro' ? '#1C1812' : '#EFE0C3');
    try { window.localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento */ }
  }, [tema]);

  const cambiar = useCallback((t) => setTema(t === 'oscuro' ? 'oscuro' : 'claro'), []);
  const alternar = useCallback(() => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro')), []);
  const valor = useMemo(() => ({ tema, cambiar, alternar }), [tema, cambiar, alternar]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export const useTema = () => useContext(TemaContext);
