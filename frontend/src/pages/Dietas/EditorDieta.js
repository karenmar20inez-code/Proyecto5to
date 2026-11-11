import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2, FiCopy, FiSave, FiArchive } from 'react-icons/fi';
import Modal from '../../components/ui/Modal';
import { TIEMPOS_COMIDA, diasEntre } from '../../data/dietas';
import { formatoFecha } from '../../context/NutriContext';

const hoy = () => new Date().toISOString().slice(0, 10);
const masDias = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ingredienteVacio = () => ({ alimento: '', cantidad: '' });
const comidaVacia = (tiempo = '') => ({ tiempo, platillo: '', ingredientes: [ingredienteVacio()] });

/* Copia profunda para editar sin tocar la dieta del catálogo */
const copiar = (x) => JSON.parse(JSON.stringify(x));

function nuevaDieta() {
  const inicio = hoy();
  const fin = masDias(inicio, 6);
  return { nombre: '', inicio, fin, nota: '', dias: diasEntre(inicio, fin) };
}

/* Quita filas vacías antes de enviar; una comida sin platillo ni ingredientes queda "por definir" */
function limpiar(f) {
  return {
    nombre: f.nombre.trim(),
    inicio: f.inicio,
    fin: f.fin,
    nota: f.nota.trim(),
    dias: f.dias.map((d) => {
      const comidas = d.comidas
        .filter((c) => c.tiempo.trim())
        .map((c) => {
          const ingredientes = c.ingredientes
            .filter((i) => i.alimento.trim())
            .map((i) => ({ alimento: i.alimento.trim(), cantidad: i.cantidad.trim() }));
          const platillo = (c.platillo || '').trim();
          return platillo || ingredientes.length
            ? { tiempo: c.tiempo.trim(), platillo: platillo || ingredientes.map((i) => i.alimento).join(', '), ingredientes }
            : { tiempo: c.tiempo.trim(), platillo: null, pendiente: 'Por definir.', ingredientes: [] };
        });
      return { dia: d.dia, fecha: d.fecha, comidas, ...(comidas.length ? {} : { pendiente: 'Sin alimentos registrados en el plan.' }) };
    }),
  };
}

/**
 * Editor de una dieta semanal en ventana modal.
 * `dieta` null → nueva dieta. Guarda con `onGuardar(datos)` y archiva con `onArchivar()`.
 */
