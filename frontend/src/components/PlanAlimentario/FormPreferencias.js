import { useState } from 'react';
import { Save } from 'lucide-react';
import './PlanAlimentario.css';

const PREPARACION = { rapido: 'Platillos rápidos de preparar', 'sin-coccion': 'Platillos sin cocinar' };
const aTexto = (lista) => (Array.isArray(lista) ? lista.join(', ') : lista || '');

/**
 * Preferencias alimentarias. Lo usan el nutriólogo (modo "profesional", con notas internas) y el paciente
 * desde su portal (modo "paciente"). Tipo de alimentación y número de comidas son obligatorios.
 */
function FormPreferencias({ valores, catalogos, modo = 'profesional', guardando = false, onGuardar, textoGuardar = 'Guardar preferencias', extraAcciones = null }) {
  const [f, setF] = useState(() => ({
    tipoAlimentacion: valores?.tipoAlimentacion || '',
    numeroComidas: valores?.numeroComidas ? String(valores.numeroComidas) : '',
    restricciones: valores?.restricciones || [],
    preparacion: valores?.preparacion || [],
    gustos: aTexto(valores?.gustos),
    rechazos: aTexto(valores?.rechazos),
    alergiasReportadas: valores?.alergiasReportadas || '',
    notas: valores?.notas || '',
  }));
  const [errores, setErrores] = useState({});
  const paciente = modo === 'paciente';

  const cambiar = (campo, valor) => { setF((x) => ({ ...x, [campo]: valor })); setErrores((e) => ({ ...e, [campo]: '' })); };
  const alternar = (campo, valor) => cambiar(campo, f[campo].includes(valor) ? f[campo].filter((v) => v !== valor) : [...f[campo], valor]);

  const enviar = (e, extra = {}) => {
    e?.preventDefault();
    const err = {};
    if (!f.tipoAlimentacion) err.tipoAlimentacion = 'Elige un tipo de alimentación';
    if (!f.numeroComidas) err.numeroComidas = 'Elige cuántas comidas haces al día';
    setErrores(err);
    if (Object.keys(err).length) return;
    const datos = {
      tipoAlimentacion: f.tipoAlimentacion, numeroComidas: Number(f.numeroComidas),
      restricciones: f.restricciones, preparacion: f.preparacion,
      gustos: f.gustos.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean),
      rechazos: f.rechazos.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean),
      alergiasReportadas: f.alergiasReportadas.trim(),
      ...(paciente ? {} : { notas: f.notas.trim() }),
      ...extra,
    };
    onGuardar(datos);
  };

  const opcion = (tipo, nombre, valor, etiqueta, marcado, alCambiar) => (
    <label key={valor} className={`opcion-chip${marcado ? ' opcion-chip--activa' : ''}`}>
      <input type={tipo} name={nombre} value={valor} checked={marcado} onChange={alCambiar} />
      <span>{etiqueta}</span>
    </label>
  );

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset className="campo campo--completo grupo-opciones" aria-describedby={errores.tipoAlimentacion ? 'pref-tipo-error' : undefined}>
        <legend>Tipo de alimentación *</legend>
        <div className="grupo-opciones__lista">
          {Object.entries(catalogos.tiposAlimentacion).map(([v, t]) => opcion('radio', 'tipoAlimentacion', v, t, f.tipoAlimentacion === v, () => cambiar('tipoAlimentacion', v)))}
        </div>
        {errores.tipoAlimentacion && <small className="campo__error" id="pref-tipo-error">{errores.tipoAlimentacion}</small>}
      </fieldset>

      <fieldset className="campo campo--completo grupo-opciones" aria-describedby={errores.numeroComidas ? 'pref-comidas-error' : undefined}>
        <legend>¿Cuántas comidas {paciente ? 'haces' : 'hace'} al día? *</legend>
        <div className="grupo-opciones__lista">
          {['3', '4', '5'].map((n) => opcion('radio', 'numeroComidas', n,
            n === '3' ? '3 (desayuno, comida y cena)' : n === '4' ? '4 (con una colación)' : '5 (con dos colaciones)',
            f.numeroComidas === n, () => cambiar('numeroComidas', n)))}
        </div>
        {errores.numeroComidas && <small className="campo__error" id="pref-comidas-error">{errores.numeroComidas}</small>}
      </fieldset>

      <fieldset className="campo campo--completo grupo-opciones">
        <legend>Restricciones culturales o religiosas</legend>
        <div className="grupo-opciones__lista">
          {Object.entries(catalogos.restricciones).map(([v, t]) => opcion('checkbox', 'restricciones', v, t, f.restricciones.includes(v), () => alternar('restricciones', v)))}
        </div>
      </fieldset>

      <div className="campo">
        <label htmlFor="pref-gustos">Alimentos que {paciente ? 'te gustan' : 'le gustan'}</label>
        <textarea id="pref-gustos" rows={2} value={f.gustos} maxLength={600} placeholder="Ej. pollo, pescado, aguacate" onChange={(e) => cambiar('gustos', e.target.value)} />
        <span className="campo__ayuda">Separados por comas. Se elegirán con más frecuencia.</span>
      </div>
      <div className="campo">
        <label htmlFor="pref-rechazos">Alimentos que {paciente ? 'no quieres' : 'no quiere'} comer</label>
        <textarea id="pref-rechazos" rows={2} value={f.rechazos} maxLength={600} placeholder="Ej. hígado, brócoli" onChange={(e) => cambiar('rechazos', e.target.value)} />
        <span className="campo__ayuda">Separados por comas. Nunca aparecerán en el plan.</span>
      </div>

      <fieldset className="campo campo--completo grupo-opciones">
        <legend>Preferencias de preparación</legend>
        <div className="grupo-opciones__lista">
          {Object.entries(PREPARACION).map(([v, t]) => opcion('checkbox', 'preparacion', v, t, f.preparacion.includes(v), () => alternar('preparacion', v)))}
        </div>
      </fieldset>

      <div className="campo campo--completo">
        <label htmlFor="pref-alergias">{paciente ? '¿Tienes alguna alergia o intolerancia a algún alimento?' : 'Alergias reportadas por el paciente'}</label>
        <input id="pref-alergias" value={f.alergiasReportadas} maxLength={500}
          placeholder={paciente ? 'Ej. fresa, cacahuate (déjalo vacío si no tienes)' : 'Por confirmar en Historia clínica'}
          onChange={(e) => cambiar('alergiasReportadas', e.target.value)} />
        <span className="campo__ayuda">
          {paciente
            ? 'Se excluirán siempre de tu plan. Tu nutriólogo las confirmará en tu expediente.'
            : 'El generador las excluye siempre. Confírmalas como antecedentes en Historia clínica.'}
        </span>
      </div>

      {!paciente && (
        <div className="campo campo--completo">
          <label htmlFor="pref-notas">Notas internas (no las ve el paciente)</label>
          <textarea id="pref-notas" rows={2} value={f.notas} maxLength={1000} onChange={(e) => cambiar('notas', e.target.value)} />
        </div>
      )}

      <div className="formulario-acciones">
        {extraAcciones && extraAcciones((extra) => enviar(null, extra))}
        <button type="submit" className="boton boton--primario" disabled={guardando}><Save aria-hidden="true" /> {guardando ? 'Guardando…' : textoGuardar}</button>
      </div>
    </form>
  );
}

export default FormPreferencias;
