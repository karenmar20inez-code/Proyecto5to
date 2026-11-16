import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiUserPlus, FiEdit2, FiTrash2, FiActivity, FiCheckSquare, FiRefreshCw, FiTrendingUp } from 'react-icons/fi';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/ui/Modal';
import {
  useNutri,
  nombreCompleto,
  iniciales,
  calcularIMC,
  clasificarIMC,
  resumenCumplimiento,
  formatoFecha,
  ESTADOS_PACIENTE,
} from '../../context/NutriContext';
import { useAuth } from '../../context/AuthContext';
import { usuariosApi } from '../../services/api';

const VACIO = {
  nombreCompleto: '',
  fechaNacimiento: '',
  correo: '',
  telefono: '',
  sexo: '',
  objetivo: '',
  peso: '',
  estatura: '',
  estado: 'activo',
  dietaId: '',
  responsableId: '',
  motivoConsulta: '',
};

const OBJETIVOS = [
  'Reducción de peso',
  'Aumento de masa muscular',
  'Control de glucosa',
  'Control de presión arterial',
  'Alimentación saludable',
  'Rendimiento deportivo',
];

/* Paciente de la API → valores del formulario */
const aFormulario = (p) => ({
  ...Object.fromEntries(Object.keys(VACIO).map((k) => [k, p[k] ?? VACIO[k]])),
  fechaNacimiento: p.fechaNacimiento ? String(p.fechaNacimiento).slice(0, 10) : '',
});

