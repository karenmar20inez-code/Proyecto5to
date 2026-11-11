import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, History, Pencil, Ban, ShieldCheck } from 'lucide-react';
import { useFicha } from '../FichaPaciente';
import Modal from '../../../components/ui/Modal';
import BuscadorCatalogo from '../../../components/ui/BuscadorCatalogo';
import { antecedentesApi, pacientesApi, expedienteApi, planeacionApi } from '../../../services/api';
import { formatoFecha, useNutri } from '../../../context/NutriContext';

const fecha = (f) => (f ? formatoFecha(String(f).slice(0, 10)) : '—');

/* Campos adicionales por categoría: [clave, etiqueta, tipo, opciones?] */
const DETALLE = {
  heredofamiliar: [['parentesco', 'Parentesco', 'select', ['Madre', 'Padre', 'Hermano/a', 'Abuelo/a materno', 'Abuelo/a paterno', 'Otro']]],
  personal_patologico: [], enfermedad: [['tratamiento', 'Tratamiento actual', 'text']],
  alergia: [['reaccion', 'Reacción', 'text'], ['severidad', 'Severidad referida', 'select', ['Leve', 'Moderada', 'Grave', 'No especificada']]],
  intolerancia: [['sintomas', 'Síntomas', 'text']],
  medicamento: [['dosis', 'Dosis', 'text'], ['frecuencia', 'Frecuencia', 'text'], ['via', 'Vía', 'select', ['Oral', 'Subcutánea', 'Intramuscular', 'Intravenosa', 'Tópica', 'Otra']]],
  suplemento: [['dosis', 'Dosis', 'text'], ['frecuencia', 'Frecuencia', 'text']],
  cirugia: [['motivo', 'Motivo', 'text']], hospitalizacion: [['motivo', 'Motivo', 'text'], ['dias', 'Días de estancia', 'number']],
  nutricional: [], habito_alimentario: [['comidasDia', 'Comidas al día', 'number'], ['horarios', 'Horarios', 'text']],
  actividad_fisica: [['tipo', 'Tipo de actividad', 'text'], ['minutosSemana', 'Minutos por semana', 'number']],
  sueno: [['horas', 'Horas por noche', 'number'], ['calidad', 'Calidad referida', 'select', ['Buena', 'Regular', 'Mala']]],
  alcohol: [['frecuencia', 'Frecuencia', 'text'], ['cantidad', 'Cantidad habitual', 'text']],
  tabaco: [['cigarrosDia', 'Cigarros por día', 'number'], ['anios', 'Años de consumo', 'number']],
  ginecoobstetrico: [['gestas', 'Gestas', 'number'], ['partos', 'Partos', 'number'], ['cesareas', 'Cesáreas', 'number'], ['abortos', 'Abortos', 'number'],
    ['fum', 'Fecha de última menstruación', 'date'], ['embarazoActual', '¿Embarazo actual?', 'select', ['No', 'Sí', 'No sabe']], ['lactancia', '¿Lactancia?', 'select', ['No', 'Sí']]],
};
const CON_CODIGO = ['enfermedad', 'personal_patologico', 'heredofamiliar'];
const NEGABLES = ['alergia', 'intolerancia', 'tabaco', 'alcohol', 'cirugia'];
const ESTADOS = { activo: ['Activo', 'info'], resuelto: ['Resuelto', 'ok'], suspendido: ['Suspendido', ''], negado: ['Negado', ''] };

const resumenDetalle = (d = {}) => Object.entries(d).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');

