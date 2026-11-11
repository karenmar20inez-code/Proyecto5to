import React from "react";
import "./Card.css";

function Card({ titulo, valor, descripcion }) {
  return (
    <div className="card-kpi">
      <h3>{titulo}</h3>
      <p className="card-valor">{valor}</p>
      <p className="card-descripcion">{descripcion}</p>
    </div>
  );
}

export default Card;