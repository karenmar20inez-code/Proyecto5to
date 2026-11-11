import { useState } from 'react';
import { FiPlus, FiSave } from 'react-icons/fi';
import { medicionesApi } from '../../services/api';
import { fechaISO } from '../../context/NutriContext';

/* Campos agrupados: [campo, etiqueta, unidad, paso] */
const GRUPOS = [
  {
    titulo: 'Antropometría',
    metodo: ['peso', 'Método de peso', [['bascula_digital', 'Báscula digital'], ['bascula_mecanica', 'Báscula mecánica'], ['bioimpedancia', 'Bioimpedancia'], ['autorreporte', 'Autorreporte'], ['otro', 'Otro']]],
    metodo2: ['circunferencias', 'Método de circunferencias', [['cinta_metrica', 'Cinta métrica'], ['otro', 'Otro']]],
    campos: [
      ['pesoKg', 'Peso', 'kg', '0.1'],
      ['estaturaCm', 'Estatura', 'cm', '0.1'],
      ['cinturaCm', 'Cintura', 'cm', '0.1'],
      ['caderaCm', 'Cadera', 'cm', '0.1'],
    ],
  },
  {
    titulo: 'Composición corporal',
    metodo: ['composicion', 'Método', [['bioimpedancia', 'Bioimpedancia'], ['plicometria', 'Plicometría'], ['dexa', 'DEXA'], ['otro', 'Otro']]],
    campos: [
      ['grasaPorcentaje', 'Grasa corporal', '%', '0.1'],
      ['masaMuscularKg', 'Masa muscular', 'kg', '0.1'],
    ],
  },
  {
    titulo: 'Signos vitales',
    metodo: ['laboratorio', 'Instrumento', [['baumanometro', 'Baumanómetro'], ['otro', 'Otro']]],
    campos: [
      ['presionSistolica', 'Presión sistólica', 'mmHg', '1'],
      ['presionDiastolica', 'Presión diastólica', 'mmHg', '1'],
    ],
  },
  {
    titulo: 'Hidratación, actividad y consumo',
    metodo: ['registro', 'Fuente del registro', [['consulta', 'Consulta'], ['autorreporte', 'Autorreporte'], ['recordatorio_24h', 'Recordatorio 24 h'], ['otro', 'Otro']]],
    campos: [
      ['aguaMl', 'Agua consumida', 'ml/día', '50'],
      ['actividadMinutos', 'Actividad física', 'min/día', '5'],
      ['consumoKcal', 'Consumo energético', 'kcal/día', '10'],
    ],
    texto: ['actividadTipo', 'Tipo de actividad'],
  },
];

const CAMPOS_NUM = GRUPOS.flatMap((g) => g.campos.map(([c]) => c));

function estadoInicial(medicion) {
  const base = { fecha: new Date().toISOString().slice(0, 10), notas: '', actividadTipo: '', metodos: {}, motivoCambio: '', consultaId: '' };
  CAMPOS_NUM.forEach((c) => { base[c] = ''; });
  if (!medicion) return base;
  const r = { ...base, fecha: fechaISO(medicion.fecha), notas: medicion.notas || '', actividadTipo: medicion.actividadTipo || '', metodos: { ...(medicion.metodos || {}) }, consultaId: medicion.consultaId || '' };
  CAMPOS_NUM.forEach((c) => { r[c] = medicion[c] ?? ''; });
  return r;
}

/**
 * Captura o corrige una medición. Al corregir se envía como NUEVA versión
 * con el motivo del cambio (el backend conserva la anterior).
 */