/* ---------- Formulario de antecedente (alta o actualización) ---------- */
function FormAntecedente({ categorias, inicial, sexo, onGuardar, onCancelar }) {
  const editando = !!inicial?._id;
  const [f, setF] = useState(() => ({
    categoria: inicial?.categoria || 'alergia', descripcion: inicial?.descripcion || '', estado: inicial?.estado || 'activo',
    fechaInicio: inicial?.fechaInicio ? String(inicial.fechaInicio).slice(0, 10) : '', observaciones: inicial?.observaciones || '',
    detalle: { ...(inicial?.detalle || {}) }, codigo: inicial?.codigo?.codigo ? inicial.codigo : null, motivoCambio: '',
  }));
  const [error, setError] = useState('');
  const disponibles = Object.entries(categorias).filter(([k]) => k !== 'ginecoobstetrico' || sexo === 'Femenino' || editando);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onGuardar({ ...f, fechaInicio: f.fechaInicio || undefined, codigo: f.codigo || undefined });
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="a-cat">Categoría</label>
        <select id="a-cat" value={f.categoria} disabled={editando} onChange={(e) => setF({ ...f, categoria: e.target.value, detalle: {} })}>
          {disponibles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {sexo !== 'Femenino' && !editando && <span className="campo__ayuda">Ginecoobstétricos: disponibles cuando el sexo registrado es femenino.</span>}
      </div>
      <div className="campo">
        <label htmlFor="a-estado">Estado</label>
        <select id="a-estado" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
          {Object.entries(ESTADOS).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </div>
      <div className="campo campo--completo">
        <label htmlFor="a-desc">Descripción *</label>
        <input id="a-desc" value={f.descripcion} required onChange={(e) => setF({ ...f, descripcion: e.target.value })}
          placeholder={f.categoria === 'alergia' ? 'Ej. Huevo, penicilina…' : 'Describe el antecedente'} />
      </div>
      {(DETALLE[f.categoria] || []).map(([clave, etiqueta, tipo, opciones]) => (
        <div className="campo" key={clave}>
          <label htmlFor={`a-${clave}`}>{etiqueta}</label>
          {tipo === 'select' ? (
            <select id={`a-${clave}`} value={f.detalle[clave] || ''} onChange={(e) => setF({ ...f, detalle: { ...f.detalle, [clave]: e.target.value } })}>
              <option value="">—</option>{opciones.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input id={`a-${clave}`} type={tipo} min={tipo === 'number' ? 0 : undefined} value={f.detalle[clave] || ''}
              onChange={(e) => setF({ ...f, detalle: { ...f.detalle, [clave]: e.target.value } })} />
          )}
        </div>
      ))}
      <div className="campo">
        <label htmlFor="a-inicio">Fecha de inicio / diagnóstico</label>
        <input id="a-inicio" type="date" value={f.fechaInicio} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, fechaInicio: e.target.value })} />
      </div>
      {CON_CODIGO.includes(f.categoria) && <BuscadorCatalogo valor={f.codigo} onElegir={(c) => setF({ ...f, codigo: c })} id="a-codigo" />}
      <div className="campo campo--completo">
        <label htmlFor="a-obs">Observaciones</label>
        <textarea id="a-obs" value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} />
      </div>
      {editando && (
        <div className="campo campo--completo">
          <label htmlFor="a-motivo">Motivo de la actualización</label>
          <input id="a-motivo" value={f.motivoCambio} onChange={(e) => setF({ ...f, motivoCambio: e.target.value })} placeholder="Ej. Cambio de dosis indicado por su médico" />
          <span className="campo__ayuda">Se crea una nueva versión; la anterior se conserva en el historial.</span>
        </div>
      )}
      {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
      <div className="formulario-acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton boton--primario">{editando ? 'Guardar nueva versión' : 'Registrar'}</button>
      </div>
    </form>
  );
}

