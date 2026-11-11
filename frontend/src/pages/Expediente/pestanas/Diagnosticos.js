import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import BuscadorCatalogo from '../../../components/ui/BuscadorCatalogo';
import { planeacionApi, medicionesApi, laboratorioApi, consultasApi } from '../../../services/api';
import { formatoFecha, fechaISO } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';

const fecha = (f) => formatoFecha(fechaISO(f));
const ESTADOS = { activo: ['Activo', 'info'], en_mejora: ['En mejora', 'ok'], resuelto: ['Resuelto', 'ok'], descartado: ['Descartado', ''] };

function FormDiagnostico({ pacienteId, onGuardar, onCancelar }) {
  const [f, setF] = useState({ tipo: 'nutricional', problema: '', etiologia: '', signosSintomas: '', codigo: null, consultaId: '', evaluacionId: '', laboratorioIds: [], fechaDiagnostico: new Date().toISOString().slice(0, 10) });
  const [opciones, setOpciones] = useState({ mediciones: [], labs: [], consultas: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([medicionesApi.listar(pacienteId), laboratorioApi.listar(pacienteId), consultasApi.listar(pacienteId)])
      .then(([m, l, c]) => setOpciones({ mediciones: m.mediciones.filter((x) => x.evaluacion).reverse(), labs: l, consultas: c }))
      .catch(() => {});
  }, [pacienteId]);

  const enviar = async (e) => {
    e.preventDefault();
    const ev = opciones.mediciones.find((m) => m.evaluacion._id === f.evaluacionId);
    try {
      await onGuardar({
        tipo: f.tipo, problema: f.problema, etiologia: f.etiologia, signosSintomas: f.signosSintomas, fechaDiagnostico: f.fechaDiagnostico,
        codigo: f.codigo || undefined, consultaId: f.consultaId || undefined,
        evidencia: { evaluacionId: f.evaluacionId || undefined, medicionId: ev?._id, laboratorioIds: f.laboratorioIds },
      });
    } catch (err) { setError(err.message); }
  };
  const c = (k) => ({ id: `dx-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="campo"><label htmlFor="dx-tipo">Tipo</label>
        <select {...c('tipo')}><option value="nutricional">Diagnóstico nutricional</option><option value="medico_referido">Diagnóstico médico referido</option></select></div>
      <div className="campo"><label htmlFor="dx-fechaDiagnostico">Fecha</label><input type="date" {...c('fechaDiagnostico')} /></div>
      <div className="campo campo--completo"><label htmlFor="dx-problema">Problema (P) *</label><input {...c('problema')} required maxLength={500}
        placeholder={f.tipo === 'nutricional' ? 'Ej. Ingesta energética excesiva' : 'Ej. Diabetes tipo 2 (referida por su médico)'} /></div>
      {f.tipo === 'nutricional' && (
        <>
          <div className="campo campo--completo"><label htmlFor="dx-etiologia">Etiología (E) · relacionado con</label><input {...c('etiologia')} maxLength={500} /></div>
          <div className="campo campo--completo"><label htmlFor="dx-signosSintomas">Signos y síntomas (S) · evidenciado por</label><textarea {...c('signosSintomas')} maxLength={1000} /></div>
        </>
      )}
      {f.tipo === 'medico_referido' && <BuscadorCatalogo valor={f.codigo} onElegir={(cod) => setF({ ...f, codigo: cod })} id="dx-codigo" etiqueta="Código CIE-10 (catálogo importado)" />}
      <div className="campo"><label htmlFor="dx-consultaId">Consulta</label>
        <select {...c('consultaId')}><option value="">Sin vincular</option>
          {opciones.consultas.map((x) => <option key={x._id} value={x._id}>{new Date(x.fecha).toLocaleDateString('es-MX')} · {x.motivo || 'Consulta'}</option>)}</select></div>
      <div className="campo"><label htmlFor="dx-evaluacionId">Evaluación que lo sustenta</label>
        <select {...c('evaluacionId')}><option value="">Ninguna</option>
          {opciones.mediciones.map((m) => <option key={m.evaluacion._id} value={m.evaluacion._id}>{fecha(m.fecha)} · {[m.pesoKg && `${m.pesoKg} kg`, m.evaluacion.resultadosFinales?.imc?.valor && `IMC ${m.evaluacion.resultadosFinales.imc.valor}`].filter(Boolean).join(' · ')}</option>)}</select></div>
      {opciones.labs.length > 0 && (
        <fieldset className="grupo-campos campo--completo">
          <legend className="campo__ayuda">Resultados de laboratorio que lo sustentan</legend>
          {opciones.labs.slice(0, 12).map((l) => (
            <label key={l._id} className="casilla">
              <input type="checkbox" checked={f.laboratorioIds.includes(l._id)}
                onChange={(e) => setF({ ...f, laboratorioIds: e.target.checked ? [...f.laboratorioIds, l._id] : f.laboratorioIds.filter((x) => x !== l._id) })} />
              {l.nombre}: {l.valor} {l.unidad} ({fecha(l.fechaMuestra)})
            </label>
          ))}
        </fieldset>
      )}
      <p className="aviso campo--completo" style={{ margin: 0 }}>El diagnóstico lo documenta el profesional; el sistema no genera diagnósticos.</p>
      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton boton--primario">Registrar diagnóstico</button>
      </div>
    </form>
  );
}

function Diagnosticos() {
  const { pacienteId, recargar } = useFicha();
  const { puede } = useAuth();
  const [params] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const cargar = useCallback(() => planeacionApi.diagnosticos(pacienteId).then(setLista).catch(() => setLista([])), [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (d, estado) => {
    const nota = window.prompt(`Nota para el cambio a "${ESTADOS[estado][0]}" (opcional):`);
    if (nota === null) return;
    await planeacionApi.actualizarDiagnostico(d._id, { estado, nota }).catch((e) => window.alert(e.message));
    cargar(); recargar();
  };

  return (
    <section className="panel" aria-labelledby="t-dx">
      <div className="panel-encabezado">
        <div><h2 id="t-dx">Diagnósticos</h2><p className="panel-descripcion">Vinculados con la evaluación, medición o laboratorio que los sustenta.</p></div>
        {puede('clinico:escribir') && <button className="boton boton--primario" onClick={() => setNuevo(true)}><Plus aria-hidden="true" /> Nuevo diagnóstico</button>}
      </div>
      {!lista ? <div className="esqueleto" style={{ height: 160 }} /> : lista.length === 0 ? <p className="vacio">Sin diagnósticos registrados.</p> : (
        <ul className="lista-registros">
          {lista.map((d) => (
            <li key={d._id} className={params.get('registro') === d._id ? 'registro--resaltado' : undefined}>
              <div>
                <div className="lista-registros__titulo">{d.problema} <span className={`insignia insignia--${ESTADOS[d.estado][1]}`}>{ESTADOS[d.estado][0]}</span>
                  {d.tipo === 'medico_referido' && <span className="insignia"> Médico referido</span>}{d.codigo?.codigo && <span className="insignia"> {d.codigo.codigo}</span>}</div>
                {(d.etiologia || d.signosSintomas) && <div className="lista-registros__meta">{d.etiologia && `Relacionado con ${d.etiologia}. `}{d.signosSintomas && `Evidenciado por ${d.signosSintomas}.`}</div>}
                <div className="lista-registros__meta">
                  {fecha(d.fechaDiagnostico)} · {d.profesional}
                  {d.evidencia?.medicionId && <> · <Link to={`/pacientes/${pacienteId}/antropometria?registro=${d.evidencia.medicionId}`}>evaluación de soporte</Link></>}
                  {d.evidencia?.laboratorioIds?.length > 0 && <> · <Link to={`/pacientes/${pacienteId}/laboratorios`}>{d.evidencia.laboratorioIds.length} resultado(s) de laboratorio</Link></>}
                </div>
              </div>
              {puede('clinico:escribir') && (
                <label className="sr-only" htmlFor={`edo-${d._id}`}>Cambiar estado</label>
              )}
              {puede('clinico:escribir') && (
                <select id={`edo-${d._id}`} className="selector" style={{ width: 'auto' }} value={d.estado} onChange={(e) => cambiarEstado(d, e.target.value)}>
                  {Object.entries(ESTADOS).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal abierto={nuevo} titulo="Nuevo diagnóstico" onCerrar={() => setNuevo(false)} ancho={720}>
        {nuevo && <FormDiagnostico pacienteId={pacienteId} onCancelar={() => setNuevo(false)}
          onGuardar={async (d) => { await planeacionApi.crearDiagnostico(pacienteId, d); setNuevo(false); cargar(); recargar(); }} />}
      </Modal>
    </section>
  );
}

export default Diagnosticos;
