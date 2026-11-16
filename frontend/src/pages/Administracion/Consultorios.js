import { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Power } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import TablaDatos from '../../components/ui/TablaDatos';
import { consultoriosApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const VACIO = { nombre: '', direccion: '', telefono: '', correo: '' };

/** Consultorios u organizaciones: ámbito del personal (alta y cambios solo con consultorios:gestionar) */
function Consultorios() {
  const { puede } = useAuth();
  const gestiona = puede('consultorios:gestionar');
  const [lista, setLista] = useState(null);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const cargar = useCallback(() => consultoriosApi.listar().then(setLista).catch((e) => { setError(e.message); setLista([]); }), []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setErrorForm('');
    const { _id, nombre, direccion, telefono, correo } = editando;
    try {
      if (_id) await consultoriosApi.actualizar(_id, { nombre, direccion, telefono, correo });
      else await consultoriosApi.crear({ nombre, direccion, telefono, correo });
      setEditando(null);
      cargar();
    } catch (err) { setErrorForm(err.message); }
  };

  const alternar = async (c) => {
    if (!window.confirm(`¿${c.activo ? 'Desactivar' : 'Activar'} ${c.nombre}?${c.activo ? ' No se podrá asignar a nuevas cuentas; el personal y los pacientes actuales se conservan.' : ''}`)) return;
    try { await consultoriosApi.actualizar(c._id, { activo: !c.activo }); cargar(); } catch (err) { setError(err.message); }
  };

  const columnas = [
    { clave: 'nombre', titulo: 'Consultorio', render: (c) => <span className="celda-fuerte">{c.nombre}</span> },
    { clave: 'direccion', titulo: 'Dirección', valor: (c) => c.direccion || '—' },
    { clave: 'telefono', titulo: 'Teléfono', valor: (c) => c.telefono || '—' },
    { clave: 'totalPersonal', titulo: 'Personal', numerica: true },
    { clave: 'totalPacientes', titulo: 'Pacientes', numerica: true },
    { clave: 'activo', titulo: 'Estado', valor: (c) => (c.activo ? 'Activo' : 'Inactivo'), render: (c) => <span className={`insignia insignia--${c.activo ? 'ok' : 'no'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span> },
    {
      clave: 'acciones', titulo: '', ordenable: false, render: (c) => (gestiona ? (
        <span className="tabla-acciones">
          <button className="boton boton--secundario boton--chico" title="Editar" aria-label={`Editar ${c.nombre}`}
            onClick={() => { setErrorForm(''); setEditando({ ...VACIO, ...c }); }}><Pencil aria-hidden="true" /></button>
          <button className={`boton boton--${c.activo ? 'peligro' : 'secundario'} boton--chico`} title={c.activo ? 'Desactivar' : 'Activar'}
            aria-label={`${c.activo ? 'Desactivar' : 'Activar'} ${c.nombre}`} onClick={() => alternar(c)}><Power aria-hidden="true" /></button>
        </span>
      ) : null),
    },
  ];

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Consultorios</h2>
          <p className="panel-descripcion">El personal ligado a un consultorio solo ve y gestiona las cuentas y pacientes de ese consultorio. Sin consultorio se conserva el ámbito general.</p>
        </div>
        {gestiona && (
          <button className="boton boton--primario" onClick={() => { setErrorForm(''); setEditando({ ...VACIO }); }}>
            <Building2 aria-hidden="true" /> Nuevo consultorio
          </button>
        )}
      </div>
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <TablaDatos columnas={columnas} filas={lista || []} cargando={!lista} etiqueta="Consultorios" vacio="Aún no hay consultorios registrados." />

      <Modal abierto={!!editando} titulo={editando?._id ? `Editar ${editando.nombre}` : 'Nuevo consultorio'} onCerrar={() => setEditando(null)} cerrarAlFondo={false}>
        {editando && (
          <form className="formulario" onSubmit={guardar}>
            <div className="campo campo--completo"><label htmlFor="c-nombre">Nombre *</label>
              <input id="c-nombre" value={editando.nombre} required minLength={3} maxLength={120} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></div>
            <div className="campo campo--completo"><label htmlFor="c-dir">Dirección</label>
              <input id="c-dir" value={editando.direccion || ''} maxLength={250} onChange={(e) => setEditando({ ...editando, direccion: e.target.value })} /></div>
            <div className="campo"><label htmlFor="c-tel">Teléfono</label>
              <input id="c-tel" type="tel" value={editando.telefono || ''} pattern="[0-9 \(\)+\-]{7,20}" onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} /></div>
            <div className="campo"><label htmlFor="c-correo">Correo</label>
              <input id="c-correo" type="email" value={editando.correo || ''} onChange={(e) => setEditando({ ...editando, correo: e.target.value })} /></div>
            {errorForm && <p className="aviso aviso--error campo--completo" role="alert">{errorForm}</p>}
            <div className="formulario-acciones">
              <button type="button" className="boton boton--secundario" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit" className="boton boton--primario">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

export default Consultorios;
