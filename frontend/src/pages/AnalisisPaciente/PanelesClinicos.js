import { useState } from 'react';
import { FiPlus, FiCheck, FiX, FiSlash, FiSliders } from 'react-icons/fi';
import { prescripcionesApi, citasApi, evaluacionesApi } from '../../services/api';
import { formatoFecha, fechaISO } from '../../context/NutriContext';
import { Origen } from '../../components/Indicador/Indicador';

const hoy = () => new Date().toISOString().slice(0, 10);

function useEnvio(onListo) {
  const [error, setError] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const ejecutar = async (fn) => {
    setEnviando(true);
    setError('');
    setErrores({});
    try {
      await fn();
      onListo?.();
      return true;
    } catch (e) {
      setError(e.message);
      setErrores(e.errores || {});
      return false;
    } finally {
      setEnviando(false);
    }
  };
  return { error, errores, enviando, ejecutar };
}

/* ============================================================
 * PRESCRIPCIÓN (valores PRESCRITOS por el nutriólogo)
 * ============================================================ */
const CAMPOS_PRESCRIPCION = [
  ['pesoObjetivoKg', 'Peso objetivo', 'kg', '0.1'],
  ['cinturaObjetivoCm', 'Cintura objetivo', 'cm', '0.1'],
  ['grasaObjetivoPct', 'Grasa objetivo', '%', '0.1'],
  ['kcalObjetivo', 'Energía prescrita', 'kcal/día', '10'],
  ['factorActividad', 'Factor de actividad', '1.0–2.5', '0.05'],
  ['proteinasPct', 'Proteínas', '% energía', '1'],
  ['carbohidratosPct', 'Carbohidratos', '% energía', '1'],
  ['grasasPct', 'Grasas', '% energía', '1'],
  ['proteinaGKg', 'Proteína', 'g/kg', '0.1'],
  ['aguaObjetivoMl', 'Agua objetivo', 'ml/día', '50'],
  ['actividadObjetivoMinSemana', 'Actividad objetivo', 'min/semana', '10'],
];

