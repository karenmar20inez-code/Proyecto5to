import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNutri, nombreCompleto } from '../../context/NutriContext';

/* Paciente seleccionado compartido entre módulos mediante ?paciente=ID */
export function usePacienteSeleccionado() {
  const { pacientes } = useNutri();
  const [params, setParams] = useSearchParams();
  const id = params.get('paciente');
  const paciente = pacientes.find((p) => p.id === id) || null;

  useEffect(() => {
    if (!paciente && pacientes.length) {
      setParams({ paciente: pacientes[0].id }, { replace: true });
    }
  }, [paciente, pacientes, setParams]);

  const seleccionar = (nuevoId) => setParams(nuevoId ? { paciente: nuevoId } : {});

  return [paciente, seleccionar];
}

function SelectorPaciente({ paciente, onCambio }) {
  const { pacientes } = useNutri();

  return (
    <div className="selector-paciente">
      <label htmlFor="selector-paciente">Paciente</label>
      <select
        id="selector-paciente"
        className="selector"
        value={paciente?.id || ''}
        onChange={(e) => onCambio(e.target.value)}
      >
        {pacientes.length === 0 && <option value="">Sin pacientes</option>}
        {pacientes.map((p) => (
          <option key={p.id} value={p.id}>
            {nombreCompleto(p)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SelectorPaciente;
