import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card/card';
import './Dashboard.css'; 

// Importamos los íconos desde la librería react-icons
import { FiPieChart, FiPackage, FiUsers, FiBarChart2, FiSettings, FiUser } from 'react-icons/fi';

function Dashboard() {
  return (
    <div className="dashboard-layout">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="sidebar">
        <h2>La Nutria</h2>
        <nav>
          <Link to="/" className="menu-item active">
            <FiPieChart size={20} /> Dashboard
          </Link>
          <Link to="/productos" className="menu-item">
            <FiPackage size={20} /> Productos
          </Link>
          <Link to="/clientes" className="menu-item">
            <FiUsers size={20} /> Clientes
          </Link>
          <Link to="/reportes" className="menu-item">
            <FiBarChart2 size={20} /> Reportes
          </Link>
          <Link to="/configuracion" className="menu-item">
            <FiSettings size={20} /> Configuración
          </Link>
        </nav>
      </aside>

      {/* ================= ÁREA PRINCIPAL ================= */}
      <main className="main-area">
        
        {/* TOPBAR */}
        <header className="topbar">
          <div className="user-icon">
            <FiUser size={20} color="white" />
          </div>
        </header>

        {/* CONTENIDO DEL DASHBOARD */}
        <section className="content">
          <h1>Dashboard</h1>
          
          <div className="cards-grid">
            <Card 
              titulo="PACIENTE 1" 
              valor="100%" 
              descripcion="Buen estado." 
            />
            <Card 
              titulo="PACIENTE 2" 
              valor="80%" 
              descripcion="Estable." 
            />
            <Card 
              titulo="PACIENTE 3" 
              valor="60%" 
              descripcion="Grave." 
            />
            <Card 
              titulo="PACIENTE 4" 
              valor="60%" 
              descripcion="Crítico." 
            />
          </div>
        </section>

      </main>
    </div>
  );
}

export default Dashboard;