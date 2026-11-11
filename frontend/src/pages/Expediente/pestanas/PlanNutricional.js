import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import { PanelPrescripcion } from '../../AnalisisPaciente/PanelesClinicos';
import { GraficaMacros } from '../../../components/Graficas/GraficasClinicas';
import { planeacionApi, prescripcionesApi, estadisticasApi, consultasApi } from '../../../services/api';
import { formatoFecha, fechaISO, useNutri } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';
import { alimentosDeDieta } from '../../../data/dietas';

const fecha = (f) => (f ? formatoFecha(fechaISO(f)) : '—');
const ESTADOS = { borrador: ['Borrador', 'aviso'], vigente: ['Vigente', 'ok'], finalizado: ['Finalizado', ''], reemplazado: ['Reemplazado', ''] };

/* Alimentos de un menú del catálogo (para revisar alergias en el servidor) */

function FormPlan({ pacienteId, objetivos, onGuardar, onCancelar }) {
  const { dietas, buscarDieta } = useNutri();
  const alimentosDe = (dietaId) => alimentosDeDieta(buscarDieta(dietaId));
  const [f, setF] = useState({ nombre: '', inicio: new Date().toISOString().slice(0, 10), fin: '', objetivoIds: objetivos.map((o) => o._id), dietaId: '', recomendaciones: '', consultaId: '' });
  const [consultas, setConsultas] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { consultasApi.listar(pacienteId).then(setConsultas).catch(() => {}); }, [pacienteId]);

  const enviar = async (e) => {
    e.preventDefault();
    try {
      await onGuardar({
        nombre: f.nombre, vigencia: { inicio: f.inicio, fin: f.fin || undefined }, objetivoIds: f.objetivoIds,
        dietaId: f.dietaId || undefined, alimentos: f.dietaId ? alimentosDe(f.dietaId) : [], recomendaciones: f.recomendaciones, consultaId: f.consultaId || undefined,
      });
    } catch (err) { setError(err.message); }
  };
  const c = (k) => ({ id: `pl-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="campo campo--completo"><label htmlFor="pl-nombre">Nombre del plan *</label><input {...c('nombre')} required placeholder="Ej. Plan de reducción · fase 1" /></div>
      <div className="campo"><label htmlFor="pl-inicio">Inicio *</label><input type="date" {...c('inicio')} required /></div>
      <div className="campo"><label htmlFor="pl-fin">Fin</label><input type="date" {...c('fin')} min={f.inicio} /></div>
      <div className="campo"><label htmlFor="pl-dietaId">Menú</label>
        <select {...c('dietaId')}><option value="">Sin menú del catálogo</option>{dietas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select>
        {f.dietaId && <span className="campo__ayuda">{alimentosDe(f.dietaId).length} alimentos · se revisarán contra alergias registradas.</span>}</div>
      <div className="campo"><label htmlFor="pl-consultaId">Consulta</label>
        <select {...c('consultaId')}><option value="">Sin vincular</option>{consultas.map((x) => <option key={x._id} value={x._id}>{new Date(x.fecha).toLocaleDateString('es-MX')} · {x.motivo || 'Consulta'}</option>)}</select></div>
      <fieldset className="grupo-campos campo--completo">
        <legend className="campo__ayuda">Objetivos que atiende</legend>
        {objetivos.length === 0 && <span className="campo__ayuda">No hay objetivos activos: regístralos en la pestaña Objetivos.</span>}
        {objetivos.map((o) => (
          <label key={o._id} className="casilla">
            <input type="checkbox" checked={f.objetivoIds.includes(o._id)} onChange={(e) => setF({ ...f, objetivoIds: e.target.checked ? [...f.objetivoIds, o._id] : f.objetivoIds.filter((x) => x !== o._id) })} />
            {o.descripcion}
          </label>
        ))}
      </fieldset>
      <div className="campo campo--completo"><label htmlFor="pl-recomendaciones">Recomendaciones</label><textarea {...c('recomendaciones')} maxLength={4000} rows={5} /></div>
      <p className="aviso campo--completo" style={{ margin: 0 }}>Los requerimientos se toman de la prescripción vigente y se guardan como snapshot del plan.</p>
      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton boton--primario">Guardar como borrador</button>
      </div>
    </form>
  );
}

function PlanNutricional() {
  const { pacienteId, ficha, recargar } = useFicha();
  const { recargarPacientes, buscarDieta } = useNutri();
  const { puede } = useAuth();
  const [params] = useSearchParams();
  const [planes, setPlanes] = useState(null);
  const [prescripciones, setPrescripciones] = useState([]);
  const [macros, setMacros] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  const cargar = useCallback(async () => {
    const [p, pr, d] = await Promise.all([
      planeacionApi.planes(pacienteId), prescripcionesApi.listar(pacienteId), estadisticasApi.dashboardPaciente(pacienteId).catch(() => null),
    ]);
    setPlanes(p); setPrescripciones(pr); setMacros(d?.evaluacionActual?.macronutrientes?.valor || null);
  }, [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const activar = async (plan) => {
    if (!window.confirm(`¿Activar «${plan.nombre}»? El plan vigente actual pasará a "reemplazado".`)) return;
    await planeacionApi.activarPlan(plan._id).catch((e) => window.alert(e.message));
    cargar(); recargar(); recargarPacientes();
  };
  const objetivosActivos = ficha.ficha.objetivos;

  return (
    <div className="rejilla-aurea">
      <div className="pila">
        <section className="panel" aria-labelledby="t-planes">
          <div className="panel-encabezado">
            <div><h2 id="t-planes">Planes nutricionales</h2><p className="panel-descripcion">Cada plan se vincula con sus objetivos y con los requerimientos calculados/prescritos.</p></div>
            {puede('clinico:escribir') && <button className="boton boton--primario" onClick={() => setNuevo(true)}><Plus aria-hidden="true" /> Nuevo plan</button>}
          </div>
          {!planes ? <div className="esqueleto" style={{ height: 160 }} /> : planes.length === 0 ? <p className="vacio">Sin planes registrados.</p> : (
            <ul className="lista-registros">
              {planes.map((p) => (
                <li key={p._id} className={params.get('registro') === p._id ? 'registro--resaltado' : undefined}>
                  <div>
                    <div className="lista-registros__titulo">{p.nombre} <span className={`insignia insignia--${ESTADOS[p.estado][1]}`}>{ESTADOS[p.estado][0]}</span></div>
                    <div className="lista-registros__meta">
                      {fecha(p.vigencia?.inicio)}{p.vigencia?.fin ? ` – ${fecha(p.vigencia.fin)}` : ''} · {p.profesional} · {p.objetivoIds.length} objetivo(s)
                      {p.dietaId && <> · menú <Link to="/dietas">{buscarDieta(p.dietaId)?.nombre || p.dietaId}</Link></>}
                    </div>
                    {p.requerimientos?.kcal && (
                      <div className="lista-registros__meta">
                        Requerimientos (snapshot {fecha(p.requerimientos.fechaCalculo)}): {p.requerimientos.kcal} kcal/día
                        {p.requerimientos.proteinasPct != null && ` · P ${p.requerimientos.proteinasPct} % · HC ${p.requerimientos.carbohidratosPct} % · L ${p.requerimientos.grasasPct} %`}
                        {p.requerimientos.getEstimadoKcal && ` · GET estimado ${p.requerimientos.getEstimadoKcal} kcal`}
                      </div>
                    )}
                    {p.recomendaciones && <div className="lista-registros__meta" style={{ whiteSpace: 'pre-wrap' }}>{p.recomendaciones}</div>}
                  </div>
                  {puede('clinico:escribir') && p.estado === 'borrador' && (
                    <button className="boton boton--secundario boton--chico" onClick={() => activar(p)}><CheckCircle2 aria-hidden="true" /> Activar</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel" aria-labelledby="t-macros">
          <h2 id="t-macros">Distribución de macronutrientes</h2>
          <p className="panel-descripcion">Prescrita · factores de Atwater (4-4-9 kcal/g).</p>
          <GraficaMacros macros={macros} />
        </section>
      </div>
      {puede('clinico:escribir')
        ? <PanelPrescripcion key={prescripciones[0]?._id || 'nueva'} pacienteId={pacienteId} vigente={prescripciones[0]} historial={prescripciones} onGuardado={() => { cargar(); recargar(); }} />
        : <section className="panel"><h2>Prescripción</h2><p className="panel-descripcion">{prescripciones[0] ? `${prescripciones[0].kcalObjetivo || '—'} kcal/día` : 'Sin prescripción'}</p></section>}

      <Modal abierto={nuevo} titulo="Nuevo plan nutricional" onCerrar={() => setNuevo(false)} ancho={720}>
        {nuevo && <FormPlan pacienteId={pacienteId} objetivos={objetivosActivos} onCancelar={() => setNuevo(false)}
          onGuardar={async (d) => { await planeacionApi.crearPlan(pacienteId, d); setNuevo(false); cargar(); recargar(); }} />}
      </Modal>
    </div>
  );
}

export default PlanNutricional;
