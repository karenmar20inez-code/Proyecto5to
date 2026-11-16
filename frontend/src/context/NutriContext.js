import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { comidasEvaluables } from '../data/dietas';
import { pacientesApi, adherenciaApi, medicionesApi, dietasApi } from '../services/api';
import { useAuth } from './AuthContext';

/* ==========================================
   ESTADO GLOBAL DEL CONSULTORIO
   - Pacientes, mediciones, adherencia y catálogo de dietas: MongoDB Atlas vía API
   - Antecedentes: MongoDB vía API (pestaña Historia del expediente,
     versionados y cifrados). Ningún dato clínico se guarda en el navegador.
========================================== */

/* El frontend usa `id`; Mongo devuelve `_id` */
const normalizar = (p) => ({ ...p, id: p._id });

const llaveCumplimiento = (r) => `${r.pacienteId}|${r.dietaId}|${r.fecha}|${r.tiempo}`;

const NutriContext = createContext(null);

export function NutriProvider({ children }) {
  const [pacientes, setPacientes] = useState([]);
  const [cargandoPacientes, setCargandoPacientes] = useState(true);
  const [errorPacientes, setErrorPacientes] = useState('');
  const [cumplimiento, setCumplimiento] = useState({});
  const [ultimasMediciones, setUltimasMediciones] = useState({});
  const [dietas, setDietas] = useState([]);
  const [cargandoDietas, setCargandoDietas] = useState(true);
  const [errorDietas, setErrorDietas] = useState('');

  /* Catálogo de dietas activas (MongoDB). Se usa en Pacientes, Dietas, Cumplimiento y Plan nutricional. */
  const recargarDietas = useCallback(async () => {
    try {
      setDietas(await dietasApi.listar());
      setErrorDietas('');
    } catch (error) {
      setErrorDietas(error.message);
    } finally {
      setCargandoDietas(false);
    }
  }, []);

  /* Vuelve a pedir la lista al servidor (se llama tras cada cambio) */
  const recargarPacientes = useCallback(async () => {
    try {
      const lista = await pacientesApi.listar();
      setPacientes(lista.map(normalizar));
      setErrorPacientes('');
    } catch (error) {
      setErrorPacientes(error.message);
    } finally {
      setCargandoPacientes(false);
    }
  }, []);

  const recargarCumplimiento = useCallback(async () => {
    try {
      const registros = await adherenciaApi.listar();
      setCumplimiento(Object.fromEntries(registros.map((r) => [llaveCumplimiento(r), r.estado])));
    } catch {
      /* el error de conexión ya se muestra en el listado de pacientes */
    }
  }, []);

  /* Último peso y total de mediciones por paciente (agregación en el servidor) */
  const recargarMediciones = useCallback(async () => {
    try {
      const filas = await medicionesApi.ultimas();
      setUltimasMediciones(Object.fromEntries(filas.map((f) => [f.pacienteId, f])));
    } catch {
      /* idem */
    }
  }, []);

  /* Carga inicial según permisos: cada rol pide solo lo que puede ver (la API lo valida igualmente) */
  const { puede, usuario } = useAuth();
  useEffect(() => {
    if (usuario?.debeCambiarContrasena) { setCargandoPacientes(false); setCargandoDietas(false); return; } // primero debe cambiar su contraseña
    if (puede('pacientes:leer')) recargarPacientes(); else setCargandoPacientes(false);
    if (puede('clinico:leer')) { recargarCumplimiento(); recargarMediciones(); }
    if (puede('dietas:leer')) recargarDietas(); else setCargandoDietas(false);
  }, [puede, usuario?.debeCambiarContrasena, recargarPacientes, recargarCumplimiento, recargarMediciones, recargarDietas]);

  const acciones = useMemo(() => ({
    recargarPacientes,
    recargarCumplimiento,
    recargarMediciones,
    recargarDietas,

    /* Crea (sin clave) o actualiza (con clave) una dieta y refresca el catálogo */
    async guardarDieta(clave, datos) {
      const guardada = clave ? await dietasApi.actualizar(clave, datos) : await dietasApi.crear(datos);
      await recargarDietas();
      return guardada;
    },

    async agregarPaciente(paciente) {
      const creado = await pacientesApi.crear(paciente);
      await recargarPacientes();
      return creado._id;
    },

    async actualizarPaciente(id, cambios) {
      const actualizado = await pacientesApi.actualizar(id, cambios);
      await recargarPacientes();
      return normalizar(actualizado);
    },

    async eliminarPaciente(id) {
      await pacientesApi.eliminar(id);
      await recargarPacientes();
    },

    /* Actualización optimista: se refleja al instante y se revierte si el servidor falla */
    async marcarCumplimiento(pacienteId, dietaId, fecha, tiempo, estado) {
      const llave = llaveCumplimiento({ pacienteId, dietaId, fecha, tiempo });
      let anterior;
      setCumplimiento((c) => {
        anterior = c[llave];
        const nuevo = { ...c };
        if (estado) nuevo[llave] = estado;
        else delete nuevo[llave];
        return nuevo;
      });
      try {
        await adherenciaApi.marcar(pacienteId, { dietaId, fecha, tiempo, estado: estado || null });
      } catch (error) {
        setCumplimiento((c) => {
          const revertido = { ...c };
          if (anterior) revertido[llave] = anterior;
          else delete revertido[llave];
          return revertido;
        });
        window.alert(error.message);
      }
    },
  }), [recargarPacientes, recargarCumplimiento, recargarMediciones, recargarDietas]);

  /* Busca una dieta del catálogo por su clave (la que guarda el paciente en dietaId) */
  const buscarDieta = useCallback((id) => (id ? dietas.find((d) => d.id === id) || null : null), [dietas]);

  const valor = useMemo(
    () => ({
      pacientes, cargandoPacientes, errorPacientes, cumplimiento, ultimasMediciones,
      dietas, cargandoDietas, errorDietas, buscarDieta, ...acciones,
    }),
    [pacientes, cargandoPacientes, errorPacientes, cumplimiento, ultimasMediciones, dietas, cargandoDietas, errorDietas, buscarDieta, acciones]
  );

  return <NutriContext.Provider value={valor}>{children}</NutriContext.Provider>;
}

