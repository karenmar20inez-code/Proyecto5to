/* Panel de vidrio para una gráfica con estados de carga y "sin datos" */
function PanelGrafica({ titulo, descripcion, cargando, vacio, mensajeVacio, alto = 262, acciones, children, className = '' }) {
  let contenido;
  if (cargando) contenido = <div className="esqueleto" style={{ height: alto }} aria-busy="true" />;
  else if (vacio) contenido = <p className="vacio" style={{ minHeight: alto / 2 }}>{mensajeVacio || 'Sin registros en el periodo seleccionado.'}</p>;
  else contenido = <div className="grafica-lienzo" style={{ height: alto }}>{children}</div>;

  return (
    <section className={`panel panel-grafica ${className}`}>
      <div className="panel-encabezado">
        <div>
          <h2>{titulo}</h2>
          {descripcion && <p className="panel-descripcion">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {contenido}
    </section>
  );
}

export default PanelGrafica;
