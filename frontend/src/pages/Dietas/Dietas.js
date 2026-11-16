import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPrinter, FiUserPlus, FiX, FiPlus, FiEdit2, FiRefreshCw } from 'react-icons/fi';
import Layout from '../../components/Layout/Layout';
import { comidasEvaluables } from '../../data/dietas';
import { useNutri, nombreCompleto, formatoFecha } from '../../context/NutriContext';
import { useAuth } from '../../context/AuthContext';
import EditorDieta from './EditorDieta';
import './Dietas.css';

function Dietas() {
  const {
    pacientes, actualizarPaciente,
    dietas, cargandoDietas, errorDietas, recargarDietas, guardarDieta,
  } = useNutri();
  const { puede } = useAuth();
  const editable = puede('dietas:escribir');
  const veePacientes = puede('pacientes:leer'); // los docentes consultan el plan sin datos de pacientes

  const [dietaId, setDietaId] = useState('');
  const [diaActivo, setDiaActivo] = useState('');
  const [porAsignar, setPorAsignar] = useState('');
  const [editor, setEditor] = useState(null); // null cerrado · { dieta: null } nueva · { dieta } edición

  const dieta = dietas.find((d) => d.id === dietaId) || dietas[0] || null;

  /* Al cambiar de dieta, se vuelve al primer día */
  useEffect(() => { setDiaActivo(dieta?.dias[0]?.fecha || ''); }, [dieta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* La asignación se guarda en el paciente (API) */
  const cambiarDieta = (id, nuevaDietaId) =>
    actualizarPaciente(id, { dietaId: nuevaDietaId }).catch((error) => window.alert(error.message));

  const asignar = async () => {
    if (!porAsignar || !dieta) return;
    await cambiarDieta(porAsignar, dieta.id);
    setPorAsignar('');
  };

  const guardar = async (datos) => {
    const guardada = await guardarDieta(editor.dieta?.id, datos);
    setDietaId(guardada.id);
    setEditor(null);
  };

  const archivar = async () => {
    await guardarDieta(editor.dieta.id, { activa: false });
    setDietaId('');
    setEditor(null);
  };

  const acciones = (
    <>
      {dietas.length > 1 && (
        <select className="selector" value={dieta?.id || ''} onChange={(e) => setDietaId(e.target.value)} aria-label="Dieta">
          {dietas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      )}
      {editable && dieta && (
        <button className="boton boton--secundario" onClick={() => setEditor({ dieta })}>
          <FiEdit2 /> Editar dieta
        </button>
      )}
      {editable && (
        <button className="boton boton--primario" onClick={() => setEditor({ dieta: null })}>
          <FiPlus /> Nueva dieta
        </button>
      )}
      {dieta && (
        <button className="boton boton--secundario" onClick={() => window.print()}>
          <FiPrinter /> Imprimir
        </button>
      )}
    </>
  );

  const editorModal = (
    <EditorDieta abierto={!!editor} dieta={editor?.dieta || null} onGuardar={guardar}
      onArchivar={editor?.dieta ? archivar : undefined} onCerrar={() => setEditor(null)} />
  );

  if (!dieta) {
    return (
      <Layout titulo="Dietas" acciones={acciones}>
        <section className="panel">
          {cargandoDietas ? <p className="vacio">Cargando dietas…</p> : errorDietas ? (
            <p className="vacio">
              {errorDietas}{' '}
              <button className="boton boton--secundario boton--chico" onClick={recargarDietas}><FiRefreshCw /> Reintentar</button>
            </p>
          ) : (
            <p className="vacio">Aún no hay dietas en el catálogo.{editable && ' Crea la primera con “Nueva dieta”.'}</p>
          )}
        </section>
        {editorModal}
      </Layout>
    );
  }

  const dia = dieta.dias.find((d) => d.fecha === diaActivo) || dieta.dias[0];
  const asignados = pacientes.filter((p) => p.dietaId === dieta.id);
  const disponibles = pacientes.filter((p) => p.dietaId !== dieta.id);

  const totalComidas = dieta.dias.reduce((t, d) => t + comidasEvaluables(d).length, 0);
  const diasConPlan = dieta.dias.filter((d) => comidasEvaluables(d).length).length;
  /* Qué falta por completar (días vacíos y comidas sin definir) */
  const diasVacios = dieta.dias.filter((d) => !comidasEvaluables(d).length).map((d) => d.dia.toLowerCase());
  const comidasPendientes = dieta.dias.flatMap((d) => d.comidas.filter((c) => !c.platillo).map((c) => `${c.tiempo.toLowerCase()} del ${d.dia.toLowerCase()}`));
  const faltantes = [...diasVacios, ...comidasPendientes];

  return (
    <Layout titulo="Dietas" acciones={acciones}>
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
            <div className="comida comida--pendiente vacio">{dia.pendiente || 'Sin alimentos registrados en el plan.'}</div>
          ) : (
            <div className="comidas-grid">
              {dia.comidas.map((c, n) =>
                c.platillo ? (
                  <article key={`${c.tiempo}-${n}`} className="comida">
                    <span className="comida__tiempo">{c.tiempo}</span>
                    <h3>{c.platillo}</h3>
                    <ul>
                      {c.ingredientes.map((ing, k) => (
                        <li key={k}>
                          <span>{ing.alimento}</span>
                          <span>{ing.cantidad || 'Al gusto'}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : (
                  <article key={`${c.tiempo}-${n}`} className="comida comida--pendiente">
                    <span className="comida__tiempo">{c.tiempo}</span>
                    <p style={{ margin: 'var(--esp-sm) 0 0' }}>{c.pendiente || 'Por definir.'}</p>
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
            {faltantes.length > 0 && (
              <p className="aviso">
                Faltan alimentos en: {faltantes.join(', ')}. Complétalos antes de entregar el plan.
              </p>
            )}
          </section>

          {veePacientes && (
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
          )}
        </div>
      </div>
      {editorModal}
    </Layout>
  );
}

export default Dietas;