function Pacientes() {
  const {
    pacientes, ultimasMediciones, cumplimiento,
    cargandoPacientes, errorPacientes, recargarPacientes,
    agregarPaciente, actualizarPaciente, eliminarPaciente,
    dietas, buscarDieta,
  } = useNutri();
  const { usuario, puede } = useAuth();
  const [profesionales, setProfesionales] = useState([]);
  useEffect(() => { usuariosApi.profesionales().then(setProfesionales).catch(() => {}); }, []);
  const clinico = puede('clinico:leer');

  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [aviso, setAviso] = useState('');
  const [avisoError, setAvisoError] = useState('');

  /* Si falla el guardado, desplaza el modal hasta el mensaje de error para que se lea */
  useEffect(() => {
    if (errorForm) document.querySelector('.modal__cuerpo [role="alert"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [errorForm]);

  const filtrados = useMemo(() => {
    const t = busqueda.toLowerCase().trim();
    return pacientes.filter((p) =>
      [p.nombreCompleto, p.correo, p.telefono, p.objetivo]
        .join(' ')
        .toLowerCase()
        .includes(t)
    );
  }, [pacientes, busqueda]);

  const mostrarAviso = (texto) => {
    setAviso(texto);
    setTimeout(() => setAviso(''), 3000);
  };

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (erroresCampo[e.target.name]) setErroresCampo({ ...erroresCampo, [e.target.name]: '' });
  };

  const limpiar = () => {
    setForm(VACIO);
    setEditandoId(null);
    setErrorForm('');
    setErroresCampo({});
  };

  /* El formulario de registro y edición vive en una ventana modal */
  const abrirRegistro = () => {
    limpiar();
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    limpiar();
  };

  const editar = (p) => {
    setForm(aFormulario(p));
    setEditandoId(p.id);
    setErrorForm('');
    setErroresCampo({});
    setModalAbierto(true);
  };

  const enviar = async (e) => {
    e.preventDefault();
    const datos = {
      ...form,
      peso: form.peso === '' ? '' : Number(form.peso),
      estatura: form.estatura === '' ? '' : Number(form.estatura),
    };
    // Al registrar, no se envían los opcionales vacíos; al editar, el responsable se gestiona en el expediente
    if (!editandoId) {
      ['sexo', 'peso', 'estatura', 'fechaNacimiento', 'responsableId', 'motivoConsulta'].forEach((k) => datos[k] === '' && delete datos[k]);
    } else {
      delete datos.responsableId;
      delete datos.motivoConsulta;
    }

    setGuardando(true);
    setErrorForm('');
    setErroresCampo({});
    try {
      if (editandoId) {
        await actualizarPaciente(editandoId, datos);
        mostrarAviso('Paciente actualizado');
      } else {
        await agregarPaciente(datos);
        mostrarAviso('Paciente registrado');
      }
      cerrarModal(); // la tabla y los KPI se actualizan desde el contexto, sin recargar
    } catch (error) {
      setErrorForm(error.message);
      setErroresCampo(error.errores || {});
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (p) => {
    if (!window.confirm(`¿Eliminar a ${nombreCompleto(p)}? Esta acción no se puede deshacer.`)) return;
    setAvisoError('');
    try {
      await eliminarPaciente(p.id);
      if (editandoId === p.id) cerrarModal();
      mostrarAviso('Paciente eliminado');
    } catch (error) {
      setAvisoError(error.message); // p. ej. 409: tiene información clínica → usar "baja"
    }
  };

  /* Último peso conocido: la medición más reciente o el peso registrado */
  const ultimoPeso = (p) => ultimasMediciones[p.id]?.ultimoPeso?.kg ?? p.peso;
  const totalMediciones = Object.values(ultimasMediciones).reduce((t, m) => t + m.total, 0);

  const activos = pacientes.filter((p) => p.estado === 'activo').length;
  const conDieta = pacientes.filter((p) => p.dietaId).length;

  const error = (campo) =>
    erroresCampo[campo] ? <small style={{ color: '#f3b9b0' }}>{erroresCampo[campo]}</small> : null;

  let cuerpoTabla;
  if (cargandoPacientes) {
    cuerpoTabla = <tr><td colSpan="6" className="vacio">Cargando pacientes…</td></tr>;
  } else if (errorPacientes && pacientes.length === 0) {
    cuerpoTabla = (
      <tr>
        <td colSpan="6" className="vacio">
          {errorPacientes}{' '}
          <button className="boton boton--secundario boton--chico" onClick={recargarPacientes}>
            <FiRefreshCw /> Reintentar
          </button>
        </td>
      </tr>
    );
  } else if (filtrados.length === 0) {
    cuerpoTabla = (
      <tr>
        <td colSpan="6" className="vacio">
          {pacientes.length ? 'No hay pacientes que coincidan.' : 'Aún no hay pacientes registrados.'}
        </td>
      </tr>
    );
  } else {
    cuerpoTabla = filtrados.map((p) => {
      const imc = calcularIMC(ultimoPeso(p), p.estatura);
      const clase = clasificarIMC(imc);
      const dieta = buscarDieta(p.dietaId);
      const resumen = dieta ? resumenCumplimiento(cumplimiento, p.id, dieta) : null;
      return (
        <tr key={p.id} className={editandoId === p.id ? 'fila--seleccionada' : ''}>
          <td>
            <div className="empleado-info">
              <div className="empleado-avatar">{iniciales(p)}</div>
              <div>
                <div>{nombreCompleto(p)}</div>
                <small style={{ color: 'var(--color-texto-suave)', fontWeight: 400 }}>
                  {p.correo} · {p.telefono}
                </small>
              </div>
            </div>
          </td>
          <td>{p.edadActual ?? p.edad ?? '—'}</td>
          <td>
            {imc ?? '—'}{' '}
            {imc && <span className={`insignia insignia--${clase.tono}`}>{clase.texto}</span>}
          </td>
          <td>
            <div>{p.objetivo}</div>
            <small style={{ color: 'var(--color-texto-suave)' }}>
              {clinico && (dieta ? dieta.nombre : 'Sin dieta')}
              {resumen?.porcentaje != null && ` · ${resumen.porcentaje}% cumplimiento`}
            </small>
          </td>
          <td>
            <span className={`insignia insignia--${p.estado === 'activo' ? 'ok' : 'no'}`}>
              {ESTADOS_PACIENTE[p.estado] || p.estado}
            </span>
            <div><small style={{ color: 'var(--color-texto-suave)' }}>{formatoFecha(p.fechaRegistro?.slice(0, 10))}</small></div>
          </td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <Link className="boton boton--secundario boton--chico" to={`/pacientes/${p.id}`} title="Abrir expediente" aria-label={`Abrir expediente de ${nombreCompleto(p)}`} hidden={!clinico}>
              <FiTrendingUp />
            </Link>{' '}
            <Link className="boton boton--secundario boton--chico" to={`/pacientes/${p.id}/antropometria`} title="Antropometría" aria-label="Antropometría" hidden={!clinico}>
              <FiActivity />
            </Link>{' '}
            <Link className="boton boton--secundario boton--chico" to={`/cumplimiento?paciente=${p.id}`} title="Cumplimiento" aria-label="Cumplimiento" hidden={!clinico}>
              <FiCheckSquare />
            </Link>{' '}
            <button className="boton boton--secundario boton--chico" onClick={() => editar(p)} title="Editar" aria-label={`Editar a ${nombreCompleto(p)}`}>
              <FiEdit2 />
            </button>{' '}
            {puede('pacientes:eliminar') && (
              <button className="boton boton--peligro boton--chico" onClick={() => borrar(p)} title="Eliminar" aria-label={`Eliminar a ${nombreCompleto(p)}`}>
                <FiTrash2 />
              </button>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <Layout titulo="Pacientes">
      <div className="rejilla-kpi">
        <div className="kpi"><span>Registrados</span><strong>{pacientes.length}</strong></div>
        <div className="kpi"><span>Activos</span><strong>{activos}</strong></div>
        <div className="kpi"><span>Con dieta asignada</span><strong>{conDieta}</strong></div>
        <div className="kpi"><span>Mediciones</span><strong>{totalMediciones}</strong></div>
      </div>

      {/* EXPEDIENTES: ocupa todo el ancho; el registro se abre en una ventana modal */}
      <section className="panel pacientes-expedientes">
          <div className="panel-encabezado">
            <div>
              <h2>Expedientes</h2>
              <p className="panel-descripcion">
                {filtrados.length} de {pacientes.length} pacientes
              </p>
            </div>
            <div className="pacientes-expedientes__herramientas">
              <div className="buscador-empleados">
                <FiSearch size={18} />
                <input
                  type="text"
                  placeholder="Buscar paciente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  aria-label="Buscar paciente"
                />
              </div>
              <button type="button" className="boton boton--primario" onClick={abrirRegistro} aria-haspopup="dialog">
                <FiUserPlus /> Registrar paciente
              </button>
            </div>
          </div>

          {aviso && <p className="aviso aviso--ok" role="status" style={{ marginTop: 0, marginBottom: 'var(--esp-md)' }}>{aviso}</p>}
          {avisoError && <p className="aviso aviso--error" role="alert" style={{ marginBottom: 'var(--esp-md)' }}>{avisoError}</p>}

          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Edad</th>
                  <th>IMC</th>
                  <th>Objetivo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{cuerpoTabla}</tbody>
            </table>
          </div>
      </section>

      {/* REGISTRO / EDICIÓN en ventana modal (no se cierra con un clic accidental en el fondo) */}
      <Modal
        abierto={modalAbierto}
        titulo={editandoId ? 'Editar paciente' : 'Registrar paciente'}
        descripcion="Los campos con * son obligatorios."
        onCerrar={cerrarModal}
        cerrarAlFondo={false}
        ancho={720}
      >
          <form className="formulario" onSubmit={enviar}>
            <div className="campo campo--completo">
              <label htmlFor="nombreCompleto">Nombre completo *</label>
              <input id="nombreCompleto" name="nombreCompleto" value={form.nombreCompleto} onChange={cambiar} required minLength={3} maxLength={120} />
              {error('nombreCompleto')}
            </div>
            <div className="campo">
              <label htmlFor="fechaNacimiento">Fecha de nacimiento *</label>
              <input id="fechaNacimiento" type="date" name="fechaNacimiento" value={form.fechaNacimiento} onChange={cambiar}
                max={new Date().toISOString().slice(0, 10)} required={!editandoId || !!form.fechaNacimiento} />
              <span className="campo__ayuda">La edad se calcula automáticamente.</span>
              {error('fechaNacimiento')}
            </div>
            {!editandoId && usuario?.rol !== 'nutriologo' && (
              <div className="campo">
                <label htmlFor="responsableId">Profesional responsable *</label>
                <select id="responsableId" name="responsableId" value={form.responsableId} onChange={cambiar} required>
                  <option value="">Elegir…</option>
                  {profesionales.map((x) => <option key={x._id} value={x._id}>{x.nombre}</option>)}
                </select>
                {error('responsableId')}
              </div>
            )}
            {!editandoId && (
              <div className="campo campo--completo">
                <label htmlFor="motivoConsulta">Motivo de consulta</label>
                <input id="motivoConsulta" name="motivoConsulta" value={form.motivoConsulta} onChange={cambiar} maxLength={1000} />
              </div>
            )}
            <div className="campo">
              <label htmlFor="sexo">Sexo</label>
              <select id="sexo" name="sexo" value={form.sexo} onChange={cambiar}>
                <option value="">Sin especificar</option>
                <option>Femenino</option>
                <option>Masculino</option>
                <option>Otro</option>
              </select>
              {error('sexo')}
            </div>
            <div className="campo">
              <label htmlFor="correo">Correo electrónico *</label>
              <input id="correo" type="email" name="correo" value={form.correo} onChange={cambiar} required />
              {error('correo')}
            </div>
            <div className="campo">
              <label htmlFor="telefono">Teléfono *</label>
              <input id="telefono" type="tel" name="telefono" value={form.telefono} onChange={cambiar} required pattern="[0-9 \(\)+\-]{7,20}" title="7 a 20 caracteres: números, espacios, +, ( ) o -" />
              {error('telefono')}
            </div>
            <div className="campo campo--completo">
              <label htmlFor="objetivo">Objetivo nutricional *</label>
              <input id="objetivo" list="lista-objetivos" name="objetivo" value={form.objetivo} onChange={cambiar} placeholder="Ej. Reducción de peso" required maxLength={200} />
              <datalist id="lista-objetivos">
                {OBJETIVOS.map((o) => <option key={o} value={o} />)}
              </datalist>
              {error('objetivo')}
            </div>
            {clinico && (<>
            <div className="campo">
              <label htmlFor="peso">Peso (kg)</label>
              <input id="peso" type="number" min="1" max="400" step="0.1" name="peso" value={form.peso} onChange={cambiar} />
              {error('peso')}
            </div>
            <div className="campo">
              <label htmlFor="estatura">Estatura (cm)</label>
              <input id="estatura" type="number" min="30" max="250" step="0.1" name="estatura" value={form.estatura} onChange={cambiar} />
              {error('estatura')}
            </div>
            </>)}
            <div className="campo">
              <label htmlFor="estado">Estado</label>
              <select id="estado" name="estado" value={form.estado} onChange={cambiar}>
                <option value="activo">Activo</option>
                <option value="baja">Baja</option>
              </select>
              {error('estado')}
            </div>
            {clinico && (
            <div className="campo">
              <label htmlFor="dietaId">Dieta asignada</label>
              <select id="dietaId" name="dietaId" value={form.dietaId} onChange={cambiar}>
                <option value="">Sin asignar</option>
                {dietas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                {form.dietaId && !buscarDieta(form.dietaId) && <option value={form.dietaId}>{form.dietaId} (archivada)</option>}
              </select>
            </div>
            )}

            {errorForm && (
              <p className="aviso aviso--error campo--completo" role="alert">
                {errorForm}
              </p>
            )}

            <div className="formulario-acciones">
              <button type="button" className="boton boton--secundario" onClick={cerrarModal} disabled={guardando}>Cancelar</button>
              <button type="submit" className="boton boton--primario" disabled={guardando}>
                <FiUserPlus /> {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar paciente'}
              </button>
            </div>
          </form>
      </Modal>
    </Layout>
  );
}

export default Pacientes;