export function PanelPrescripcion({ pacienteId, vigente, historial = [], onGuardado }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(() => ({
    fechaInicio: hoy(),
    notas: '',
    ...Object.fromEntries(CAMPOS_PRESCRIPCION.map(([c]) => [c, vigente?.[c] ?? ''])),
  }));
  const { error, errores, enviando, ejecutar } = useEnvio(() => { setAbierto(false); onGuardado?.(); });

  const sumaMacros = ['proteinasPct', 'carbohidratosPct', 'grasasPct']
    .map((c) => Number(form[c]) || 0).reduce((a, b) => a + b, 0);

  const enviar = (e) => {
    e.preventDefault();
    const datos = { fechaInicio: form.fechaInicio, notas: form.notas };
    CAMPOS_PRESCRIPCION.forEach(([c]) => { if (form[c] !== '') datos[c] = Number(form[c]); });
    ejecutar(() => prescripcionesApi.crear(pacienteId, datos));
  };

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Prescripción</h2>
          <p className="panel-descripcion">
            {vigente
              ? `Vigente desde ${formatoFecha(fechaISO(vigente.fechaInicio))} · ${vigente.responsable} · ${historial.length} versión(es)`
              : 'Sin prescripción registrada. Los objetivos y la distribución de macronutrientes dependen de ella.'}
          </p>
        </div>
        <button className="boton boton--secundario boton--chico" onClick={() => setAbierto(!abierto)}>
          <FiPlus /> {vigente ? 'Nueva versión' : 'Registrar'}
        </button>
      </div>

      {vigente && !abierto && (
        <dl className="datos">
          {CAMPOS_PRESCRIPCION.filter(([c]) => vigente[c] != null).map(([c, t, u]) => (
            <FragmentoDato key={c} t={t} v={`${vigente[c]} ${u}`} />
          ))}
          {vigente.notas && <FragmentoDato t="Notas" v={vigente.notas} />}
        </dl>
      )}

      {abierto && (
        <form className="formulario" onSubmit={enviar}>
          <div className="campo campo--completo">
            <label htmlFor="p-fecha">Aplica desde *</label>
            <input id="p-fecha" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} required />
          </div>
          {CAMPOS_PRESCRIPCION.map(([c, t, u, paso]) => (
            <div className="campo" key={c}>
              <label htmlFor={`p-${c}`}>{t} ({u})</label>
              <input id={`p-${c}`} type="number" step={paso} min="0" value={form[c]} onChange={(e) => setForm({ ...form, [c]: e.target.value })} />
              {errores[c] && <small className="campo__error">{errores[c]}</small>}
            </div>
          ))}
          <p className={`campo--completo ${sumaMacros && Math.abs(sumaMacros - 100) > 0.5 ? 'campo__error' : 'panel-descripcion'}`} style={{ margin: 0 }}>
            Macronutrientes: {sumaMacros} % (deben sumar 100 %).
          </p>
          <div className="campo campo--completo">
            <label htmlFor="p-notas">Notas</label>
            <textarea id="p-notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} maxLength={2000} />
          </div>
          {(error || errores.macronutrientes) && <p className="aviso aviso--error campo--completo" role="alert">{errores.macronutrientes || error}</p>}
          <div className="formulario-acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setAbierto(false)}>Cancelar</button>
            <button type="submit" className="boton boton--primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar prescripción'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

const FragmentoDato = ({ t, v }) => (<><dt>{t}</dt><dd>{v}</dd></>);

/* ============================================================
 * CITAS
 * ============================================================ */
const ESTADO_CITA = {
  programada: { texto: 'Programada', tono: '' },
  realizada: { texto: 'Realizada', tono: 'ok' },
  cancelada: { texto: 'Cancelada', tono: 'medio' },
  no_asistio: { texto: 'No asistió', tono: 'no' },
};

export function PanelCitas({ pacienteId, citas = [], onCambio }) {
  const [form, setForm] = useState({ fecha: hoy(), hora: '10:00', motivo: 'Seguimiento' });
  const { error, enviando, ejecutar } = useEnvio(onCambio);

  const crear = (e) => {
    e.preventDefault();
    const fechaHora = new Date(`${form.fecha}T${form.hora}`).toISOString();
    ejecutar(() => citasApi.crear(pacienteId, { fechaHora, motivo: form.motivo }));
  };
  const estado = (cita, nuevo) => {
    const motivo = nuevo === 'cancelada' ? window.prompt('Motivo de la cancelación (opcional):') ?? undefined : undefined;
    ejecutar(() => citasApi.actualizar(cita._id, { estado: nuevo, motivoCambio: motivo }));
  };

  return (
    <section className="panel">
      <h2>Citas</h2>
      <p className="panel-descripcion">Programadas, realizadas y canceladas en el periodo.</p>
      <form className="formulario" onSubmit={crear}>
        <div className="campo"><label htmlFor="c-fecha">Fecha</label>
          <input id="c-fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></div>
        <div className="campo"><label htmlFor="c-hora">Hora</label>
          <input id="c-hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required /></div>
        <div className="campo campo--completo"><label htmlFor="c-motivo">Motivo</label>
          <input id="c-motivo" value={form.motivo} maxLength={200} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
        {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
        <div className="formulario-acciones">
          <button className="boton boton--primario" type="submit" disabled={enviando}><FiPlus /> Programar</button>
        </div>
      </form>

      <ul className="lista-alertas" style={{ marginTop: 'var(--esp-md)' }}>
        {citas.length === 0 && <li className="panel-descripcion">Sin citas en el periodo.</li>}
        {citas.slice(0, 8).map((c) => (
          <li key={c._id}>
            <span>
              <strong className="celda-fuerte">
                {formatoFecha(c.fechaHora, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </strong>
              <br /><small>{c.motivo || 'Consulta'}</small>
            </span>
            <span className="lista-alertas__banderas">
              <span className={`insignia insignia--${ESTADO_CITA[c.estado].tono}`}>{ESTADO_CITA[c.estado].texto}</span>
              {c.estado === 'programada' && (
                <>
                  <button className="boton boton--secundario boton--chico" title="Marcar realizada" aria-label="Marcar realizada" onClick={() => estado(c, 'realizada')}><FiCheck /></button>
                  <button className="boton boton--secundario boton--chico" title="No asistió" aria-label="No asistió" onClick={() => estado(c, 'no_asistio')}><FiSlash /></button>
                  <button className="boton boton--peligro boton--chico" title="Cancelar" aria-label="Cancelar cita" onClick={() => estado(c, 'cancelada')}><FiX /></button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================================================
 * AJUSTE PROFESIONAL de un resultado calculado/estimado
 * ============================================================ */
const AJUSTABLES = [
  ['tmr', 'Tasa metabólica en reposo'],
  ['get', 'Gasto energético total'],
  ['hidratacion', 'Hidratación'],
  ['requerimientoProteico', 'Requerimiento proteico'],
  ['imc', 'IMC'],
  ['relacionCinturaCadera', 'Relación cintura-cadera'],
  ['relacionCinturaEstatura', 'Relación cintura-estatura'],
];

export function PanelAjuste({ evaluacion, fechaMedicion, onGuardado }) {
  const [form, setForm] = useState({ indicador: 'get', valor: '', motivo: '' });
  const { error, enviando, ejecutar } = useEnvio(() => { setForm({ ...form, valor: '', motivo: '' }); onGuardado?.(); });
  if (!evaluacion) return null;
  const res = evaluacion.resultadosFinales || {};
  const ajustes = (evaluacion.ajustes || []).filter((a) => a.vigente);

  return (
    <section className="panel">
      <h2><FiSliders /> Ajuste profesional</h2>
      <p className="panel-descripcion">
        Sustituye un resultado de la medición del {fechaMedicion} por tu valoración (p. ej. calorimetría). El valor calculado se conserva.
      </p>
      <form className="formulario" onSubmit={(e) => {
        e.preventDefault();
        ejecutar(() => evaluacionesApi.ajustar(evaluacion._id, { ...form, valor: Number(form.valor) }));
      }}>
        <div className="campo campo--completo">
          <label htmlFor="a-ind">Indicador</label>
          <select id="a-ind" value={form.indicador} onChange={(e) => setForm({ ...form, indicador: e.target.value })}>
            {AJUSTABLES.map(([c, t]) => (
              <option key={c} value={c}>{t} (actual: {res[c]?.valor ?? '—'} {res[c]?.unidad || ''})</option>
            ))}
          </select>
        </div>
        <div className="campo"><label htmlFor="a-valor">Valor</label>
          <input id="a-valor" type="number" step="any" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
        <div className="campo"><label htmlFor="a-motivo">Motivo</label>
          <input id="a-motivo" value={form.motivo} maxLength={500} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required /></div>
        {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
        <div className="formulario-acciones">
          <button className="boton boton--primario" type="submit" disabled={enviando}>Aplicar ajuste</button>
        </div>
      </form>
      {ajustes.length > 0 && (
        <ul className="lista-alertas" style={{ marginTop: 'var(--esp-md)' }}>
          {ajustes.map((a) => (
            <li key={a._id}>
              <span><Origen origen="ajustado" /> {AJUSTABLES.find(([c]) => c === a.indicador)?.[1] || a.indicador}: <strong className="celda-fuerte">{a.valor}</strong>
                <br /><small>{a.motivo} · {a.responsable} · original {evaluacion.resultados?.[a.indicador]?.valor ?? '—'}</small></span>
              <button className="boton boton--secundario boton--chico" onClick={() => ejecutar(() => evaluacionesApi.retirarAjuste(evaluacion._id, a._id))}>Retirar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
