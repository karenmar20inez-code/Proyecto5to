import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CheckCircle2, Archive, RefreshCw, BellRing } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import FormPreferencias from '../../../components/PlanAlimentario/FormPreferencias';
import VistaPlan, { AdvertenciaPlan } from '../../../components/PlanAlimentario/VistaPlan';
import { generadorApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const ESTADOS = { borrador: ['Borrador · en revisión', 'aviso'], aprobado: ['Aprobado · visible para el paciente', 'ok'], archivado: ['Archivado', ''] };
const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
/* Dónde se completa cada dato faltante */
const ENLACE_FALTANTE = { alergias: 'historia', requerimiento: 'plan' };

/** Error del generador: mensaje + faltantes/problemas que explica el servidor */
function ErrorGenerador({ error, pacienteId }) {
  if (!error) return null;
  const datos = error.datos || {};
  return (
    <div className="aviso aviso--error" role="alert">
      <strong>{error.message}</strong>
      {datos.faltan?.length > 0 && (
        <ul className="plan-faltantes">
          {datos.faltan.map((f) => (
            <li key={f.campo}>{f.mensaje}{ENLACE_FALTANTE[f.campo] && <> · <Link to={`/pacientes/${pacienteId}/${ENLACE_FALTANTE[f.campo]}`}>ir a capturarlo</Link></>}</li>
          ))}
        </ul>
      )}
      {datos.problemas?.length > 0 && <ul className="plan-faltantes">{datos.problemas.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>}
      {datos.detalle?.exclusiones && (
        <ul className="plan-faltantes">{Object.entries(datos.detalle.exclusiones).slice(0, 6).map(([m, n]) => <li key={m}>{m}: {n} platillo(s)</li>)}</ul>
      )}
    </div>
  );
}

/**
 * Pestaña "Plan alimentario" del expediente: preferencias del paciente, generación aleatoria
 * controlada, regeneración (todo, un día o una comida, con comidas fijadas) y aprobación profesional.
 */
function PlanAlimentario() {
  const { pacienteId } = useFicha();
  const { puede } = useAuth();
  const escribir = puede('clinico:escribir');
  const [info, setInfo] = useState(null);       // { preferencias, contexto, faltan, catalogos }
  const [planes, setPlanes] = useState([]);
  const [plan, setPlan] = useState(null);
  const [fijadas, setFijadas] = useState(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState('');
  const [aprobando, setAprobando] = useState(false);
  const [nota, setNota] = useState('');
  const [confirmoNoValidados, setConfirmoNoValidados] = useState(false);

  const cargar = useCallback(async (seleccionar) => {
    const [i, lista] = await Promise.all([generadorApi.preferencias(pacienteId), generadorApi.planes(pacienteId)]);
    setInfo(i); setPlanes(lista);
    const elegido = seleccionar || lista.find((p) => p.estado === 'borrador') || lista.find((p) => p.estado === 'aprobado');
    setPlan(elegido ? (elegido.dias ? elegido : await generadorApi.plan(elegido._id)) : null);
  }, [pacienteId]);
  useEffect(() => { cargar().catch((e) => setError(e)); }, [cargar]);

  const ejecutar = async (accion, exito) => {
    setOcupado(true); setError(null); setAviso('');
    try { const r = await accion(); if (exito) setAviso(exito); return r; } catch (e) { setError(e); return null; } finally { setOcupado(false); }
  };

  const guardarPreferencias = async (datos) => {
    setGuardando(true); setError(null); setAviso('');
    try {
      const r = await generadorApi.guardarPreferencias(pacienteId, datos);
      setInfo((x) => ({ ...x, ...r })); setAviso('Preferencias guardadas.');
    } catch (e) { setError(e); } finally { setGuardando(false); }
  };

  const generar = async (opciones = {}) => {
    const nuevo = await ejecutar(() => generadorApi.generar(pacienteId, opciones), opciones.basePlanId ? 'Plan regenerado (borrador).' : 'Plan generado (borrador). Revísalo antes de aprobarlo.');
    if (nuevo) { setFijadas(new Set(Object.keys(opciones).length ? [...fijadas] : [])); await cargar(nuevo); }
  };
  const regenerarNoFijadas = () => generar({ basePlanId: plan._id, fijar: [...fijadas] });
  const regenerarDia = (dia) => generar({ basePlanId: plan._id, regenerar: { dia } });
  const cambiarComida = (dia, comida) => generar({ basePlanId: plan._id, regenerar: { dia, comida } });
  const alternarFija = (clave) => setFijadas((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  const aprobar = async () => {
    const r = await ejecutar(() => generadorApi.aprobar(plan._id, nota, confirmoNoValidados), 'Plan aprobado: ya es visible en el portal del paciente.');
    setAprobando(false); setNota(''); setConfirmoNoValidados(false);
    if (r) await cargar(r);
  };
  const archivar = async () => {
    if (!window.confirm('¿Archivar este plan? Dejará de estar disponible para aprobar o para el paciente.')) return;
    const r = await ejecutar(() => generadorApi.archivar(plan._id), 'Plan archivado.');
    if (r) await cargar();
  };

  if (!info) return error ? <ErrorGenerador error={error} pacienteId={pacienteId} /> : <div className="esqueleto" style={{ height: 320 }} />;
  const { contexto, faltan, catalogos, preferencias } = info;
  const editable = escribir && plan?.estado === 'borrador';
  /* Platillos del catálogo inicial que ningún profesional ha validado todavía */
  const noValidados = plan ? [...new Set(plan.dias.flatMap((d) => d.comidas).filter((c) => c.validado !== true).map((c) => c.nombre))] : [];

  return (
    <div className="pila">
      {!plan && <AdvertenciaPlan texto={catalogos.advertencia} />}
      {aviso && <p className="aviso aviso--ok" role="status">{aviso}</p>}
      <ErrorGenerador error={error} pacienteId={pacienteId} />

      <div className="rejilla-aurea-inversa">
        <div className="pila">
          {/* Datos clínicos que usa el generador */}
          <section className="panel" aria-labelledby="t-gen-datos">
            <h2 id="t-gen-datos">Datos que usa el generador</h2>
            <dl className="datos">
              <dt>Requerimiento</dt><dd>{contexto.kcal ? `${contexto.kcal} kcal/día (${contexto.origenKcal})` : 'Sin definir'}</dd>
              <dt>Alergias e intolerancias</dt><dd>{contexto.alergias.length ? contexto.alergias.join(' · ') : (contexto.alergiasRegistradas ? 'Niega alergias' : 'Sin registrar')}</dd>
              {contexto.restriccionesPorDiagnostico.length > 0 && (
                <><dt>Por diagnóstico</dt><dd>Se excluye: {contexto.restriccionesPorDiagnostico.map((e) => (e === 'alto-sodio' ? 'alto en sodio' : 'azúcar añadida')).join(', ')}</dd></>
              )}
            </dl>
            {contexto.alergiasReportadasPendientes && (
              <p className="aviso aviso--alerta">El paciente reportó alergias en su portal: ya se excluyen, pero confírmalas en <Link to={`/pacientes/${pacienteId}/historia`}>Historia clínica</Link>.</p>
            )}
            {faltan.length > 0 && (
              <div className="aviso" role="status">
                <strong>Antes de generar falta:</strong>
                <ul className="plan-faltantes">
                  {faltan.map((f) => <li key={f.campo}>{f.mensaje}{ENLACE_FALTANTE[f.campo] && <> · <Link to={`/pacientes/${pacienteId}/${ENLACE_FALTANTE[f.campo]}`}>ir a capturarlo</Link></>}</li>)}
                </ul>
              </div>
            )}
          </section>

          <section className="panel" aria-labelledby="t-gen-pref">
            <div className="panel-encabezado">
              <div>
                <h2 id="t-gen-pref">Preferencias alimentarias</h2>
                <p className="panel-descripcion">
                  {preferencias?.updatedAt ? `Actualizadas ${fechaHora(preferencias.updatedAt)} por ${preferencias.origen === 'paciente' ? 'el paciente' : preferencias.actualizadoPor || 'el profesional'}.` : 'Aún no se han capturado.'}
                </p>
              </div>
              {preferencias?.solicitudPlan && <span className="insignia insignia--aviso"><BellRing aria-hidden="true" /> El paciente pidió su plan</span>}
            </div>
            {escribir
              ? <FormPreferencias key={preferencias?.updatedAt || 'nuevas'} valores={preferencias} catalogos={catalogos} guardando={guardando} onGuardar={guardarPreferencias} />
              : <p className="vacio">Solo el personal clínico con permiso de escritura edita las preferencias.</p>}
          </section>

          {planes.length > 0 && (
            <section className="panel" aria-labelledby="t-gen-historial">
              <h2 id="t-gen-historial">Planes generados</h2>
              <ul className="lista-registros">
                {planes.map((p) => (
                  <li key={p._id} className={plan?._id === p._id ? 'registro--resaltado' : undefined}>
                    <div>
                      <div className="lista-registros__titulo">{fechaHora(p.createdAt)} <span className={`insignia insignia--${ESTADOS[p.estado][1]}`}>{ESTADOS[p.estado][0]}</span></div>
                      <div className="lista-registros__meta">{p.kcalObjetivo} kcal · {p.generadoPor?.nombre}{p.aprobadoPor?.nombre ? ` · aprobó ${p.aprobadoPor.nombre}` : ''}</div>
                    </div>
                    {plan?._id !== p._id && (
                      <button type="button" className="boton boton--secundario boton--chico" onClick={() => ejecutar(async () => setPlan(await generadorApi.plan(p._id)))}>Ver</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Plan actual */}
        <section className="panel" aria-labelledby="t-gen-plan">
          <div className="panel-encabezado">
            <div>
              <h2 id="t-gen-plan">Plan alimentario</h2>
              {plan && <p className="panel-descripcion plan-estado"><span className={`insignia insignia--${ESTADOS[plan.estado][1]}`}>{ESTADOS[plan.estado][0]}</span> Generado {fechaHora(plan.createdAt)}</p>}
            </div>
            {escribir && (
              <div className="encabezado-acciones">
                {editable && fijadas.size > 0 && (
                  <button type="button" className="boton boton--secundario" disabled={ocupado} onClick={regenerarNoFijadas}><RefreshCw aria-hidden="true" /> Regenerar lo no fijado</button>
                )}
                <button type="button" className="boton boton--primario" disabled={ocupado || faltan.length > 0} onClick={() => generar()}
                  title={faltan.length ? 'Completa los datos faltantes' : undefined}>
                  <Sparkles aria-hidden="true" /> {ocupado ? 'Generando…' : plan ? 'Generar otro plan' : 'Generar plan'}
                </button>
              </div>
            )}
          </div>

          {!plan ? (
            <p className="vacio">{faltan.length ? 'Completa los datos faltantes para generar el primer plan.' : 'Aún no hay planes. Genera uno con las preferencias del paciente.'}</p>
          ) : (
            <>
              {editable && <p className="campo__ayuda">Fija con el candado las comidas que quieras conservar; cambia una comida o regenera un día completo. Las restricciones se respetan siempre.</p>}
              {noValidados.length > 0 && plan.estado === 'borrador' && (
                <p className="aviso aviso--alerta">{noValidados.length} platillo(s) de este plan vienen del catálogo inicial y aún no los valida un profesional (marcados «sin validar»). Revisa sus ingredientes antes de aprobar.</p>
              )}
              <VistaPlan plan={plan} editable={editable} fijadas={fijadas} ocupado={ocupado} mostrarValidacion
                onFijar={alternarFija} onCambiarComida={cambiarComida} onRegenerarDia={regenerarDia} />
              {plan.notaRevision && <p className="aviso">Nota de revisión: {plan.notaRevision}</p>}
              {escribir && plan.estado !== 'archivado' && (
                <div className="formulario-acciones">
                  <button type="button" className="boton boton--fantasma" disabled={ocupado} onClick={archivar}><Archive aria-hidden="true" /> Archivar</button>
                  {plan.estado === 'borrador' && (
                    <button type="button" className="boton boton--primario" disabled={ocupado} onClick={() => setAprobando(true)}><CheckCircle2 aria-hidden="true" /> Revisar y aprobar</button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal abierto={aprobando} titulo="Aprobar plan alimentario" onCerrar={() => setAprobando(false)}
        descripcion="Al aprobarlo, el paciente lo verá en su portal. Antes se vuelve a comprobar contra sus restricciones vigentes.">
        <div className="formulario">
          <div className="campo campo--completo">
            <label htmlFor="gen-nota">Nota para el paciente (opcional)</label>
            <textarea id="gen-nota" rows={3} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Toma 2 litros de agua al día y avísame si algún platillo no te acomoda." />
          </div>
          {noValidados.length > 0 && (
            <div className="campo campo--completo">
              <p className="aviso aviso--alerta">Platillos sin validar: {noValidados.join(', ')}.</p>
              <label className="opcion-chip" style={{ borderRadius: 'var(--radio)' }}>
                <input type="checkbox" checked={confirmoNoValidados} onChange={(e) => setConfirmoNoValidados(e.target.checked)} />
                <span>Revisé los ingredientes y alérgenos de estos platillos</span>
              </label>
            </div>
          )}
          <p className="campo campo--completo campo__ayuda">Confirmo que revisé el plan y que es adecuado para el paciente.</p>
          <div className="formulario-acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setAprobando(false)}>Cancelar</button>
            <button type="button" className="boton boton--primario" disabled={ocupado || (noValidados.length > 0 && !confirmoNoValidados)} onClick={aprobar}><CheckCircle2 aria-hidden="true" /> Aprobar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PlanAlimentario;
