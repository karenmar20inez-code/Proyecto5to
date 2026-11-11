import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, History, Trash2, Plus } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import FormularioMedicion from '../../../components/FormularioMedicion/FormularioMedicion';
import Indicador from '../../../components/Indicador/Indicador';
import { PanelAjuste } from '../../AnalisisPaciente/PanelesClinicos';
import { medicionesApi, consultasApi } from '../../../services/api';
import { formatoFecha, fechaISO, useNutri } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';

const fecha = (f) => formatoFecha(fechaISO(f));
const METODOS = { bascula_digital: 'Báscula digital', bascula_mecanica: 'Báscula mecánica', bioimpedancia: 'Bioimpedancia', autorreporte: 'Autorreporte', plicometria: 'Plicometría', dexa: 'DEXA', cinta_metrica: 'Cinta métrica', otro: 'Otro' };

function Antropometria() {
  const { pacienteId, ficha, recargar } = useFicha();
  const { recargarMediciones } = useNutri();
  const { puede } = useAuth();
  const [params] = useSearchParams();
  const [mediciones, setMediciones] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [formulario, setFormulario] = useState(null); // null | { medicion }
  const [versiones, setVersiones] = useState(null);

  const cargar = useCallback(async () => {
    const [m, c] = await Promise.all([medicionesApi.listar(pacienteId), consultasApi.listar(pacienteId).catch(() => [])]);
    setMediciones(m.mediciones);
    setConsultas(c);
  }, [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const trasGuardar = () => { setFormulario(null); cargar(); recargar(); recargarMediciones(); };
  const anular = async (m) => {
    const motivo = window.prompt('Motivo de la anulación (la medición se conserva en el historial):');
    if (!motivo?.trim()) return;
    try { await medicionesApi.anular(m._id, motivo.trim()); trasGuardar(); } catch (e) { window.alert(e.message); }
  };

  const ultima = mediciones ? [...mediciones].reverse().find((m) => m.evaluacion) : null;
  const r = ultima?.evaluacion?.resultadosFinales || {};
  const estaturaPrevia = mediciones ? [...mediciones].reverse().find((m) => m.estaturaCm)?.estaturaCm || ficha.paciente.estatura : null;

  return (
    <div className="pila">
      <section className="panel" aria-labelledby="t-mediciones">
        <div className="panel-encabezado">
          <div>
            <h2 id="t-mediciones">Mediciones antropométricas</h2>
            <p className="panel-descripcion">Cada medición registra fecha, método, consulta y profesional. Las correcciones crean una nueva versión.</p>
          </div>
          {puede('clinico:escribir') && <button className="boton boton--primario" onClick={() => setFormulario({ medicion: null })}><Plus aria-hidden="true" /> Registrar medición</button>}
        </div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th className="celda-num">Peso</th><th className="celda-num">IMC</th><th className="celda-num">Cintura</th><th className="celda-num">Cadera</th>
                <th className="celda-num">ICC</th><th className="celda-num">Grasa</th><th className="celda-num">Masa musc.</th><th>Método</th><th>Registró</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {!mediciones && <tr><td colSpan="11" className="vacio">Cargando…</td></tr>}
              {mediciones?.length === 0 && <tr><td colSpan="11" className="vacio">Sin mediciones registradas.</td></tr>}
              {mediciones && [...mediciones].reverse().map((m) => {
                const res = m.evaluacion?.resultadosFinales || {};
                const v = (x, u) => (x != null ? `${x} ${u}` : '—');
                return (
                  <tr key={m._id} className={params.get('registro') === String(m._id) ? 'fila--seleccionada' : undefined}>
                    <td className="celda-fuerte">{fecha(m.fecha)}{m.version > 1 && <> <span className="insignia">v{m.version}</span></>}</td>
                    <td className="celda-num">{v(m.pesoKg, 'kg')}</td>
                    <td className="celda-num">{res.imc?.valor ?? '—'}</td>
                    <td className="celda-num">{v(m.cinturaCm, 'cm')}</td>
                    <td className="celda-num">{v(m.caderaCm, 'cm')}</td>
                    <td className="celda-num">{res.relacionCinturaCadera?.valor ?? '—'}</td>
                    <td className="celda-num">{v(m.grasaPorcentaje, '%')}</td>
                    <td className="celda-num">{v(m.masaMuscularKg, 'kg')}</td>
                    <td>{METODOS[m.metodos?.peso] || METODOS[m.metodos?.composicion] || '—'}</td>
                    <td><small>{m.responsable}</small></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {puede('clinico:escribir') && <button className="boton boton--secundario boton--chico" onClick={() => setFormulario({ medicion: m })} aria-label={`Corregir medición del ${fecha(m.fecha)}`}><Pencil aria-hidden="true" /></button>}{' '}
                      <button className="boton boton--secundario boton--chico" onClick={async () => setVersiones(await medicionesApi.versiones(m._id))} aria-label="Ver versiones"><History aria-hidden="true" /></button>{' '}
                      {puede('clinico:escribir') && <button className="boton boton--peligro boton--chico" onClick={() => anular(m)} aria-label="Anular medición"><Trash2 aria-hidden="true" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {ultima && (
        <div className="rejilla-aurea">
          <section className="panel" aria-labelledby="t-eval">
            <h2 id="t-eval">Evaluación de la medición del {fecha(ultima.fecha)}</h2>
            <p className="panel-descripcion">Motor de fórmulas v{ultima.evaluacion.versionFormulas}. Pasa el cursor sobre un indicador para ver datos faltantes y restricciones.</p>
            <div className="rejilla-kpi" style={{ marginBottom: 0 }}>
              <Indicador titulo="IMC" resultado={r.imc} detalle={r.imc?.categoriaReferencia && `Ref. OMS: ${r.imc.categoriaReferencia}`} />
              <Indicador titulo="TMR (Mifflin-St Jeor)" resultado={r.tmr} decimales={0} />
              <Indicador titulo="Gasto energético total" resultado={r.get} decimales={0} />
              <Indicador titulo="Cintura / cadera" resultado={r.relacionCinturaCadera} decimales={2} />
              <Indicador titulo="Cintura / estatura" resultado={r.relacionCinturaEstatura} decimales={2} />
              <Indicador titulo="Masa grasa" valor={r.composicion?.valor?.masaGrasaKg ?? null} unidad="kg" origen="calculado" />
              <Indicador titulo="Masa libre de grasa" valor={r.composicion?.valor?.masaLibreGrasaKg ?? null} unidad="kg" origen="calculado" />
              <Indicador titulo="Cambio de peso" resultado={r.cambioPeso} decimales={2} />
            </div>
          </section>
          {puede('clinico:escribir') && <PanelAjuste evaluacion={ultima.evaluacion} fechaMedicion={fecha(ultima.fecha)} onGuardado={() => { cargar(); recargar(); }} />}
        </div>
      )}

      <Modal abierto={!!formulario} titulo={formulario?.medicion ? `Corregir medición del ${fecha(formulario.medicion.fecha)}` : 'Registrar medición'}
        onCerrar={() => setFormulario(null)} ancho={760}>
        {formulario && (
          <FormularioMedicion pacienteId={pacienteId} medicion={formulario.medicion} consultas={consultas}
            estaturaPrevia={estaturaPrevia} onGuardado={trasGuardar} onCancelar={() => setFormulario(null)} />
        )}
      </Modal>
      <Modal abierto={!!versiones} titulo="Versiones de la medición" onCerrar={() => setVersiones(null)}
        acciones={<button className="boton boton--secundario" onClick={() => setVersiones(null)}>Cerrar</button>}>
        <ul className="linea-tiempo">
          {(versiones || []).map((v) => (
            <li key={v._id}>
              <div className="linea-tiempo__fecha">{new Date(v.createdAt).toLocaleString('es-MX')} · {v.responsable}</div>
              <div className="linea-tiempo__titulo">Versión {v.version} {v.vigente ? '(vigente)' : v.anulada ? '(anulada)' : '(reemplazada)'}</div>
              <div className="linea-tiempo__detalle">
                {v.motivoCambio || (v.version === 1 ? 'Registro original' : '')}{v.anulacion?.motivo && ` · Anulada: ${v.anulacion.motivo}`}
                {' · '}peso {v.pesoKg ?? '—'} kg · cintura {v.cinturaCm ?? '—'} cm · grasa {v.grasaPorcentaje ?? '—'} %
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

export default Antropometria;