export function useNutri() {
  const ctx = useContext(NutriContext);
  if (!ctx) throw new Error('useNutri debe usarse dentro de <NutriProvider>');
  return ctx;
}

/* ==========================================
   CÁLCULOS
========================================== */

export const nombreCompleto = (p) => (p ? p.nombreCompleto || '' : '');

export const iniciales = (p) =>
  nombreCompleto(p)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();

export const ESTADOS_PACIENTE = { activo: 'Activo', baja: 'Baja' };

export function calcularIMC(peso, estaturaCm) {
  const p = Number(peso);
  const e = Number(estaturaCm) / 100;
  if (!p || !e) return null;
  return Math.round((p / (e * e)) * 10) / 10;
}

export function clasificarIMC(imc) {
  if (imc == null) return { texto: '—', tono: '' };
  if (imc < 18.5) return { texto: 'Bajo peso', tono: 'medio' };
  if (imc < 25) return { texto: 'Normal', tono: 'ok' };
  if (imc < 30) return { texto: 'Sobrepeso', tono: 'medio' };
  return { texto: 'Obesidad', tono: 'no' };
}

export const VALOR_CUMPLIMIENTO = { cumplio: 1, parcial: 0.5, no: 0 };

/* Resumen de cumplimiento de un paciente en una dieta (o en un solo día) */
export function resumenCumplimiento(cumplimiento, pacienteId, dieta, fecha) {
  let posibles = 0;
  let registrados = 0;
  let puntos = 0;

  dieta.dias
    .filter((dia) => !fecha || dia.fecha === fecha)
    .forEach((dia) => {
      comidasEvaluables(dia).forEach((c) => {
        posibles += 1;
        const estado = cumplimiento[`${pacienteId}|${dieta.id}|${dia.fecha}|${c.tiempo}`];
        if (estado) {
          registrados += 1;
          puntos += VALOR_CUMPLIMIENTO[estado];
        }
      });
    });

  return {
    posibles,
    registrados,
    porcentaje: registrados ? Math.round((puntos / registrados) * 100) : null,
  };
}

/* Acepta 'AAAA-MM-DD' (fecha local) o una fecha ISO completa del servidor */
export const formatoFecha = (iso, opciones = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!iso) return '—';
  const texto = String(iso);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T00:00:00`) : new Date(texto);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-MX', opciones);
};

/* Fecha de una medición guardada como medianoche UTC → AAAA-MM-DD sin desfase de zona */
export const fechaISO = (valor) => (valor ? String(valor).slice(0, 10) : '');
