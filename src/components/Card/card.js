import React from 'react';
import './Card.css';

function Card({ titulo, valor, descripcion }) {
  return (
    <div className="Card-kpi">
      <h3>{titulo}</h3>
      <p className="Card-valor">{valor}</p>
      <p className="Card-descripcion">{descripcion}</p>
    </div>
  );
}

export default Card;