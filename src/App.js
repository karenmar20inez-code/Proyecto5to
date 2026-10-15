import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard/Dashboard';
import Configuracion from './pages/Configuracion/Configuracion';
import Perfil from './pages/Perfil/Perfil';
import Reportes from './pages/Reportes/Reportes';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/reportes" element={<Reportes />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;