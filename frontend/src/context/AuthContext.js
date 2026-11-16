import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, sesionGuardada } from '../services/api';

/**
 * Sesión del usuario: inicio/cierre de sesión, permisos y cierre por inactividad
 * (el servidor también expira la sesión tras 30 min sin actividad).
 */
const AuthContext = createContext(null);
const EVENTOS_ACTIVIDAD = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(() => sesionGuardada.leer());
  const [verificando, setVerificando] = useState(!!sesionGuardada.leer());
  const [aviso, setAviso] = useState('');
  const temporizador = useRef(null);

  const cerrar = useCallback((mensaje = '') => {
    sesionGuardada.borrar();
    setSesion(null);
    setAviso(mensaje);
  }, []);

  /* Al recargar: confirma con el servidor que la sesión siga vigente */
  useEffect(() => {
    if (!sesionGuardada.leer()) return;
    authApi.yo()
      .then((usuario) => setSesion((s) => (s ? { ...s, usuario } : s)))
      .catch(() => cerrar('Tu sesión expiró. Inicia sesión de nuevo.'))
      .finally(() => setVerificando(false));
  }, [cerrar]);

  /* 401 en cualquier llamada → volver al inicio de sesión */
  useEffect(() => {
    const alExpirar = (e) => cerrar(e.detail || 'Tu sesión expiró. Inicia sesión de nuevo.');
    window.addEventListener('sesion-expirada', alExpirar);
    return () => window.removeEventListener('sesion-expirada', alExpirar);
  }, [cerrar]);

  /* Cierre por inactividad en el navegador */
  useEffect(() => {
    if (!sesion) return undefined;
    const minutos = sesion.inactividadMin || 30;
    const reiniciar = () => {
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        authApi.logout().catch(() => {});
        cerrar(`Sesión cerrada por ${minutos} minutos de inactividad.`);
      }, minutos * 60000);
    };
    reiniciar();
    EVENTOS_ACTIVIDAD.forEach((ev) => window.addEventListener(ev, reiniciar, { passive: true }));
    return () => {
      clearTimeout(temporizador.current);
      EVENTOS_ACTIVIDAD.forEach((ev) => window.removeEventListener(ev, reiniciar));
    };
  }, [sesion, cerrar]);

  const iniciar = useCallback(async (correo, contrasena) => {
    const r = await authApi.login(correo, contrasena);
    const datos = { token: r.token, expira: r.expira, inactividadMin: r.inactividadMin, usuario: r.usuario };
    sesionGuardada.guardar(datos);
    setAviso('');
    setSesion(datos);
    return r.usuario;
  }, []);

  const salir = useCallback(async () => {
    await authApi.logout().catch(() => {});
    cerrar('Sesión cerrada.');
  }, [cerrar]);

  const usuario = sesion?.usuario || null;
  const puede = useCallback((permiso) => {
    const lista = usuario?.permisos || [];
    return lista.includes('*') || lista.includes(permiso);
  }, [usuario]);

  const valor = useMemo(() => ({ usuario, verificando, aviso, iniciar, salir, puede }), [usuario, verificando, aviso, iniciar, salir, puede]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/* Nombres de los roles para la interfaz (el backend también envía usuario.nombreRol) */
export const NOMBRES_ROL = {
  superusuario: 'Superusuario',
  administrador: 'Administrador de sistemas',
  nutriologo: 'Nutriología',
  docente: 'Docente',
  administrativo: 'Administrativo',
  paciente: 'Paciente',
  asistente: 'Asistente',
};
export const NIVELES_ADMINISTRATIVO = { recepcion: 'Recepción', gestion: 'Gestión', supervisor: 'Supervisor' };
/* "Administrativo · Recepción" */
export const nombreRolCompleto = (u) => (u ? [NOMBRES_ROL[u.rol] || u.rol, NIVELES_ADMINISTRATIVO[u.nivel]].filter(Boolean).join(' · ') : '');