/* ---------- Identificación y expediente ---------- */
function Identificacion() {
  const { pacienteId, ficha, recargar } = useFicha();
  const { recargarPacientes } = useNutri();
  const p = ficha.paciente;
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [error, setError] = useState('');

  const abrir = () => {
    setF({
      nombreCompleto: p.nombreCompleto, fechaNacimiento: p.fechaNacimiento ? String(p.fechaNacimiento).slice(0, 10) : '', sexo: p.sexo || '',
      curp: p.curp || '', telefono: p.telefono || '', correo: p.correo, direccion: p.direccion || '', ocupacion: p.ocupacion || '',
      contactoEmergencia: { nombre: p.contactoEmergencia?.nombre || '', parentesco: p.contactoEmergencia?.parentesco || '', telefono: p.contactoEmergencia?.telefono || '' },
      motivoConsulta: ficha.expediente.motivoConsulta || '', estadoExpediente: ficha.expediente.estado,
    });
    setEditando(true);
  };
  const guardar = async (e) => {
    e.preventDefault();
    try {
      const { motivoConsulta, estadoExpediente, ...datos } = f;
      await pacientesApi.actualizar(pacienteId, datos);
      if (motivoConsulta !== (ficha.expediente.motivoConsulta || '') || estadoExpediente !== ficha.expediente.estado) {
        await expedienteApi.actualizar(pacienteId, { motivoConsulta, estado: estadoExpediente });
      }
      setEditando(false);
      recargar();
      recargarPacientes();
    } catch (err) { setError(err.message); }
  };
  const c = (k) => ({ id: `id-${k}`, value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  return (
    <section className="panel" aria-labelledby="t-ident">
      <div className="panel-encabezado">
        <div><h2 id="t-ident">Identificación del paciente</h2><p className="panel-descripcion">Teléfono, dirección y contacto de emergencia se guardan cifrados.</p></div>
        <button className="boton boton--secundario boton--chico" onClick={abrir}><Pencil aria-hidden="true" /> Editar</button>
      </div>
      <dl className="datos">
        <dt>Expediente</dt><dd>{ficha.expediente.folio} · {ficha.expediente.estado}</dd>
        <dt>Fecha de nacimiento</dt><dd>{p.fechaNacimiento ? `${fecha(p.fechaNacimiento)} (${p.edadActual} años)` : `No registrada${p.edad != null ? ` · edad declarada ${p.edad}` : ''}`}</dd>
        <dt>Sexo</dt><dd>{p.sexo || '—'}</dd>
        <dt>CURP</dt><dd>{p.curp || '—'}</dd>
        <dt>Contacto</dt><dd>{p.telefono} · {p.correo}</dd>
        <dt>Dirección</dt><dd>{p.direccion || '—'}</dd>
        <dt>Ocupación</dt><dd>{p.ocupacion || '—'}</dd>
        <dt>Emergencia</dt><dd>{p.contactoEmergencia?.nombre ? `${p.contactoEmergencia.nombre} (${p.contactoEmergencia.parentesco || '—'}) · ${p.contactoEmergencia.telefono || '—'}` : '—'}</dd>
        <dt>Motivo de consulta</dt><dd>{ficha.expediente.motivoConsulta || '—'}</dd>
        <dt>Responsable</dt><dd>{ficha.expediente.responsable?.nombre || '—'}</dd>
      </dl>

      <Modal abierto={editando} titulo="Editar identificación" onCerrar={() => setEditando(false)} ancho={720}>
        <form className="formulario" onSubmit={guardar}>
          <div className="campo campo--completo"><label htmlFor="id-nombreCompleto">Nombre completo</label><input {...c('nombreCompleto')} required /></div>
          <div className="campo"><label htmlFor="id-fechaNacimiento">Fecha de nacimiento</label><input type="date" {...c('fechaNacimiento')} /></div>
          <div className="campo"><label htmlFor="id-sexo">Sexo</label><select {...c('sexo')}><option value="">Sin especificar</option><option>Femenino</option><option>Masculino</option><option>Otro</option></select></div>
          <div className="campo"><label htmlFor="id-curp">CURP</label><input {...c('curp')} maxLength={18} /></div>
          <div className="campo"><label htmlFor="id-telefono">Teléfono</label><input type="tel" {...c('telefono')} required /></div>
          <div className="campo"><label htmlFor="id-correo">Correo</label><input type="email" {...c('correo')} required /></div>
          <div className="campo"><label htmlFor="id-ocupacion">Ocupación</label><input {...c('ocupacion')} /></div>
          <div className="campo campo--completo"><label htmlFor="id-direccion">Dirección</label><input {...c('direccion')} /></div>
          {['nombre', 'parentesco', 'telefono'].map((k) => (
            <div className="campo" key={k}>
              <label htmlFor={`ce-${k}`}>Contacto de emergencia · {k}</label>
              <input id={`ce-${k}`} value={f.contactoEmergencia?.[k] || ''} onChange={(e) => setF({ ...f, contactoEmergencia: { ...f.contactoEmergencia, [k]: e.target.value } })} />
            </div>
          ))}
          <div className="campo campo--completo"><label htmlFor="id-motivoConsulta">Motivo de consulta</label><textarea {...c('motivoConsulta')} /></div>
          <div className="campo"><label htmlFor="id-estadoExpediente">Estado del expediente</label>
            <select {...c('estadoExpediente')}><option value="abierto">Abierto</option><option value="en_seguimiento">En seguimiento</option><option value="alta">Alta</option><option value="archivado">Archivado</option></select></div>
          {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
          <div className="formulario-acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setEditando(false)}>Cancelar</button>
            <button type="submit" className="boton boton--primario">Guardar</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ---------- Consentimientos ---------- */
function Consentimientos() {
  const { pacienteId, recargar } = useFicha();
  const [datos, setDatos] = useState(null);
  const [f, setF] = useState({ tipo: 'datos_sensibles', versionDocumento: '', medio: 'firma_autografa', fecha: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const cargar = useCallback(() => planeacionApi.consentimientos(pacienteId).then(setDatos).catch(() => {}), [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const registrar = async (e) => {
    e.preventDefault();
    try { await planeacionApi.crearConsentimiento(pacienteId, f); setF({ ...f, versionDocumento: '' }); cargar(); recargar(); } catch (err) { setError(err.message); }
  };
  const revocar = async (c) => {
    const motivo = window.prompt('Motivo de la revocación:');
    if (motivo === null) return;
    await planeacionApi.revocarConsentimiento(c._id, motivo).catch((err) => window.alert(err.message));
    cargar(); recargar();
  };

  return (
    <section className="panel" aria-labelledby="t-cons">
      <h2 id="t-cons"><ShieldCheck size={16} aria-hidden="true" /> Consentimiento y privacidad</h2>
      <p className="panel-descripcion">La LFPDPPP (DOF 20/03/2025) exige consentimiento expreso y por escrito para tratar datos de salud. Registra el documento firmado.</p>
      <ul className="lista-registros">
        {(datos?.consentimientos || []).map((c) => (
          <li key={c._id}>
            <span><span className="lista-registros__titulo">{datos.tipos[c.tipo]}</span>
              <span className="lista-registros__meta"> · v. {c.versionDocumento} · {fecha(c.fecha)} · {c.medio.replace('_', ' ')}{c.revocacion?.fecha ? ` · revocado ${fecha(c.revocacion.fecha)}` : ''}</span></span>
            {c.otorgado && !c.revocacion?.fecha ? <button className="boton boton--fantasma boton--chico" onClick={() => revocar(c)}>Revocar</button> : <span className="insignia insignia--peligro">Revocado</span>}
          </li>
        ))}
        {datos && !datos.consentimientos.length && <li className="campo__ayuda">Sin consentimientos registrados.</li>}
      </ul>
      <form className="formulario" onSubmit={registrar} style={{ marginTop: 'var(--e4)' }}>
        <div className="campo"><label htmlFor="c-tipo">Tipo</label>
          <select id="c-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(datos?.tipos || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="campo"><label htmlFor="c-version">Versión del documento *</label><input id="c-version" value={f.versionDocumento} required onChange={(e) => setF({ ...f, versionDocumento: e.target.value })} placeholder="Ej. AP-2026-01" /></div>
        <div className="campo"><label htmlFor="c-medio">Medio</label>
          <select id="c-medio" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value })}>
            <option value="firma_autografa">Firma autógrafa</option><option value="firma_electronica">Firma electrónica</option><option value="medio_electronico">Medio electrónico</option>
          </select></div>
        <div className="campo"><label htmlFor="c-fecha">Fecha</label><input id="c-fecha" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
        {error && <p className="aviso aviso--error campo--completo" role="alert">{error}</p>}
        <div className="formulario-acciones"><button className="boton boton--primario" type="submit"><Plus aria-hidden="true" /> Registrar</button></div>
      </form>
    </section>
  );
}

/* ---------- Pestaña ---------- */
function Historia() {
  const { pacienteId, ficha, recargar } = useFicha();
  const [params] = useSearchParams();
  const resaltado = params.get('registro');
  const [datos, setDatos] = useState(null);
  const [formulario, setFormulario] = useState(null); // { inicial }
  const [versiones, setVersiones] = useState(null);

  const cargar = useCallback(() => antecedentesApi.listar(pacienteId).then(setDatos).catch(() => setDatos({ categorias: {}, antecedentes: [] })), [pacienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (f) => {
    if (formulario.inicial?._id) {
      const { categoria, ...cambios } = f; // eslint-disable-line no-unused-vars
      await antecedentesApi.actualizar(formulario.inicial._id, cambios);
    } else await antecedentesApi.crear(pacienteId, f);
    setFormulario(null);
    cargar();
    recargar();
  };
  const negar = async (categoria) => {
    await antecedentesApi.crear(pacienteId, { categoria, descripcion: `Niega ${datos.categorias[categoria].toLowerCase()}`, estado: 'negado' });
    cargar(); recargar();
  };

  const porCategoria = Object.entries(datos?.categorias || {}).map(([k, nombre]) => ({ k, nombre, lista: (datos?.antecedentes || []).filter((a) => a.categoria === k) }));

  return (
    <div className="rejilla-aurea">
      <section className="panel" aria-labelledby="t-antecedentes">
        <div className="panel-encabezado">
          <div>
            <h2 id="t-antecedentes">Antecedentes clínicos</h2>
            <p className="panel-descripcion">Registros estructurados con fecha, estado y observaciones. Cada actualización conserva la versión anterior.</p>
          </div>
          <button className="boton boton--primario" onClick={() => setFormulario({ inicial: null })}><Plus aria-hidden="true" /> Agregar antecedente</button>
        </div>
        {!datos ? <div className="esqueleto" style={{ height: 240 }} /> : porCategoria
          .filter((c) => c.lista.length || NEGABLES.includes(c.k))
          .filter((c) => c.k !== 'ginecoobstetrico' || ficha.paciente.sexo === 'Femenino' || c.lista.length)
          .map((c) => (
            <div key={c.k} style={{ marginBottom: 'var(--e4)' }}>
              <div className="panel-encabezado" style={{ marginBottom: 4 }}>
                <h3>{c.nombre}</h3>
                {!c.lista.length && NEGABLES.includes(c.k) && (
                  <button className="boton boton--fantasma boton--chico" onClick={() => negar(c.k)}><Ban aria-hidden="true" /> Registrar que lo niega</button>
                )}
              </div>
              {c.lista.length === 0 ? <p className="campo__ayuda">Sin registro: verifica con el paciente.</p> : (
                <ul className="lista-registros">
                  {c.lista.map((a) => (
                    <li key={a._id} className={resaltado === String(a._id) ? 'registro--resaltado' : undefined}>
                      <div>
                        <div className="lista-registros__titulo">{a.descripcion} <span className={`insignia insignia--${ESTADOS[a.estado]?.[1] || ''}`}>{ESTADOS[a.estado]?.[0]}</span>
                          {a.codigo?.codigo && <span className="insignia"> {a.codigo.sistema} {a.codigo.codigo}</span>}</div>
                        <div className="lista-registros__meta">
                          {[resumenDetalle(a.detalle), a.fechaInicio && `desde ${fecha(a.fechaInicio)}`, a.observaciones].filter(Boolean).join(' · ')}
                        </div>
                        <div className="lista-registros__meta">v{a.version} · {a.registradoPorNombre} · {fecha(a.createdAt)}{a.motivoCambio ? ` · ${a.motivoCambio}` : ''}</div>
                      </div>
                      <div className="encabezado-acciones">
                        <button className="boton boton--secundario boton--chico" onClick={() => setFormulario({ inicial: a })} aria-label={`Actualizar ${a.descripcion}`}><Pencil aria-hidden="true" /></button>
                        {a.version > 1 && <button className="boton boton--secundario boton--chico" onClick={async () => setVersiones(await antecedentesApi.versiones(a._id))} aria-label="Ver versiones"><History aria-hidden="true" /></button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
      </section>

      <div className="pila">
        <Identificacion />
        <Consentimientos />
      </div>

      <Modal abierto={!!formulario} titulo={formulario?.inicial ? 'Actualizar antecedente' : 'Nuevo antecedente'} onCerrar={() => setFormulario(null)} ancho={720}>
        {formulario && datos && (
          <FormAntecedente categorias={datos.categorias} inicial={formulario.inicial} sexo={ficha.paciente.sexo}
            onGuardar={guardar} onCancelar={() => setFormulario(null)} />
        )}
      </Modal>
      <Modal abierto={!!versiones} titulo="Historial de versiones" onCerrar={() => setVersiones(null)}
        acciones={<button className="boton boton--secundario" onClick={() => setVersiones(null)}>Cerrar</button>}>
        <ul className="linea-tiempo">
          {(versiones || []).map((v) => (
            <li key={v._id}>
              <div className="linea-tiempo__fecha">{fecha(v.createdAt)} · {v.registradoPorNombre} · v{v.version}{v.vigente ? ' (vigente)' : ''}</div>
              <div className="linea-tiempo__titulo">{v.descripcion} · {v.estado}</div>
              <div className="linea-tiempo__detalle">{[resumenDetalle(v.detalle), v.observaciones, v.motivoCambio && `Motivo: ${v.motivoCambio}`].filter(Boolean).join(' · ')}</div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

export default Historia;
