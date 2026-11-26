/**
 * GENERADOR DE PLANES ALIMENTARIOS PERSONALIZADOS (funciones puras, sin base de datos)
 *
 * Flujo: datosFaltantes → construirPerfil → generarPlan (filtro estricto + azar controlado + porciones)
 *        → validarPlan (verificación independiente). Nada de esto sustituye la revisión profesional:
 *        todo plan generado queda en borrador hasta que un nutriólogo lo aprueba.
 *
 * Reglas de seguridad:
 *  - El filtro de restricciones (alergias, intolerancias, rechazos, tipo de alimentación, restricciones
 *    culturales/religiosas y contraindicaciones por diagnóstico) se aplica ANTES del azar: el azar solo
 *    elige entre platillos permitidos. validarPlan vuelve a comprobar cada platillo del plan ya armado.
 *  - Si no hay combinación posible, se explica el motivo; nunca se relaja una restricción.
 *  - Coincidencia por etiquetas del catálogo Y por texto de ingredientes (conservadora: puede excluir
 *    de más, nunca de menos respecto a los términos registrados).
 */

/* kcal promedio por equivalente (Sistema Mexicano de Alimentos Equivalentes, valores de referencia).
   Los platillos guardan equivalentes; las kcal se calculan aquí para que sean consistentes. */
const KCAL_EQUIVALENTE = {
  cereales: 70, verduras: 25, frutas: 60, leguminosas: 120, aoa: 55,
  lacteos: 95, grasas: 45, grasasProteina: 70, azucares: 40,
};
const GRUPOS = Object.keys(KCAL_EQUIVALENTE);

const TIEMPOS = { desayuno: 'Desayuno', colacion: 'Colación', comida: 'Comida', cena: 'Cena' };
/* Distribución de la energía del día según el número de comidas */
const DISTRIBUCION = {
  3: [['desayuno', 0.30], ['comida', 0.40], ['cena', 0.30]],
  4: [['desayuno', 0.25], ['colacion', 0.10], ['comida', 0.40], ['cena', 0.25]],
  5: [['desayuno', 0.25], ['colacion', 0.10], ['comida', 0.35], ['colacion', 0.10], ['cena', 0.20]],
};
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const TIPOS_ALIMENTACION = { omnivora: 'Omnívora', vegetariana: 'Vegetariana', vegana: 'Vegana', pescetariana: 'Pescetariana' };
const RESTRICCIONES = {
  'sin-cerdo': 'Sin cerdo', 'sin-res': 'Sin carne de res', 'sin-alcohol': 'Sin alcohol',
  halal: 'Halal (sin cerdo ni alcohol)', kosher: 'Kosher (sin cerdo ni mariscos; sin mezclar carne y lácteos)',
};
const ALERGENOS = {
  gluten: 'Gluten', lacteos: 'Lácteos', huevo: 'Huevo', cacahuate: 'Cacahuate', 'frutos-secos': 'Frutos secos',
  soya: 'Soya', pescado: 'Pescado', mariscos: 'Mariscos', ajonjoli: 'Ajonjolí',
};
/* Términos (sin acentos) que identifican cada alérgeno en el texto de una alergia/intolerancia */
const TERMINOS_ALERGENO = {
  gluten: ['gluten', 'trigo', 'celiac', 'cebada', 'centeno'],
  lacteos: ['lacteo', 'leche', 'lactosa', 'queso', 'yogur', 'crema', 'mantequilla', 'caseina'],
  huevo: ['huevo', 'clara', 'yema', 'albumina'],
  cacahuate: ['cacahuate', 'mani'],
  'frutos-secos': ['nuez', 'nueces', 'almendra', 'avellana', 'pistache', 'anacardo', 'maranon', 'frutos secos', 'coco'],
  soya: ['soya', 'soja', 'tofu', 'edamame'],
  pescado: ['pescado', 'atun', 'salmon', 'tilapia', 'bacalao', 'sardina'],
  mariscos: ['marisco', 'camaron', 'crustaceo', 'molusco', 'pulpo', 'calamar', 'almeja', 'ostion', 'langosta', 'cangrejo'],
  ajonjoli: ['ajonjoli', 'sesamo', 'tahini'],
};
const CARNES = ['pollo', 'pavo', 'res', 'cerdo'];
const PALABRAS_VACIAS = new Set(['alergia', 'alergias', 'alergico', 'alergica', 'intolerancia', 'intolerante', 'para', 'por', 'con', 'sin', 'leve', 'severa', 'grave', 'moderada', 'alimentos', 'alimento', 'todos', 'todas', 'los', 'las', 'del', 'que', 'muy', 'poco', 'tipo', 'una', 'uno', 'mas', 'menos', 'come', 'como', 'algo', 'nada', 'ninguna', 'ninguno', 'tiene', 'tengo']);

