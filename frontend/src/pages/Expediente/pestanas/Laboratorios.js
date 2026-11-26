import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import TablaDatos from '../../../components/ui/TablaDatos';
import { SerieTemporal } from '../../../components/Graficas/GraficasClinicas';
import { laboratorioApi, consultasApi } from '../../../services/api';
import { formatoFecha, fechaISO } from '../../../context/NutriContext';
import { useAuth } from '../../../context/AuthContext';
import { useTema } from '../../../context/TemaContext';

const fecha = (f) => formatoFecha(fechaISO(f));
const VACIO = { fechaMuestra: new Date().toISOString().slice(0, 10), analito: 'glucosa_ayuno', nombre: '', valor: '', unidad: '', min: '', max: '', texto: '', procedencia: '', metodo: '', ayuno: false, observaciones: '', consultaId: '' };

function FormLaboratorio({ analitos, consultas, onGuardar, onCancelar }) {
  const [f, setF] = useState(() => ({ ...VACIO, unidad: analitos.glucosa_ayuno?.unidad || '' }));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const c = (k) => ({ id: `lab-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }), 'aria-invalid': !!errores[k] });

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setErrores({});
    try {
      await onGuardar({
        fechaMuestra: f.fechaMuestra, analito: f.analito, nombre: f.analito === 'otro' ? f.nombre : undefined, valor: Number(f.valor), unidad: f.unidad,
        rangoReferencia: { min: f.min, max: f.max, texto: f.texto }, procedencia: f.procedencia, metodo: f.metodo || undefined,
        ayuno: f.ayuno, observaciones: f.observaciones || undefined, consultaId: f.consultaId || undefined,
      });
    } catch (err) { setError(err.message); setErrores(err.errores || {}); }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="campo"><label htmlFor="lab-analito">Estudio *</label>
        <select {...c('analito')} onChange={(e) => setF({ ...f, analito: e.target.value, unidad: analitos[e.target.value]?.unidad || '' })}>
          {Object.entries(analitos).map(([k, a]) => <option key={k} value={k}>{a.nombre}</option>)}
        </select></div>
      {f.analito === 'otro' && <div className="campo"><label htmlFor="lab-nombre">Nombre del estudio *</label><input {...c('nombre')} required /></div>}
      <div className="campo"><label htmlFor="lab-fechaMuestra">Fecha de toma *</label><input type="date" {...c('fechaMuestra')} max={new Date().toISOString().slice(0, 10)} required /></div>
      <div className="campo"><label htmlFor="lab-valor">Resultado *</label><input type="number" step="any" {...c('valor')} required /></div>
      <div className="campo"><label htmlFor="lab-unidad">Unidad *</label><input {...c('unidad')} required />
        <span className="campo__ayuda">Verifica que coincida con la del reporte.</span></div>
      <div className="campo"><label htmlFor="lab-min">Referencia mínima</label><input type="number" step="any" {...c('min')} /></div>
      <div className="campo"><label htmlFor="lab-max">Referencia máxima</label><input type="number" step="any" {...c('max')} /></div>
      <div className="campo campo--completo"><label htmlFor="lab-texto">Referencia (texto del reporte)</label><input {...c('texto')} placeholder="Ej. 70–100 mg/dL en ayuno" />
        <span className="campo__ayuda">Captura el rango impreso por el laboratorio; el sistema no asigna rangos por su cuenta.</span></div>
      <div className="campo"><label htmlFor="lab-procedencia">Laboratorio / procedencia *</label><input {...c('procedencia')} required />
        {errores.procedencia && <small className="campo__error">{errores.procedencia}</small>}</div>
      <div className="campo"><label htmlFor="lab-metodo">Método</label><input {...c('metodo')} /></div>
      <div className="campo"><label htmlFor="lab-consultaId">Consulta</label>
        <select {...c('consultaId')}><option value="">Sin vincular</option>
          {consultas.map((x) => <option key={x._id} value={x._id}>{new Date(x.fecha).toLocaleDateString('es-MX')} · {x.motivo || 'Consulta'}</option>)}
        </select></div>
      <label className="casilla"><input type="checkbox" checked={f.ayuno} onChange={(e) => setF({ ...f, ayuno: e.target.checked })} /> Muestra en ayuno</label>
      <div className="campo campo--completo"><label htmlFor="lab-observaciones">Observaciones</label><textarea {...c('observaciones')} /></div>
      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton boton--primario">Registrar resultado</button>
      </div>
    </form>
  );
}

function Laboratorios() {
  useTema(); // al cambiar de modo claro/oscuro se vuelven a dibujar las gráficas con los colores del tema
  const { pacienteId, recargar } = useFicha();
  const { puede } = useAuth();
  const [params] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [analitos, setAnalitos] = useState({});
  const [consultas, setConsultas] = useState([]);
  const [nuevo, setNuevo] = useState(false);
  const [graficado, setGraficado] = useState('');

  const cargar = useCallback(async () => {
    const [l, a, c] = await Promise.all([laboratorioApi.listar(pacienteId), laboratorioApi.analitos(), consultasApi.listar(pacienteId).catch(() => [])]);
    setLista(l); setAnalitos(a); setConsultas(c);
    setGraficado((g) => g || l[0]?.analito || '');
  }, [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const presentes = useMemo(() => [...new Map((lista || []).map((r) => [r.analito, r.nombre])).entries()], [lista]);
  const serie = useMemo(() => (lista || []).filter((r) => r.analito === graficado).sort((a, b) => new Date(a.fechaMuestra) - new Date(b.fechaMuestra)), [lista, graficado]);
  const ultimoRango = serie[serie.length - 1]?.rangoReferencia;

  const columnas = [
    { clave: 'fechaMuestra', titulo: 'Fecha', valor: (r) => fechaISO(r.fechaMuestra), render: (r) => <span className="celda-fuerte">{fecha(r.fechaMuestra)}</span> },
    { clave: 'nombre', titulo: 'Estudio' },
    { clave: 'valor', titulo: 'Resultado', numerica: true, render: (r) => <>{r.valor} {r.unidad}{r.fueraDeRango && <> <span className={`insignia insignia--${r.fueraDeRango === 'alto' ? 'peligro' : 'aviso'}`}>{r.fueraDeRango === 'alto' ? '↑ Alto' : '↓ Bajo'}</span></>}</> },
    { clave: 'rango', titulo: 'Referencia (laboratorio)', ordenable: false, valor: (r) => r.rangoReferencia?.texto || [r.rangoReferencia?.min, r.rangoReferencia?.max].filter((x) => x != null).join('–'), render: (r) => r.rangoReferencia?.texto || ((r.rangoReferencia?.min != null || r.rangoReferencia?.max != null) ? `${r.rangoReferencia.min ?? ''}–${r.rangoReferencia.max ?? ''} ${r.unidad}` : <span className="campo__ayuda">Sin rango capturado</span>) },
    { clave: 'procedencia', titulo: 'Procedencia' },
    { clave: 'registradoPorNombre', titulo: 'Registró' },
  ];

  return (
    <div className="pila">
      <section className="panel" aria-labelledby="t-labs">
        <div className="panel-encabezado">
          <div><h2 id="t-labs">Resultados de laboratorio</h2><p className="panel-descripcion">Con fecha de toma, unidad, rango de referencia del laboratorio y procedencia.</p></div>
          {puede('clinico:escribir') && <button className="boton boton--primario" onClick={() => setNuevo(true)}><Plus aria-hidden="true" /> Registrar resultado</button>}
        </div>
        <TablaDatos columnas={columnas} filas={lista || []} cargando={!lista} etiqueta="Resultados de laboratorio" placeholder="Filtrar estudios…"
          ordenInicial={{ clave: 'fechaMuestra', dir: 'desc' }} vacio="Sin resultados registrados."
          onFila={(r) => setGraficado(r.analito)} />
        {params.get('registro') && <p className="campo__ayuda">Registro señalado desde la línea de tiempo o una alerta: {params.get('registro')}</p>}
      </section>

      {presentes.length > 0 && (
        <section className="panel" aria-labelledby="t-evol-lab">
          <div className="panel-encabezado">
            <div><h2 id="t-evol-lab">Evolución del resultado</h2><p className="panel-descripcion">La banda verde es el rango de referencia del último reporte.</p></div>
            <label className="sr-only" htmlFor="sel-analito">Estudio a graficar</label>
            <select id="sel-analito" className="selector" style={{ width: 'auto' }} value={graficado} onChange={(e) => setGraficado(e.target.value)}>
              {presentes.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </div>
          <SerieTemporal unidad={serie[0]?.unidad || ''} rango={ultimoRango && { ...ultimoRango, etiqueta: 'Referencia del laboratorio' }}
            series={[{ nombre: serie[0]?.nombre || '', puntos: serie.map((r) => ({ t: new Date(r.fechaMuestra).getTime(), valor: r.valor, unidad: r.unidad, origen: 'medido', procedencia: r.procedencia })) }]} />
        </section>
      )}

      <Modal abierto={nuevo} titulo="Registrar resultado de laboratorio" onCerrar={() => setNuevo(false)} ancho={720}>
        {nuevo && <FormLaboratorio analitos={analitos} consultas={consultas} onCancelar={() => setNuevo(false)}
          onGuardar={async (d) => { await laboratorioApi.crear(pacienteId, d); setNuevo(false); cargar(); setTimeout(recargar, 800); }} />}
      </Modal>
    </div>
  );
}

export default Laboratorios;
