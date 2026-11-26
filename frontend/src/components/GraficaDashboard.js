
import React, { useState } from "react";

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

import { Radar, Pie } from "react-chartjs-2";
import { FiSearch, FiUsers } from "react-icons/fi";

import "./GraficaDashboard.css";
import { colorTema } from "./Graficas/graficas";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ArcElement
);

// Tipografía del sistema de diseño en las gráficas
ChartJS.defaults.font.family = "'Roboto', system-ui, sans-serif";

/* mostrarGraficas = false oculta las gráficas de ejemplo y conserva la tabla de usuarios */
function GraficaDashboard({ mostrarGraficas = true }) {

  // =====================================
  // GRÁFICA DE RADAR
  // =====================================

  const radarData = {
    labels: [
      "Consultas",
      "Adherencia",
      "Hidratación",
      "Actividad física",
      "Seguimiento",
      "Hábitos saludables",
      "Evaluaciones",
    ],

    datasets: [
      {
        label: "Mujeres",
        data: [85, 90, 75, 80, 95, 88, 82],
        fill: true,
        backgroundColor: colorTema("--grafica-2-suave"),
        borderColor: colorTema("--grafica-2"),
        pointBackgroundColor: colorTema("--grafica-2"),
        pointBorderColor: colorTema("--grafica-fondo"),
        pointHoverBackgroundColor: colorTema("--grafica-fondo"),
        pointHoverBorderColor: colorTema("--grafica-2"),
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
      },

      {
        label: "Hombres",
        data: [75, 80, 85, 90, 78, 82, 88],
        fill: true,
        backgroundColor: colorTema("--grafica-1-suave"),
        borderColor: colorTema("--grafica-1"),
        pointBackgroundColor: colorTema("--grafica-1"),
        pointBorderColor: colorTema("--grafica-fondo"),
        pointHoverBackgroundColor: colorTema("--grafica-fondo"),
        pointHoverBorderColor: colorTema("--grafica-1"),
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
      },
    ],
  };

  // OPCIONES Y ANIMACIONES DEL RADAR
  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 1800,
      easing: "easeOutQuart",
    },

    transitions: {
      active: {
        animation: {
          duration: 400,
        },
      },
    },

    interaction: {
      intersect: false,
      mode: "nearest",
    },

    plugins: {
      legend: {
        position: "bottom",

        labels: {
          color: colorTema("--grafica-texto"),
          padding: 15,
          font: {
            size: 12,
            weight: "bold",
          },
        },
      },

      tooltip: {
        titleColor: colorTema("--grafica-tooltip-titulo"),
        bodyColor: colorTema("--grafica-tooltip-texto"),
        backgroundColor: colorTema("--grafica-fondo"),
        borderColor: colorTema("--grafica-tooltip-borde"),
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
      },
    },

    scales: {
      r: {
        min: 0,
        max: 100,

        ticks: {
          stepSize: 20,
          color: colorTema("--grafica-texto"),
          backdropColor: "transparent",
        },

        angleLines: {
          color: colorTema("--grafica-eje"),
        },

        grid: {
          color: colorTema("--grafica-rejilla"),
        },

        pointLabels: {
          color: colorTema("--grafica-texto"),
          font: {
            size: 11,
            weight: "bold",
          },
        },
      },
    },
  };

  // =====================================
  // GRÁFICA CIRCULAR
  // =====================================

  const pieData = {
    labels: ["Mujeres", "Hombres"],

    datasets: [
      {
        label: "Cantidad de pacientes",
        data: [300, 200],

        backgroundColor: [
          colorTema("--grafica-2"),
          colorTema("--grafica-1"),
        ],

        borderColor: colorTema("--grafica-tooltip-borde"),
        borderWidth: 3,

        hoverOffset: 15,

        hoverBorderColor: colorTema("--grafica-fondo"),
        hoverBorderWidth: 4,
      },
    ],
  };

  // OPCIONES Y ANIMACIONES DE LA GRÁFICA CIRCULAR
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 1800,
      easing: "easeOutQuart",
      animateRotate: true,
      animateScale: true,
    },

    transitions: {
      active: {
        animation: {
          duration: 400,
        },
      },
    },

    plugins: {
      legend: {
        position: "bottom",

        labels: {
          color: colorTema("--grafica-texto"),
          padding: 15,
          font: {
            size: 12,
            weight: "bold",
          },
        },
      },

      tooltip: {
        titleColor: colorTema("--grafica-tooltip-titulo"),
        bodyColor: colorTema("--grafica-tooltip-texto"),
        backgroundColor: colorTema("--grafica-fondo"),
        borderColor: colorTema("--grafica-tooltip-borde"),
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
      },
    },
  };

  // =====================================
  // EMPLEADOS
  // =====================================

  const empleados = [
    {
      id: "001",
      iniciales: "KC",
      nombre: "Karen Correa",
      puesto: "Administradora",
      correo: "—",
      telefono: "—",
      estado: "Activo",
    },

    {
      id: "002",
      iniciales: "LM",
      nombre: "Luis Mata",
      puesto: "Nutriólogo",
      correo: "—",
      telefono: "—",
      estado: "Activo",
    },

    {
      id: "003",
      iniciales: "JC",
      nombre: "Julio Cadena",
      puesto: "Nutriólogo",
      correo: "—",
      telefono: "—",
      estado: "Activo",
    },
  ];

  // =====================================
  // BUSCADOR DE EMPLEADOS
  // =====================================

  const [busqueda, setBusqueda] = useState("");

  const empleadosFiltrados = empleados.filter((empleado) => {
    const texto = busqueda.toLowerCase().trim();

    return (
      empleado.id.toLowerCase().includes(texto) ||
      empleado.nombre.toLowerCase().includes(texto) ||
      empleado.puesto.toLowerCase().includes(texto) ||
      empleado.correo.toLowerCase().includes(texto)
    );
  });

  // =====================================
  // VISTA
  // =====================================

  return (
    <div className="dashboard-estadisticas">

      {/* GRÁFICAS */}
      {mostrarGraficas && (
      <div className="graficas-grid">

        {/* RADAR */}
        <section className="grafica-dashboard">

          <h2>Seguimiento nutricional</h2>

          <p className="grafica-descripcion">
            Comparación de indicadores entre mujeres y hombres.
          </p>

          <div className="grafica-contenedor">
            <Radar
              data={radarData}
              options={radarOptions}
            />
          </div>

        </section>

        {/* GRÁFICA CIRCULAR */}
        <section className="grafica-dashboard">

          <h2>Pacientes por género</h2>

          <p className="grafica-descripcion">
            Distribución de pacientes registrados.
          </p>

          <div className="grafica-contenedor">
            <Pie
              data={pieData}
              options={pieOptions}
            />
          </div>

        </section>

      </div>
      )}

      {/* TABLA DE EMPLEADOS */}
      <section className="tabla-empleados">

        <div className="tabla-empleados-header">

          <div>
            <h2>Usuarios del sistema</h2>
            <p>Personal registrado en NUTRIVA</p>
          </div>

          <span className="total-empleados">
            {empleadosFiltrados.length} de {empleados.length} empleados
          </span>

        </div>

        {/* BUSCADOR */}
        <div className="buscador-empleados">

          <FiSearch size={19} />

          <input
            type="text"
            placeholder="Buscar por ID, nombre, puesto o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

        </div>

        {/* TABLA */}
        <div className="tabla-scroll">

          <table className="tabla-usuarios">

            <thead>
              <tr>
                <th>ID</th>
                <th>Empleado</th>
                <th>Puesto</th>
                <th>Correo electrónico</th>
                <th>Teléfono</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>

              {empleadosFiltrados.length > 0 ? (

                empleadosFiltrados.map((empleado) => (

                  <tr key={empleado.id}>

                    <td className="id-empleado">
                      {empleado.id}
                    </td>

                    <td>
                      <div className="empleado-info">

                        <div className="empleado-avatar">
                          {empleado.iniciales}
                        </div>

                        <span>{empleado.nombre}</span>

                      </div>
                    </td>

                    <td>{empleado.puesto}</td>

                    <td>{empleado.correo}</td>

                    <td>{empleado.telefono}</td>

                    <td>
                      <span
                        className={
                          empleado.estado === "Activo"
                            ? "estado-activo"
                            : "estado-inactivo"
                        }
                      >
                        {empleado.estado}
                      </span>
                    </td>

                  </tr>

                ))

              ) : (

                <tr>
                  <td colSpan="6" className="sin-resultados">
                    <FiUsers size={22} />
                    <span>No se encontraron empleados.</span>
                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

export default GraficaDashboard;