const MAX_REPETICIONES_SEMANA = 2;
const TOLERANCIA_KCAL = 0.10;
const PORCION_MIN = 0.5;
const PORCION_MAX = 2.5;

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const terminosDe = (texto) => normalizar(texto).split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 3 && !PALABRAS_VACIAS.has(p));
/** Formas a buscar de un término: tal cual y en singular (fresas→fresa, limones→limon, aguacates→aguacate) */
const variantes = (t) => {
  const v = new Set([t]);
  if (t.length > 4 && t.endsWith('es')) v.add(t.slice(0, -2));
  if (t.length > 3 && t.endsWith('s')) v.add(t.slice(0, -1));
  return [...v].filter((x) => x.length >= 3);
};
const coincide = (texto, termino) => variantes(termino).some((v) => texto.includes(v));
const redondearPorcion = (x) => Math.min(PORCION_MAX, Math.max(PORCION_MIN, Math.round(x * 4) / 4));

/** Texto completo del platillo para coincidencias (nombre + ingredientes) */
const textoPlatillo = (p) => normalizar([p.nombre, ...(p.ingredientes || []).map((i) => i.alimento)].join(' '));

/** kcal de un platillo (porción 1) a partir de sus equivalentes */
function kcalPlatillo(platillo) {
  return Math.round(GRUPOS.reduce((t, g) => t + (Number(platillo.equivalentes?.[g]) || 0) * KCAL_EQUIVALENTE[g], 0));
}

/* Ingredientes de origen animal reconocibles en el texto (por si un platillo nuevo no está bien etiquetado) */
const TEXTO_ANIMAL = [
  ['pollo', /\bpollo|\bpechuga|\bmuslo/], ['pavo', /\bpavo/], ['res', /\bres\b|\bbistec|\bcarne molida|\bfajitas? de res|\bsirloin/],
  ['cerdo', /\bcerdo|\bjamon|\btocino|\bchorizo|\bsalchicha|\bcochinita|\bchicharron|\bcarnitas|\blomo de cerdo/],
  ['pescado', /\bpescado|\batun|\bsalmon|\btilapia|\bsardina|\bbacalao/],
  ['mariscos', /\bcamaron|\bmarisco|\bpulpo|\bcalamar|\bostion|\bjaiba|\bcangrejo/],
  ['huevo', /\bhuevo|\bclaras? de huevo/],
  ['lacteos', /\bleche(?! de (soya|almendra|coco|arroz|avena))|\bqueso|\byogur|\bcrema(?! de cacahuate)|\bmantequilla|\bjocoque/],
  ['miel', /\bmiel\b/],
];
const PROTEINA_CONTIENE = { pollo: 'pollo', res: 'res', cerdo: 'cerdo', pescado: 'pescado', mariscos: 'mariscos', huevo: 'huevo', lacteo: 'lacteos' };

/** Clasificación derivada (no se captura a mano): etiquetas + proteína declarada + texto de ingredientes */
function clasificar(platillo) {
  const contiene = new Set([...(platillo.contiene || []), ...(platillo.alergenos || [])]);
  if (PROTEINA_CONTIENE[platillo.proteina]) contiene.add(PROTEINA_CONTIENE[platillo.proteina]);
  const texto = textoPlatillo(platillo);
  TEXTO_ANIMAL.forEach(([clave, patron]) => { if (patron.test(texto)) contiene.add(clave); });
  const conCarne = CARNES.some((c) => contiene.has(c));
  const conMar = contiene.has('pescado') || contiene.has('mariscos');
  const vegetariano = !conCarne && !conMar;
  const vegano = vegetariano && !contiene.has('huevo') && !contiene.has('lacteos') && !contiene.has('miel');
  return { vegetariano, vegano, pescetariano: !conCarne, conCarne, contiene };
}


/**
 * Perfil del generador a partir de los datos clínicos y las preferencias.
 * @param {object} datos { kcal, preferencias, alergias: [{descripcion, categoria}], diagnosticos: [{texto, codigo}] }
 */