function FormularioMedicion({ pacienteId, medicion, onGuardado, onCancelar, compacto = false, consultas = [], estaturaPrevia }) {
  const [form, setForm] = useState(() => estadoInicial(medicion));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [abiertos, setAbiertos] = useState(() => (compacto ? { Antropometría: true } : Object.fromEntries(GRUPOS.map((g) => [g.titulo, true]))));

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const cambiarMetodo = (clave, valor) => setForm({ ...form, metodos: { ...form.metodos, [clave]: valor || undefined } });

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setErrores({});

    let datos = { fecha: form.fecha, notas: form.notas, actividadTipo: form.actividadTipo, consultaId: form.consultaId || (medicion ? '' : undefined) };
    CAMPOS_NUM.forEach((c) => {
      if (form[c] !== '') datos[c] = Number(form[c]);
      else if (medicion) datos[c] = ''; // al corregir, vaciar el campo
    });
    const metodos = Object.fromEntries(Object.entries(form.metodos).filter(([, v]) => v));
    if (Object.keys(metodos).length || medicion) datos.metodos = metodos;

    // Al corregir solo se envían los campos que cambiaron
    if (medicion) {
      const original = estadoInicial(medicion);
      datos = Object.fromEntries(Object.entries(datos).filter(([c, v]) =>
        c === 'metodos'
          ? JSON.stringify(v) !== JSON.stringify(Object.fromEntries(Object.entries(original.metodos).filter(([, x]) => x)))
          : String(v) !== String(original[c] ?? '')));
      if (!Object.keys(datos).length) {
        setGuardando(false);
        setError('No hay cambios que guardar.');
        return;
      }
    }

    try {
      const r = medicion
        ? await medicionesApi.corregir(medicion._id, { ...datos, motivoCambio: form.motivoCambio })
        : await medicionesApi.crear(pacienteId, datos);
      if (!medicion) setForm(estadoInicial(null));
      onGuardado?.(r);
    } catch (err) {
      setError(err.message);
      setErrores(err.errores || {});
    } finally {
      setGuardando(false);
    }
  };

  const mensaje = (c) => (errores[c] ? <small className="campo__error">{errores[c]}</small> : null);
  const selectMetodo = ([clave, etiqueta, opciones]) => (
    <div className="campo">
      <label htmlFor={`m-${clave}`}>{etiqueta}</label>
      <select id={`m-${clave}`} value={form.metodos[clave] || ''} onChange={(e) => cambiarMetodo(clave, e.target.value)}>
        <option value="">Sin especificar</option>
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {mensaje(`metodos.${clave}`)}
    </div>
  );

  return (
    <form className="formulario formulario-medicion" onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="m-fecha">Fecha de la medición *</label>
        <input id="m-fecha" type="date" name="fecha" value={form.fecha} max={new Date().toISOString().slice(0, 10)} onChange={cambiar} required />
        {mensaje('fecha')}
      </div>

      {consultas.length > 0 && (
        <div className="campo">
          <label htmlFor="m-consulta">Consulta</label>
          <select id="m-consulta" name="consultaId" value={form.consultaId} onChange={cambiar}>
            <option value="">Sin vincular</option>
            {consultas.map((c) => <option key={c._id} value={c._id}>{new Date(c.fecha).toLocaleDateString('es-MX')} · {c.motivo || 'Consulta'}</option>)}
          </select>
        </div>
      )}

      {GRUPOS.map((g) => (
        <fieldset key={g.titulo} className="grupo-campos campo--completo">
          <legend>
            <button type="button" className="grupo-campos__titulo" aria-expanded={!!abiertos[g.titulo]}
              onClick={() => setAbiertos({ ...abiertos, [g.titulo]: !abiertos[g.titulo] })}>
              {abiertos[g.titulo] ? '▾' : '▸'} {g.titulo}
            </button>
          </legend>
          {abiertos[g.titulo] && (
            <div className="formulario">
              {g.campos.map(([c, etiqueta, unidad, paso]) => (
                <div className="campo" key={c}>
                  <label htmlFor={`m-${c}`}>{etiqueta} ({unidad})</label>
                  <input id={`m-${c}`} type="number" step={paso} min="0" name={c} value={form[c]} onChange={cambiar}
                    aria-invalid={!!errores[c]} placeholder={c === 'estaturaCm' && estaturaPrevia ? `Última: ${estaturaPrevia}` : undefined} />
                  {mensaje(c)}
                </div>
              ))}
              {g.texto && (
                <div className="campo">
                  <label htmlFor={`m-${g.texto[0]}`}>{g.texto[1]}</label>
                  <input id={`m-${g.texto[0]}`} name={g.texto[0]} value={form[g.texto[0]]} onChange={cambiar} maxLength={80} />
                </div>
              )}
              {selectMetodo(g.metodo)}
              {g.metodo2 && selectMetodo(g.metodo2)}
            </div>
          )}
        </fieldset>
      ))}

      <div className="campo campo--completo">
        <label htmlFor="m-notas">Notas</label>
        <textarea id="m-notas" name="notas" value={form.notas} onChange={cambiar} maxLength={2000} />
      </div>

      {medicion && (
        <div className="campo campo--completo">
          <label htmlFor="m-motivo">Motivo de la corrección *</label>
          <input id="m-motivo" name="motivoCambio" value={form.motivoCambio} onChange={cambiar} required maxLength={500}
            placeholder="Ej. Error de captura en la cintura" />
          {mensaje('motivoCambio')}
        </div>
      )}

      {(error || errores.valores) && (
        <p className="aviso aviso--error campo--completo" role="alert">{errores.valores || error}</p>
      )}

      <div className="formulario-acciones">
        {onCancelar && <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>}
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {medicion ? <FiSave /> : <FiPlus />} {guardando ? 'Guardando…' : medicion ? 'Guardar nueva versión' : 'Registrar medición'}
        </button>
      </div>
    </form>
  );
}

export default FormularioMedicion;
