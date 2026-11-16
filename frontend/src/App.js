import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import Loader from './components/Loaders/Loaders';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Productos from './pages/Productos/Productos';
import Pacientes from './pages/Pacientes/Pacientes';
import Dietas from './pages/Dietas/Dietas';
import Cumplimiento from './pages/Cumplimiento/Cumplimiento';
import Reportes from './pages/Reportes/Reportes';
import Configuracion from './pages/Configuracion/Configuracion';
import Perfil from './pages/Perfil/Perfil';
import MiEspacio from './pages/MiEspacio/MiEspacio';
import Login from './pages/Login/Login';
import FichaPaciente from './pages/Expediente/FichaPaciente';
import Documento from './pages/Documento/Documento';
import Expedientes from './pages/Expedientes/Expedientes';
import ConsultasGlobal from './pages/ConsultasGlobal/ConsultasGlobal';
import Evaluaciones from './pages/Evaluaciones/Evaluaciones';
import LaboratorioGlobal from './pages/LaboratorioGlobal/LaboratorioGlobal';
import Agenda from './pages/Agenda/Agenda';
import Alertas from './pages/Alertas/Alertas';
import Administracion from './pages/Administracion/Administracion';
import { NutriProvider } from './context/NutriContext';
import { AuthProvider, useAuth } from './context/AuthContext';

import './App.css';

/* Ruta que exige un permiso; si falta, muestra un aviso (la API también lo valida) */
function Protegida({ permiso, children }) {
  const { puede } = useAuth();
  if (!permiso || puede(permiso)) return children;
  return (
    <Layout titulo="Acceso restringido">
      <section className="panel vacio" role="alert">Tu rol no tiene permiso para esta sección.</section>
    </Layout>
  );
}

/* Redirecciones de rutas anteriores hacia la ficha del paciente */
function RedirigirAnalisis() {
  const { id } = useParams();
  return <Navigate to={`/pacientes/${id}/evolucion`} replace />;
}
function RedirigirHistorial() {
  const [params] = useSearchParams();
  const id = params.get('paciente');
  return <Navigate to={id ? `/pacientes/${id}/antropometria` : '/expedientes'} replace />;
}

/* Configuración: administración del sistema para el rol administrador; cuenta personal para los demás */
function ConfiguracionSegunRol() {
  const { puede } = useAuth();
  return puede('administracion') ? <Administracion /> : <Perfil />;
}

function Inicio() {
  const { puede, usuario } = useAuth();
  if (usuario?.rol === 'paciente') return <Navigate to="/mi-espacio" replace />; // portal propio
  if (puede('estadisticas:leer')) return <Dashboard />;
  return <Navigate to={puede('agenda:leer') ? '/agenda' : '/perfil'} replace />;
}

function ContenidoApp() {
  const [cargando, setCargando] = useState(true);
  const { usuario } = useAuth();

  useEffect(() => {
    const temporizador = setTimeout(() => setCargando(false), 300);
    return () => clearTimeout(temporizador);
  }, []);

  if (cargando) {
    return (
      <div className="loader-pantalla-completa">
        <Loader />
      </div>
    );
  }

  // Contraseña temporal: solo "Mi perfil" hasta que la cambie
  if (usuario?.debeCambiarContrasena) {
    return (
      <Routes>
        <Route path="/perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/perfil" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/pacientes" element={<Protegida permiso="pacientes:leer"><Pacientes /></Protegida>} />
      <Route path="/pacientes/:id/documentos/:tipo" element={<Protegida permiso="reportes:generar"><Documento /></Protegida>} />
      <Route path="/pacientes/:id/analisis" element={<RedirigirAnalisis />} />
      <Route path="/pacientes/:id" element={<Protegida permiso="clinico:leer"><FichaPaciente /></Protegida>} />
      <Route path="/pacientes/:id/:pestana" element={<Protegida permiso="clinico:leer"><FichaPaciente /></Protegida>} />
      <Route path="/expedientes" element={<Protegida permiso="clinico:leer"><Expedientes /></Protegida>} />
      <Route path="/consultas" element={<Protegida permiso="clinico:leer"><ConsultasGlobal /></Protegida>} />
      <Route path="/evaluaciones" element={<Protegida permiso="clinico:leer"><Evaluaciones /></Protegida>} />
      <Route path="/dietas" element={<Protegida permiso="dietas:leer"><Dietas /></Protegida>} />
      <Route path="/cumplimiento" element={<Protegida permiso="clinico:leer"><Cumplimiento /></Protegida>} />
      <Route path="/laboratorio" element={<Protegida permiso="clinico:leer"><LaboratorioGlobal /></Protegida>} />
      <Route path="/agenda" element={<Protegida permiso="agenda:leer"><Agenda /></Protegida>} />
      <Route path="/alertas" element={<Protegida permiso="clinico:leer"><Alertas /></Protegida>} />
      <Route path="/reportes" element={<Protegida permiso="reportes:generar"><Reportes /></Protegida>} />
      <Route path="/administracion" element={<Protegida permiso="administracion"><Administracion /></Protegida>} />
      <Route path="/perfil" element={<Perfil />} />
      <Route path="/mi-espacio" element={<Protegida permiso="portal:propio"><MiEspacio /></Protegida>} />
      <Route path="/mi-espacio/:seccion" element={<Protegida permiso="portal:propio"><MiEspacio /></Protegida>} />
      <Route path="/configuracion" element={<ConfiguracionSegunRol />} />
      <Route path="/configuracion-general" element={<Configuracion />} />
      <Route path="/productos" element={<Productos />} />
      <Route path="/historial-clinico" element={<RedirigirHistorial />} />
      <Route path="/clientes" element={<Navigate to="/pacientes" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/* Sin sesión: pantalla de inicio de sesión. Con sesión: la aplicación. */
function Aplicacion() {
  const { usuario, verificando } = useAuth();
  if (verificando) {
    return <div className="loader-pantalla-completa"><Loader /></div>;
  }
  if (!usuario) return <Login />;
  return (
    <NutriProvider key={usuario._id}>
      <BrowserRouter>
        <ContenidoApp />
      </BrowserRouter>
    </NutriProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Aplicacion />
    </AuthProvider>
  );
}

export default App;