function construirPerfil({ kcal, preferencias = {}, alergias = [], diagnosticos = [] }) {
  const alergenos = new Set();
  const terminosRestringidos = new Set();
  const motivosAlergia = [];
  alergias.forEach((a) => {
    const texto = normalizar(a.descripcion);
    Object.entries(TERMINOS_ALERGENO).forEach(([clave, terminos]) => {
      if (terminos.some((t) => texto.includes(t))) alergenos.add(clave);
    });
    terminosDe(a.descripcion).forEach((t) => terminosRestringidos.add(t));
    motivosAlergia.push(`${a.categoria === 'intolerancia' ? 'Intolerancia' : 'Alergia'}: ${a.descripcion}`);
  });

  const restricciones = new Set(preferencias.restricciones || []);
  const excluirContiene = new Set();
  if (restricciones.has('sin-cerdo') || restricciones.has('halal') || restricciones.has('kosher')) excluirContiene.add('cerdo');
  if (restricciones.has('sin-res')) excluirContiene.add('res');
  if (restricciones.has('sin-alcohol') || restricciones.has('halal')) excluirContiene.add('alcohol');
  if (restricciones.has('kosher')) excluirContiene.add('mariscos');

  const excluirEtiquetas = new Set();
  const advertencias = [];
  diagnosticos.forEach((d) => {
    const texto = normalizar(`${d.texto || ''} ${d.codigo || ''}`);
    if (/diabet|e1[0-4]/.test(texto)) excluirEtiquetas.add('azucar-anadida');
    if (/hipertens|i1[0-5]/.test(texto)) excluirEtiquetas.add('alto-sodio');
    if (/celiac|k90/.test(texto)) alergenos.add('gluten');
    if (/renal|n18/.test(texto)) advertencias.push('Enfermedad renal registrada: la proteína, el potasio y el fósforo requieren ajuste individual del profesional.');
  });
  if (restricciones.has('halal')) advertencias.push('Halal: verifica que la carne tenga certificación; el generador solo excluye cerdo y alcohol.');
  if (restricciones.has('kosher')) advertencias.push('Kosher: verifica la certificación de los productos; el generador excluye cerdo y mariscos y no mezcla carne con lácteos en un platillo.');

  return {
    kcal: Number(kcal),
    numeroComidas: Number(preferencias.numeroComidas),
    tipoAlimentacion: preferencias.tipoAlimentacion,
    restricciones: [...restricciones],
    kosher: restricciones.has('kosher'),
    alergenos: [...alergenos],
    terminosRestringidos: [...terminosRestringidos],
    rechazos: (preferencias.rechazos || []).map(normalizar).filter(Boolean),
    gustos: (preferencias.gustos || []).map(normalizar).filter(Boolean),
    preparacion: preferencias.preparacion || [],
    excluirContiene: [...excluirContiene],
    excluirEtiquetas: [...excluirEtiquetas],
    motivosAlergia,
    advertencias,
  };
}

/**
 * Datos mínimos para generar un plan seguro. Devuelve la lista de lo que falta (vacía = se puede generar).
 * @param {object} c { kcal, preferencias, alergiasRegistradas: boolean (hay alergias activas o negación explícita) }
 */
function datosFaltantes({ kcal, preferencias, alergiasRegistradas }) {
  const faltan = [];
  if (!alergiasRegistradas) {
    faltan.push({ campo: 'alergias', mensaje: 'Registrar alergias e intolerancias alimentarias (o indicar explícitamente que no tiene).' });
  }
  if (!(Number(kcal) >= 800 && Number(kcal) <= 6000)) {
    faltan.push({ campo: 'requerimiento', mensaje: 'Definir el requerimiento de energía (kcal/día) en una prescripción o plan vigente.' });
  }
  if (!preferencias || !TIPOS_ALIMENTACION[preferencias.tipoAlimentacion]) {
    faltan.push({ campo: 'tipoAlimentacion', mensaje: 'Indicar el tipo de alimentación (omnívora, vegetariana, vegana o pescetariana).' });
  }
  if (!preferencias || !DISTRIBUCION[preferencias.numeroComidas]) {
    faltan.push({ campo: 'numeroComidas', mensaje: 'Indicar cuántas comidas hace al día (3, 4 o 5).' });
  }
  return faltan;
}