function EditorDieta({ abierto, dieta, onGuardar, onArchivar, onCerrar }) {
  const [f, setF] = useState(nuevaDieta);
  const [diaActivo, setDiaActivo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setF(dieta ? { ...copiar(dieta), nota: dieta.nota || '' } : nuevaDieta());
    setDiaActivo(0);
    setError('');
    setConfirmarArchivo(false);
  }, [abierto, dieta]);

  /* Cambiar fechas regenera los días y conserva las comidas de las fechas que siguen dentro del rango */
  const cambiarFecha = (campo, valor) => setF((x) => {
    const sig = { ...x, [campo]: valor };
    return { ...sig, dias: diasEntre(sig.inicio, sig.fin, x.dias) };
  });

  const dia = f.dias[Math.min(diaActivo, f.dias.length - 1)];
  const iDia = f.dias.indexOf(dia);

  /* Actualiza el día activo de forma inmutable */
  const editarDia = (fn) => setF((x) => ({ ...x, dias: x.dias.map((d, n) => (n === iDia ? fn(copiar(d)) : d)) }));
  const editarComida = (ic, fn) => editarDia((d) => { d.comidas[ic] = fn(d.comidas[ic]); return d; });

  const copiarDiaAnterior = () => {
    if (iDia < 1) return;
    const previo = f.dias[iDia - 1];
    editarDia((d) => ({ ...d, comidas: copiar(previo.comidas) }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    const datos = limpiar(f);
    if (!datos.dias.length) { setError('Revisa las fechas: el fin no puede ser anterior al inicio.'); return; }
    setGuardando(true);
    try {
      await onGuardar(datos);
    } catch (err) {
      const detalle = Object.values(err.errores || {})[0];
      setError(detalle ? `${err.message}: ${detalle}` : err.message);
    } finally {
      setGuardando(false);
    }
  };

  const archivar = async () => {
    setGuardando(true);
    try { await onArchivar(); } catch (err) { setError(err.message); setGuardando(false); }
  };

  return (
    <Modal abierto={abierto} titulo={dieta ? `Editar ${dieta.nombre}` : 'Nueva dieta'}
      descripcion="Plan semanal por días y tiempos de comida. Los cambios se guardan en la base de datos."
      onCerrar={onCerrar} cerrarAlFondo={false} ancho={900}>
      <form className="formulario editor-dieta" onSubmit={enviar}>
        <div className="campo campo--completo">
          <label htmlFor="dieta-nombre">Nombre de la dieta *</label>
          <input id="dieta-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required minLength={3} maxLength={120} placeholder="Ej. Dieta semana 3" />
        </div>
        <div className="campo">
          <label htmlFor="dieta-inicio">Inicio *</label>
          <input id="dieta-inicio" type="date" value={f.inicio} onChange={(e) => cambiarFecha('inicio', e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="dieta-fin">Fin *</label>
          <input id="dieta-fin" type="date" value={f.fin} min={f.inicio} onChange={(e) => cambiarFecha('fin', e.target.value)} required />
          <span className="campo__ayuda">{f.dias.length} {f.dias.length === 1 ? 'día' : 'días'} (máximo 14).</span>
        </div>
        <div className="campo campo--completo">
          <label htmlFor="dieta-nota">Nota para el paciente</label>
          <input id="dieta-nota" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} maxLength={1000} placeholder="Ej. Puedes usar sal y limón." />
        </div>

        {dia && (
          <div className="campo--completo">
            <div className="pestanas" role="tablist" aria-label="Días de la dieta">
              {f.dias.map((d, n) => (
                <button key={d.fecha} type="button" role="tab" aria-selected={n === iDia}
                  className={`pestana${n === iDia ? ' pestana--activa' : ''}`} onClick={() => setDiaActivo(n)}>
                  {d.dia} <small>{formatoFecha(d.fecha, { day: 'numeric' })}</small>
                  {d.comidas.length > 0 && <small aria-label={`${d.comidas.length} comidas`}>· {d.comidas.length}</small>}
                </button>
              ))}
            </div>

            <div className="editor-dieta__dia">
              {dia.comidas.length === 0 && <p className="vacio">Sin comidas para el {dia.dia.toLowerCase()}.</p>}
              {dia.comidas.map((c, ic) => (
                <fieldset key={ic} className="editor-dieta__comida">
                  <legend className="sr-only">Comida {ic + 1} del {dia.dia}</legend>
                  <div className="editor-dieta__fila">
                    <div className="campo">
                      <label htmlFor={`t-${iDia}-${ic}`}>Tiempo</label>
                      <input id={`t-${iDia}-${ic}`} list="tiempos-comida" value={c.tiempo} required maxLength={40}
                        onChange={(e) => editarComida(ic, (x) => ({ ...x, tiempo: e.target.value }))} />
                    </div>
                    <div className="campo">
                      <label htmlFor={`p-${iDia}-${ic}`}>Platillo</label>
                      <input id={`p-${iDia}-${ic}`} value={c.platillo || ''} maxLength={150} placeholder="Ej. Omelette con espinacas"
                        onChange={(e) => editarComida(ic, (x) => ({ ...x, platillo: e.target.value }))} />
                    </div>
                    <button type="button" className="boton boton--peligro boton--chico editor-dieta__quitar" title="Quitar comida"
                      aria-label={`Quitar ${c.tiempo || 'comida'}`} onClick={() => editarDia((d) => { d.comidas.splice(ic, 1); return d; })}>
                      <FiTrash2 />
                    </button>
                  </div>

                  <div className="editor-dieta__ingredientes">
                    {c.ingredientes.map((ing, ii) => (
                      <div key={ii} className="editor-dieta__ingrediente">
                        <input aria-label="Alimento" placeholder="Alimento" value={ing.alimento} maxLength={120}
                          onChange={(e) => editarComida(ic, (x) => { x.ingredientes[ii] = { ...x.ingredientes[ii], alimento: e.target.value }; return x; })} />
                        <input aria-label="Cantidad" placeholder="Cantidad (ej. 1 taza)" value={ing.cantidad} maxLength={80}
                          onChange={(e) => editarComida(ic, (x) => { x.ingredientes[ii] = { ...x.ingredientes[ii], cantidad: e.target.value }; return x; })} />
                        <button type="button" className="boton boton--secundario boton--chico boton--icono" aria-label="Quitar ingrediente" title="Quitar ingrediente"
                          onClick={() => editarComida(ic, (x) => { x.ingredientes.splice(ii, 1); return x; })}>
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="boton boton--fantasma boton--chico" onClick={() => editarComida(ic, (x) => ({ ...x, ingredientes: [...x.ingredientes, ingredienteVacio()] }))}>
                      <FiPlus /> Ingrediente
                    </button>
                  </div>
                </fieldset>
              ))}

              <div className="editor-dieta__acciones-dia">
                <button type="button" className="boton boton--secundario boton--chico"
                  onClick={() => editarDia((d) => ({ ...d, comidas: [...d.comidas, comidaVacia(TIEMPOS_COMIDA[Math.min(d.comidas.length, TIEMPOS_COMIDA.length - 1)])] }))}>
                  <FiPlus /> Agregar tiempo de comida
                </button>
                {iDia > 0 && (
                  <button type="button" className="boton boton--secundario boton--chico" onClick={copiarDiaAnterior}>
                    <FiCopy /> Copiar comidas del {f.dias[iDia - 1].dia.toLowerCase()}
                  </button>
                )}
              </div>
            </div>
            <datalist id="tiempos-comida">{TIEMPOS_COMIDA.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
        )}

        {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}

        <div className="formulario-acciones">
          {dieta && onArchivar && (confirmarArchivo ? (
            <span className="editor-dieta__confirmar">
              ¿Archivar? Dejará de ofrecerse para nuevos pacientes.
              <button type="button" className="boton boton--peligro boton--chico" onClick={archivar} disabled={guardando}>Sí, archivar</button>
              <button type="button" className="boton boton--secundario boton--chico" onClick={() => setConfirmarArchivo(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="boton boton--peligro editor-dieta__archivar" onClick={() => setConfirmarArchivo(true)} disabled={guardando}>
              <FiArchive /> Archivar
            </button>
          ))}
          <button type="button" className="boton boton--secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="boton boton--primario" disabled={guardando}>
            <FiSave /> {guardando ? 'Guardando…' : 'Guardar dieta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EditorDieta;
