import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPrinter, FiUserPlus, FiX } from 'react-icons/fi';
import Layout from '../../components/Layout/Layout';
import { DIETAS, comidasEvaluables } from '../../data/dietas';
import { useNutri, nombreCompleto, formatoFecha } from '../../context/NutriContext';
import './Dietas.css';

function Dietas() {
  const { pacientes, actualizarPaciente } = useNutri();
  const [dietaId, setDietaId] = useState(DIETAS[0].id);
  const dieta = DIETAS.find((d) => d.id === dietaId);
  const [diaActivo, setDiaActivo] = useState(dieta.dias[0].fecha);
  const [porAsignar, setPorAsignar] = useState('');

  const dia = dieta.dias.find((d) => d.fecha === diaActivo) || dieta.dias[0];
  const asignados = pacientes.filter((p) => p.dietaId === dieta.id);
  const disponibles = pacientes.filter((p) => p.dietaId !== dieta.id);

  const totalComidas = dieta.dias.reduce((t, d) => t + comidasEvaluables(d).length, 0);
  const diasConPlan = dieta.dias.filter((d) => comidasEvaluables(d).length).length;

  /* La asignación se guarda en el paciente (API) */
  const cambiarDieta = (id, dietaId) =>
    actualizarPaciente(id, { dietaId }).catch((error) => window.alert(error.message));

  const asignar = async () => {
    if (!porAsignar) return;
    await cambiarDieta(porAsignar, dieta.id);
    setPorAsignar('');
  };

  return (
    <Layout
      titulo="Dietas"
      acciones={
        <>
          {DIETAS.length > 1 && (
            <select className="selector" value={dietaId} onChange={(e) => setDietaId(e.target.value)}>
              {DIETAS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          )}
          <button className="boton boton--secundario" onClick={() => window.print()}>
            <FiPrinter /> Imprimir
          </button>
        </>
      }
    >
      <div className="rejilla-aurea">
        {/* PLAN DEL DÍA */}
        <section className="panel">
          <div className="panel-encabezado">
            <div>
              <h2>{dieta.nombre}</h2>
              <p className="panel-descripcion">
                {formatoFecha(dieta.inicio, { weekday: 'long', day: 'numeric', month: 'long' })}
                {' – '}
                {formatoFecha(dieta.fin, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="pestanas" role="tablist">
            {dieta.dias.map((d) => (
              <button
                key={d.fecha}
                role="tab"
                aria-selected={d.fecha === dia.fecha}
                className={`pestana${d.fecha === dia.fecha ? ' pestana--activa' : ''}`}
                onClick={() => setDiaActivo(d.fecha)}
              >
                {d.dia}
                <small>{formatoFecha(d.fecha, { day: 'numeric' })}</small>
              </button>
            ))}
          </div>

          {dia.comidas.length === 0 ? (
            <div className="comida comida--pendiente vacio">{dia.pendiente}</div>
          ) : (
            <div className="comidas-grid">
              {dia.comidas.map((c) =>
                c.platillo ? (
                  <article key={c.tiempo} className="comida">
                    <span className="comida__tiempo">{c.tiempo}</span>
                    <h3>{c.platillo}</h3>
                    <ul>
                      {c.ingredientes.map((ing, n) => (
                        <li key={n}>
                          <span>{ing.alimento}</span>
                          <span>{ing.cantidad || 'Al gusto'}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : (
                  <article key={c.tiempo} className="comida comida--pendiente">
                    <span className="comida__tiempo">{c.tiempo}</span>
                    <p style={{ margin: 'var(--esp-sm) 0 0' }}>{c.pendiente}</p>
                  </article>
                )
              )}
            </div>
          )}

          {dieta.nota && <p className="aviso"><strong>Nota:</strong> {dieta.nota}</p>}
        </section>

        {/* RESUMEN Y ASIGNACIÓN */}
        <div>
          <section className="panel">
            <h2>Resumen</h2>
            <p className="panel-descripcion">Estructura del plan semanal.</p>
            <dl className="datos">
              <dt>Días con plan</dt><dd>{diasConPlan} de {dieta.dias.length}</dd>
              <dt>Tiempos de comida</dt><dd>{totalComidas}</dd>
              <dt>Comidas del día</dt><dd>{comidasEvaluables(dia).length}</dd>
              <dt>Pacientes</dt><dd>{asignados.length}</dd>
            </dl>
            {diasConPlan < dieta.dias.length && (
              <p className="aviso">
                Faltan alimentos para sábado, domingo y la cena del viernes. Complétalos antes
                de entregar el plan.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Pacientes asignados</h2>
            <p className="panel-descripcion">Quién sigue este plan.</p>

            {asignados.length === 0 ? (
              <p className="vacio">Ningún paciente tiene este plan.</p>
            ) : (
              <ul className="asignados">
                {asignados.map((p) => (
                  <li key={p.id}>
                    <Link to={`/cumplimiento?paciente=${p.id}`} className="celda-fuerte" style={{ textDecoration: 'none' }}>
                      {nombreCompleto(p)}
                    </Link>
                    <button
                      className="boton boton--peligro boton--chico"
                      onClick={() => cambiarDieta(p.id, '')}
                      aria-label={`Quitar plan a ${nombreCompleto(p)}`}
                      title="Quitar plan"
                    >
                      <FiX />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {disponibles.length > 0 && (
              <div className="asignar">
                <select
                  className="selector"
                  value={porAsignar}
                  onChange={(e) => setPorAsignar(e.target.value)}
                  aria-label="Paciente por asignar"
                >
                  <option value="">Elegir paciente…</option>
                  {disponibles.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}
                </select>
                <button className="boton boton--primario" onClick={asignar} disabled={!porAsignar}>
                  <FiUserPlus /> Asignar
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}

export default Dietas;