/** Motivo por el que un platillo NO es apto para el perfil (null = apto). Filtro estricto. */
function motivoExclusion(platillo, perfil) {
  const c = clasificar(platillo);
  const texto = textoPlatillo(platillo);
  const alergeno = (platillo.alergenos || []).find((a) => perfil.alergenos.includes(a));
  if (alergeno) return `Contiene ${ALERGENOS[alergeno] || alergeno} (alergia/intolerancia registrada)`;
  const termino = perfil.terminosRestringidos.find((t) => coincide(texto, t));
  if (termino) return `Ingrediente relacionado con una alergia/intolerancia registrada («${termino}»)`;
  const rechazo = perfil.rechazos.find((r) => coincide(texto, r));
  if (rechazo) return `Contiene «${rechazo}», que el paciente no quiere comer`;
  if (perfil.tipoAlimentacion === 'vegana' && !c.vegano) return 'No es vegano';
  if (perfil.tipoAlimentacion === 'vegetariana' && !c.vegetariano) return 'No es vegetariano';
  if (perfil.tipoAlimentacion === 'pescetariana' && !c.pescetariano) return 'Contiene carne (pescetariana)';
  const prohibido = perfil.excluirContiene.find((x) => c.contiene.has(x));
  if (prohibido) return `Restricción cultural/religiosa: contiene ${prohibido}`;
  if (perfil.kosher && c.conCarne && c.contiene.has('lacteos')) return 'Kosher: mezcla carne y lácteos';
  const etiqueta = (platillo.etiquetas || []).find((e) => perfil.excluirEtiquetas.includes(e));
  if (etiqueta) return `Contraindicado por diagnóstico (${etiqueta === 'alto-sodio' ? 'alto en sodio' : 'azúcar añadida'})`;
  return null;
}

/* PRNG reproducible (mulberry32): misma semilla → mismo plan */
function crearAzar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const elegirPonderado = (opciones, azar) => {
  const total = opciones.reduce((t, o) => t + o.peso, 0);
  if (total <= 0) return null;
  let r = azar() * total;
  for (const o of opciones) { r -= o.peso; if (r <= 0) return o; }
  return opciones[opciones.length - 1];
};

const copiaComida = (platillo, tiempo, objetivoKcal) => ({
  tiempo,
  etiquetaTiempo: TIEMPOS[tiempo],
  platilloClave: platillo.clave,
  nombre: platillo.nombre,
  ingredientes: (platillo.ingredientes || []).map((i) => ({ alimento: i.alimento, cantidad: i.cantidad || '' })),
  alergenos: [...(platillo.alergenos || [])],
  contiene: [...(platillo.contiene || [])],
  etiquetas: [...(platillo.etiquetas || [])],
  proteina: platillo.proteina,
  validado: platillo.validado === true,
  kcalBase: kcalPlatillo(platillo),
  objetivoKcal: Math.round(objetivoKcal),
  porcion: 1,
  kcal: kcalPlatillo(platillo),
});

/** Ajusta las porciones del día para acercarse a las kcal objetivo (por tiempo y luego del día) */
function ajustarPorciones(comidas, kcalDia) {
  comidas.forEach((c) => { c.porcion = redondearPorcion(c.objetivoKcal / c.kcalBase); });
  for (let i = 0; i < 4; i += 1) {
    const actual = comidas.reduce((t, c) => t + c.kcalBase * c.porcion, 0);
    const razon = kcalDia / actual;
    if (Math.abs(razon - 1) <= 0.03) break;
    comidas.forEach((c) => { c.porcion = redondearPorcion(c.porcion * razon); });
  }
  comidas.forEach((c) => { c.kcal = Math.round(c.kcalBase * c.porcion); });
  return comidas.reduce((t, c) => t + c.kcal, 0);
}

/**
 * Genera un plan semanal.
 * @param {object} o
 *  - platillos: catálogo activo
 *  - perfil: construirPerfil(...)
 *  - semilla: entero (se guarda para reproducir el plan)
 *  - fijadas: { 'diaIndice-comidaIndice': platilloClave } comidas que se conservan al regenerar
 *  - dias: número de días (1-7)
 * @returns {{ ok: true, plan } | { ok: false, motivo, detalle }}
 */
