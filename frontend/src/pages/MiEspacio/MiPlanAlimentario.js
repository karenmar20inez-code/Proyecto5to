import { useEffect, useState } from 'react';
import { Send, Clock } from 'lucide-react';
import FormPreferencias from '../../components/PlanAlimentario/FormPreferencias';
import VistaPlan, { AdvertenciaPlan } from '../../components/PlanAlimentario/VistaPlan';
import { generadorApi } from '../../services/api';

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/**
 * Portal: el paciente indica lo que quiere (gustos, rechazos, restricciones, alergias, número de comidas)
 * y pide su plan. Solo ve planes que su nutriólogo ya revisó y aprobó.
 */
function MiPlanAlimentario() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);

  const cargar = () => generadorApi.portalPlan().then((d) => { setDatos(d); setEditando(!d.preferencias); }).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const guardar = async (valores) => {
    setGuardando(true); setError(''); setAviso('');
    try {
      await generadorApi.portalPreferencias(valores);
      setAviso(valores.solicitarPlan
        ? 'Listo: enviamos tus preferencias a tu nutriólogo. Verás tu plan aquí cuando lo revise y apruebe.'
        : 'Tus preferencias se guardaron.');
      setEditando(false);
      await cargar();
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  if (!datos) return error ? <p className="aviso aviso--error" role="alert">{error}</p> : <div className="esqueleto" style={{ height: 320 }} />;
  const { plan, preferencias, enRevision, catalogos } = datos;

  return (
    <div className="pila">
      {aviso && <p className="aviso aviso--ok" role="status">{aviso}</p>}
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}

      <section className="panel" aria-labelledby="t-mi-plan">
        <div className="panel-encabezado">
          <div>
            <h2 id="t-mi-plan">Mi plan alimentario</h2>
            <p className="panel-descripcion">
              {plan ? `Revisado y aprobado por ${plan.aprobadoPor || 'tu nutriólogo'} el ${fecha(plan.aprobadoEn)}.` : 'Tu plan se arma con tus preferencias y lo revisa tu nutriólogo antes de que lo veas.'}
            </p>
          </div>
          {enRevision && <span className="insignia insignia--aviso"><Clock aria-hidden="true" /> En revisión por tu nutriólogo</span>}
        </div>
        {plan ? (
          <>
            {plan.notaRevision && <p className="aviso">Nota de tu nutriólogo: {plan.notaRevision}</p>}
            <VistaPlan plan={plan} />
          </>
        ) : (
          <>
            <AdvertenciaPlan texto={catalogos.advertencia} />
            <p className="vacio">
              {enRevision ? 'Tu nutriólogo está revisando tu plan. Aparecerá aquí cuando lo apruebe.' : 'Todavía no tienes un plan. Cuéntanos qué te gusta y qué no, y pídelo.'}
            </p>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="t-mis-pref">
        <div className="panel-encabezado">
          <div>
            <h2 id="t-mis-pref">Mis preferencias</h2>
            <p className="panel-descripcion">Tu plan nunca incluirá lo que no quieres o no puedes comer.</p>
          </div>
          {!editando && <button type="button" className="boton boton--secundario" onClick={() => setEditando(true)}>Editar mis preferencias</button>}
        </div>
        {editando ? (
          <FormPreferencias key={preferencias?.updatedAt || 'nuevas'} modo="paciente" valores={preferencias} catalogos={catalogos}
            guardando={guardando} onGuardar={guardar} textoGuardar="Guardar"
            extraAcciones={(enviarCon) => (
              <button type="button" className="boton boton--secundario" disabled={guardando} onClick={() => enviarCon({ solicitarPlan: true })}>
                <Send aria-hidden="true" /> Guardar y pedir mi plan
              </button>
            )} />
        ) : (
          <dl className="datos">
            <dt>Alimentación</dt><dd>{catalogos.tiposAlimentacion[preferencias?.tipoAlimentacion] || '—'}</dd>
            <dt>Comidas al día</dt><dd>{preferencias?.numeroComidas || '—'}</dd>
            <dt>Restricciones</dt><dd>{preferencias?.restricciones?.length ? preferencias.restricciones.map((r) => catalogos.restricciones[r]).join(', ') : 'Ninguna'}</dd>
            <dt>Me gustan</dt><dd>{preferencias?.gustos?.join(', ') || '—'}</dd>
            <dt>No quiero</dt><dd>{preferencias?.rechazos?.join(', ') || '—'}</dd>
            <dt>Alergias que reporté</dt><dd>{preferencias?.alergiasReportadas || 'Ninguna'}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}

export default MiPlanAlimentario;
