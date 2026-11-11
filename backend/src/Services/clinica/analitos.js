/**
 * Catálogo interno de analitos frecuentes en nutrición clínica.
 * Solo define nombre, unidad habitual y código LOINC (para FHIR).
 * NO define rangos de referencia: cada resultado usa el rango impreso por su laboratorio.
 * `campoMedicion` permite migrar los valores que antes se capturaban en Medicion.
 */
const ANALITOS = {
  glucosa_ayuno: { nombre: 'Glucosa en ayuno', unidad: 'mg/dL', loinc: '1558-6', campoMedicion: 'glucosaMgDl' },
  hba1c: { nombre: 'Hemoglobina glucosilada (HbA1c)', unidad: '%', loinc: '4548-4', campoMedicion: 'hba1cPct' },
  insulina: { nombre: 'Insulina', unidad: 'µUI/mL', loinc: '20448-7' },
  colesterol_total: { nombre: 'Colesterol total', unidad: 'mg/dL', loinc: '2093-3', campoMedicion: 'colesterolTotalMgDl' },
  hdl: { nombre: 'Colesterol HDL', unidad: 'mg/dL', loinc: '2085-9', campoMedicion: 'hdlMgDl' },
  ldl: { nombre: 'Colesterol LDL', unidad: 'mg/dL', loinc: '13457-7', campoMedicion: 'ldlMgDl' },
  trigliceridos: { nombre: 'Triglicéridos', unidad: 'mg/dL', loinc: '2571-8', campoMedicion: 'trigliceridosMgDl' },
  creatinina: { nombre: 'Creatinina', unidad: 'mg/dL', loinc: '2160-0' },
  urea: { nombre: 'Urea', unidad: 'mg/dL', loinc: '3091-6' },
  acido_urico: { nombre: 'Ácido úrico', unidad: 'mg/dL', loinc: '3084-1' },
  albumina: { nombre: 'Albúmina', unidad: 'g/dL', loinc: '1751-7' },
  hemoglobina: { nombre: 'Hemoglobina', unidad: 'g/dL', loinc: '718-7' },
  ferritina: { nombre: 'Ferritina', unidad: 'ng/mL', loinc: '2276-4' },
  vitamina_d: { nombre: 'Vitamina D (25-OH)', unidad: 'ng/mL', loinc: '1989-3' },
  vitamina_b12: { nombre: 'Vitamina B12', unidad: 'pg/mL', loinc: '2132-9' },
  tsh: { nombre: 'TSH', unidad: 'µUI/mL', loinc: '3016-3' },
  pcr: { nombre: 'Proteína C reactiva', unidad: 'mg/L', loinc: '1988-5' },
  alt: { nombre: 'ALT (TGP)', unidad: 'U/L', loinc: '1742-6' },
  ast: { nombre: 'AST (TGO)', unidad: 'U/L', loinc: '1920-8' },
  sodio: { nombre: 'Sodio', unidad: 'mmol/L', loinc: '2951-2' },
  potasio: { nombre: 'Potasio', unidad: 'mmol/L', loinc: '2823-3' },
  otro: { nombre: 'Otro (especificar)', unidad: '', loinc: null },
};

module.exports = { ANALITOS };