function generarPlan({ platillos, perfil, semilla, fijadas = {}, dias = 7 }) {
  const distribucion = DISTRIBUCION[perfil.numeroComidas];
  if (!distribucion) return { ok: false, motivo: 'Número de comidas no válido' };
  const azar = crearAzar(semilla);

  // 1) Filtro estricto (antes del azar)
  const exclusiones = {};
  const aptos = platillos.filter((p) => {
    const motivo = motivoExclusion(p, perfil);
    if (motivo) exclusiones[motivo] = (exclusiones[motivo] || 0) + 1;
    return !motivo;
  });
  const porTiempo = Object.fromEntries(Object.keys(TIEMPOS).map((t) => [t, aptos.filter((p) => (p.tiempos || []).includes(t))]));
  const necesarios = {};
  distribucion.forEach(([t]) => { necesarios[t] = (necesarios[t] || 0) + 1; });
  for (const [t, n] of Object.entries(necesarios)) {
    const minimo = Math.ceil((n * dias) / MAX_REPETICIONES_SEMANA);
    if (porTiempo[t].length < Math.min(minimo, n * dias)) {
      return {
        ok: false,
        motivo: `No hay suficientes platillos de «${TIEMPOS[t]}» que respeten todas las restricciones (hay ${porTiempo[t].length}, se necesitan al menos ${minimo} para no repetir de más).`,
        detalle: { exclusiones, aptosPorTiempo: Object.fromEntries(Object.entries(porTiempo).map(([k, v]) => [k, v.length])) },
      };
    }
  }

  const usos = {};
  const porClave = Object.fromEntries(platillos.map((p) => [p.clave, p]));
  const planDias = [];
  let proteinaComidaAnterior = null;
  let usadosAyer = new Set();

  for (let d = 0; d < dias; d += 1) {
    const usadosHoy = new Set();
    const comidas = [];
    for (let m = 0; m < distribucion.length; m += 1) {
      const [tiempo, pct] = distribucion[m];
      const objetivo = perfil.kcal * pct;
      const claveFija = fijadas[`${d}-${m}`];
      let elegido = claveFija && porClave[claveFija] && !motivoExclusion(porClave[claveFija], perfil) ? porClave[claveFija] : null;
      if (!elegido) {
        // 2) Azar controlado: solo entre aptos, sin repetir de más ni en días seguidos
        const opciones = porTiempo[tiempo]
          .filter((p) => (usos[p.clave] || 0) < MAX_REPETICIONES_SEMANA && !usadosHoy.has(p.clave) && !usadosAyer.has(p.clave))
          .map((p) => {
            const texto = textoPlatillo(p);
            let peso = 1;
            if (perfil.gustos.some((g) => coincide(texto, g))) peso *= 3;                      // prioriza lo que le gusta
            if (perfil.preparacion.some((e) => (p.etiquetas || []).includes(e))) peso *= 1.5; // preparación preferida
            if (tiempo === 'comida' && p.proteina === proteinaComidaAnterior) peso *= 0.3;   // rota la proteína
            peso /= 1 + Math.abs(Math.log(objetivo / kcalPlatillo(p))) * 3;                  // tamaño cercano al objetivo
            return { p, peso };
          });
        elegido = elegirPonderado(opciones, azar)?.p;
      }
      if (!elegido) {
        return { ok: false, reintentable: true, motivo: `No quedan opciones de «${TIEMPOS[tiempo]}» para el ${DIAS[d % 7]} sin repetir platillos de más. Agrega platillos al catálogo o revisa las restricciones.`, detalle: { exclusiones } };
      }
      usos[elegido.clave] = (usos[elegido.clave] || 0) + 1;
      usadosHoy.add(elegido.clave);
      if (tiempo === 'comida') proteinaComidaAnterior = elegido.proteina;
      const comida = copiaComida(elegido, tiempo, objetivo);
      comida.fijada = Boolean(claveFija && elegido.clave === claveFija);
      comidas.push(comida);
    }
    // 3) Porciones
    const kcal = ajustarPorciones(comidas, perfil.kcal);
    planDias.push({ dia: DIAS[d % 7], comidas, kcal });
    usadosAyer = usadosHoy;
  }

  return {
    ok: true,
    plan: {
      semilla,
      kcalObjetivo: perfil.kcal,
      distribucion: distribucion.map(([tiempo, pct]) => ({ tiempo, etiqueta: TIEMPOS[tiempo], porcentaje: Math.round(pct * 100) })),
      dias: planDias,
      exclusiones: Object.entries(exclusiones).map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
      advertencias: [...perfil.advertencias],
      platillosAptos: aptos.length,
    },
  };
}

/**
 * Verificación independiente del plan ya armado (sobre la copia guardada en el plan, no sobre el catálogo).
 * @returns {{ valido: boolean, problemas: string[] }}
 */
