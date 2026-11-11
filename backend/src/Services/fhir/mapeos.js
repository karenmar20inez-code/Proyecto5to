/**
 * Mapeo de solo lectura a HL7 FHIR R4. Prepara la interoperabilidad sin cambiar
 * el modelo interno. Los códigos LOINC deben validarse antes de un intercambio
 * real con otra institución (NOM-024-SSA3-2012 / catálogos DGIS).
 */
const { ANALITOS } = require('../clinica/analitos');

const LOINC = 'http://loinc.org';
const UCUM = 'http://unitsofmeasure.org';

const MEDICIONES_LOINC = {
  pesoKg: { code: '29463-7', display: 'Body weight', unit: 'kg' },
  estaturaCm: { code: '8302-2', display: 'Body height', unit: 'cm' },
  cinturaCm: { code: '8280-0', display: 'Waist Circumference at umbilicus by Tape measure', unit: 'cm' },
  grasaPorcentaje: { code: '41982-0', display: 'Percentage of body fat Measured', unit: '%' },
  presionSistolica: { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]' },
  presionDiastolica: { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mm[Hg]' },
};

const GENERO = { Femenino: 'female', Masculino: 'male', Otro: 'other' };

function paciente(p, expediente) {
  return {
    resourceType: 'Patient',
    id: String(p._id),
    identifier: [
      expediente && { system: 'urn:lanutria:expediente', value: expediente.folio },
      p.curp && { system: 'urn:lanutria:curp', value: p.curp },
    ].filter(Boolean),
    active: p.estado === 'activo',
    name: [{ text: p.nombreCompleto }],
    gender: GENERO[p.sexo] || 'unknown',
    birthDate: p.fechaNacimiento ? new Date(p.fechaNacimiento).toISOString().slice(0, 10) : undefined,
    telecom: [
      p.correo && { system: 'email', value: p.correo },
      p.telefono && { system: 'phone', value: p.telefono },
    ].filter(Boolean),
  };
}

const cantidad = (valor, unidad) => ({ value: valor, unit: unidad, system: UCUM, code: unidad });

function observacionesDeMedicion(m) {
  return Object.entries(MEDICIONES_LOINC).filter(([campo]) => m[campo] != null).map(([campo, c]) => ({
    resourceType: 'Observation',
    id: `${m._id}-${campo}`,
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
    code: { coding: [{ system: LOINC, code: c.code, display: c.display }] },
    subject: { reference: `Patient/${m.pacienteId}` },
    effectiveDateTime: new Date(m.fecha).toISOString(),
    valueQuantity: cantidad(m[campo], c.unit),
  }));
}

function observacionLaboratorio(r) {
  const a = ANALITOS[r.analito];
  return {
    resourceType: 'Observation',
    id: String(r._id),
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
    code: { coding: a?.loinc ? [{ system: LOINC, code: a.loinc, display: a.nombre }] : [], text: r.nombre },
    subject: { reference: `Patient/${r.pacienteId}` },
    effectiveDateTime: new Date(r.fechaMuestra).toISOString(),
    valueQuantity: cantidad(r.valor, r.unidad),
    referenceRange: (r.rangoReferencia?.min != null || r.rangoReferencia?.max != null) ? [{
      low: r.rangoReferencia.min != null ? cantidad(r.rangoReferencia.min, r.unidad) : undefined,
      high: r.rangoReferencia.max != null ? cantidad(r.rangoReferencia.max, r.unidad) : undefined,
      text: r.rangoReferencia.texto,
    }] : undefined,
    performer: [{ display: r.procedencia }],
  };
}

const bundle = (recursos) => ({
  resourceType: 'Bundle', type: 'searchset', total: recursos.length,
  entry: recursos.map((resource) => ({ resource })),
});

module.exports = { paciente, observacionesDeMedicion, observacionLaboratorio, bundle, MEDICIONES_LOINC };