function validarPlan(plan, perfil) {
  const problemas = [];
  const distribucion = DISTRIBUCION[perfil.numeroComidas] || [];
  const usos = {};
  let anterior = new Set();
  (plan.dias || []).forEach((dia) => {
    if (dia.comidas.length !== distribucion.length) problemas.push(`${dia.dia}: faltan comidas (${dia.comidas.length} de ${distribucion.length}).`);
    const hoy = new Set();
    dia.comidas.forEach((c, i) => {
      if (distribucion[i] && c.tiempo !== distribucion[i][0]) problemas.push(`${dia.dia}: la comida ${i + 1} no corresponde al tiempo esperado.`);
      const motivo = motivoExclusion({ nombre: c.nombre, ingredientes: c.ingredientes, alergenos: c.alergenos, contiene: c.contiene, etiquetas: c.etiquetas, proteina: c.proteina }, perfil);
      if (motivo) problemas.push(`${dia.dia} · ${c.etiquetaTiempo}: «${c.nombre}» no es apto (${motivo}).`);
      if (hoy.has(c.platilloClave)) problemas.push(`${dia.dia}: «${c.nombre}» se repite el mismo día.`);
      if (anterior.has(c.platilloClave)) problemas.push(`${dia.dia}: «${c.nombre}» se repite en días seguidos.`);
      hoy.add(c.platilloClave);
      usos[c.platilloClave] = (usos[c.platilloClave] || 0) + 1;
      if (!(c.porcion >= PORCION_MIN && c.porcion <= PORCION_MAX)) problemas.push(`${dia.dia}: porción fuera de rango en «${c.nombre}».`);
    });
    const kcal = dia.comidas.reduce((t, c) => t + c.kcal, 0);
    if (Math.abs(kcal - perfil.kcal) > perfil.kcal * TOLERANCIA_KCAL) {
      problemas.push(`${dia.dia}: ${kcal} kcal, fuera del ±${TOLERANCIA_KCAL * 100} % de ${perfil.kcal} kcal.`);
    }
    anterior = hoy;
  });
  Object.entries(usos).filter(([, n]) => n > MAX_REPETICIONES_SEMANA)
    .forEach(([clave, n]) => problemas.push(`«${clave}» aparece ${n} veces en la semana (máximo ${MAX_REPETICIONES_SEMANA}).`));
  return { valido: problemas.length === 0, problemas };
}

/**
 * Genera y valida, reintentando con otras semillas si la validación falla.
 * @returns {{ ok: true, plan, intentos } | { ok: false, motivo, problemas?, detalle? }}
 */
function generarPlanValido({ platillos, perfil, semilla, fijadas, dias = 7, intentos = 25 }) {
  let ultimo = null;
  for (let i = 0; i < intentos; i += 1) {
    const s = (semilla + i * 7919) >>> 0;
    const r = generarPlan({ platillos, perfil, semilla: s, fijadas, dias });
    if (!r.ok && !r.reintentable) return r; // faltan opciones aptas: reintentar no lo resuelve
    if (!r.ok) { ultimo = [r.motivo]; continue; } // el sorteo llegó a un callejón sin salida: otra semilla
    const v = validarPlan(r.plan, perfil);
    if (v.valido) return { ok: true, plan: r.plan, intentos: i + 1 };
    ultimo = v.problemas;
  }
  return { ok: false, motivo: 'No se logró un plan que cumpla todas las reglas (porciones o variedad) con el catálogo actual.', problemas: ultimo };
}

/** Lista de compras: ingredientes agrupados con las porciones de la semana */
function listaCompras(plan) {
  const mapa = new Map();
  plan.dias.forEach((d) => d.comidas.forEach((c) => c.ingredientes.forEach((i) => {
    const clave = normalizar(i.alimento);
    const e = mapa.get(clave) || { alimento: i.alimento, veces: 0, cantidades: [] };
    e.veces += 1;
    if (i.cantidad && i.cantidad !== 'al gusto') e.cantidades.push(c.porcion === 1 ? i.cantidad : `${i.cantidad} × ${c.porcion}`);
    mapa.set(clave, e);
  })));
  return [...mapa.values()].sort((a, b) => a.alimento.localeCompare(b.alimento, 'es'));
}

module.exports = {
  KCAL_EQUIVALENTE, TIEMPOS, DISTRIBUCION, DIAS, TIPOS_ALIMENTACION, RESTRICCIONES, ALERGENOS,
  MAX_REPETICIONES_SEMANA, TOLERANCIA_KCAL,
  normalizar, kcalPlatillo, clasificar, construirPerfil, datosFaltantes, motivoExclusion,
  generarPlan, validarPlan, generarPlanValido, listaCompras,
};
