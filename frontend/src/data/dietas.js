/* ==========================================
   PLANES DE ALIMENTACIÓN
   Cada ingrediente: { alimento, cantidad }
========================================== */

const i = (alimento, cantidad = '') => ({ alimento, cantidad });

export const DIETA_SEMANA_2 = {
  id: 'semana-2',
  nombre: 'Dieta semana 2',
  inicio: '2026-11-02',
  fin: '2026-11-08',
  nota: 'Puedes usar una cucharadita de mayonesa o sal y limón.',
  dias: [
    {
      dia: 'Lunes',
      fecha: '2026-11-02',
      comidas: [
        {
          tiempo: 'Desayuno',
          platillo: 'Omelette con espinacas y aguacate',
          ingredientes: [
            i('Huevo', '4 piezas (132 g)'),
            i('Espinacas', '½ taza (15 g)'),
            i('Jitomate', '1 rebanada (10 g)'),
            i('Pan integral', '2 piezas (70 g)'),
            i('Aguacate', '⅛ pieza (23.5 g)'),
          ],
        },
        {
          tiempo: 'Medio día',
          platillo: 'Fresas con yogur y granola',
          ingredientes: [
            i('Yogur sin azúcar', '1 taza (240 ml)'),
            i('Granola', '1 cucharada (10.3 g)'),
            i('Fresas', '7 piezas (84 g)'),
          ],
        },
        {
          tiempo: 'Comida',
          platillo: 'Sopa de lentejas y chayote relleno con queso y verduras',
          ingredientes: [
            i('Lentejas cocidas', '1 taza (180 g)'),
            i('Chayote', '1 taza (120 g)'),
            i('Queso panela', '1 rebanada (40 g)'),
            i('Tomate rojo', '10 g'),
            i('Cebolla blanca', '5 g'),
            i('Tortilla de maíz', '3 piezas (60 g)'),
          ],
        },
        {
          tiempo: 'Media tarde',
          platillo: 'Avena con leche y plátano',
          ingredientes: [
            i('Plátano', '1 pieza (120 g)'),
            i('Avena cruda', '¼ taza (20 g)'),
            i('Canela'),
            i('Leche descremada', '½ taza (100 ml)'),
          ],
        },
        {
          tiempo: 'Cena',
          platillo: 'Molletes con pico de gallo',
          ingredientes: [
            i('Queso panela', '2 rebanadas (80 g)'),
            i('Pan bolillo sin migajón', '1 pieza (60 g)'),
            i('Frijoles bayos refritos', '½ taza (35 g)'),
            i('Jitomate', '30 g'),
            i('Cebolla blanca', '10 g'),
            i('Chile serrano', '5 g'),
            i('Cilantro'),
          ],
        },
      ],
    },
    {
      dia: 'Martes',
      fecha: '2026-11-03',
      comidas: [
        {
          tiempo: 'Al despertar',
          platillo: 'Agua',
          ingredientes: [i('Agua', '300 ml')],
        },
        {
          tiempo: 'Desayuno',
          platillo: 'Huevo con chorizo',
          ingredientes: [
            i('Huevo', '2 piezas (100 g)'),
            i('Chorizo de cerdo', '15 g'),
            i('Chile serrano', '40 g'),
            i('Tortilla de maíz', '1 pieza (30 g)'),
            i('Aceite de canola', '½ cucharadita (2.5 ml)'),
          ],
        },
        {
          tiempo: 'Medio día',
          platillo: 'Yogur con fruta',
          ingredientes: [
            i('Yogur natural sin azúcar', '½ taza (180 g)'),
            i('Manzana', '1 pieza (100 g)'),
            i('Avena cruda', '¼ taza (20 g)'),
          ],
        },
        {
          tiempo: 'Comida',
          platillo: 'Arroz blanco con pollo',
          ingredientes: [
            i('Pollo a la plancha', '120 g'),
            i('Arroz al vapor', '½ taza (94 g)'),
            i('Brócoli cocido', '½ taza (92 g)'),
            i('Aceite de oliva', '½ cucharadita (2.5 ml)'),
            i('Pimiento rojo o verde', '¼ taza (50 g)'),
            i('Frijoles cocidos', '1 taza (180 g)'),
          ],
        },
        {
          tiempo: 'Media tarde',
          platillo: 'Fresas con yogur',
          ingredientes: [
            i('Fresas', '5 piezas (100 g)'),
            i('Mora', '½ taza (75 g)'),
            i('Yogur griego sin azúcar', '1 pieza (145 ml)'),
            i('Galletas Marías', '5 piezas'),
          ],
        },
        {
          tiempo: 'Cena',
          platillo: 'Quesadilla con espinaca',
          ingredientes: [
            i('Tortilla de maíz', '1 pieza (30 g)'),
            i('Queso Oaxaca bajo en grasa', '3 rebanadas (90 g)'),
            i('Espinaca', '2 tazas (120 g)'),
          ],
        },
      ],
    },
    {
      dia: 'Miércoles',
      fecha: '2026-11-04',
      comidas: [
        {
          tiempo: 'Al despertar',
          platillo: 'Agua',
          ingredientes: [i('Agua', '300 ml')],
        },
        {
          tiempo: 'Desayuno',
          platillo: 'Chilaquiles con huevo',
          ingredientes: [
            i('Salsa de tomate', '70 g'),
            i('Tortilla de maíz', '2 piezas (60 g)'),
            i('Crema agria', '1 cucharada'),
            i('Cebolla morada', '10 g'),
            i('Aceite de canola', '½ cucharadita (2.5 ml)'),
            i('Cilantro', '1 g'),
            i('Huevo', '2 piezas (100 g)'),
          ],
        },
        {
          tiempo: 'Medio día',
          platillo: 'Licuado de plátano',
          ingredientes: [
            i('Leche semidescremada', '240 ml'),
            i('Plátano', '½ pieza'),
            i('Galletas Marías', '5 piezas (20 g)'),
          ],
        },
        {
          tiempo: 'Comida',
          platillo: 'Alambre de res',
          ingredientes: [
            i('Carne de res', '120 g'),
            i('Pimiento rojo o verde', '¼ taza (45 g)'),
            i('Cebolla blanca', '27 g'),
            i('Zanahoria', '¼ taza (40 g)'),
            i('Tortilla de maíz', '2 piezas (60 g)'),
            i('Frijoles cocidos', '1 taza (180 g)'),
            i('Aceite de canola', '½ cucharadita (2.5 ml)'),
          ],
        },
        {
          tiempo: 'Media tarde',
          platillo: 'Yogur natural con avena y manzana',
          ingredientes: [
            i('Yogur natural sin azúcar', '½ taza'),
            i('Avena cruda', '¼ taza (20 g)'),
            i('Manzana', '1 pieza (100 g)'),
          ],
        },
        {
          tiempo: 'Cena',
          platillo: 'Calabacitas con queso a la mexicana',
          ingredientes: [
            i('Calabacita italiana', '1 pieza (110 g)'),
            i('Queso fresco', '3 rebanadas (120 g)'),
            i('Cebolla blanca', '10 g'),
            i('Tomate rojo', '10 g'),
            i('Tortilla de maíz', '1 pieza (30 g)'),
          ],
        },
      ],
    },
    {
      dia: 'Jueves',
      fecha: '2026-11-05',
      comidas: [
        {
          tiempo: 'Desayuno',
          platillo: 'Huevo con ejotes a la mexicana',
          ingredientes: [
            i('Huevo', '2 piezas (100 g)'),
            i('Ejotes cocidos', '½ taza (65 g)'),
            i('Cebolla blanca', '10 g'),
            i('Tomate rojo', '10 g'),
            i('Aceite en aerosol', '5 ml'),
            i('Frijoles refritos', '⅓ taza (40 g)'),
            i('Sanissimo', '3 piezas'),
          ],
        },
        {
          tiempo: 'Medio día',
          platillo: 'Licuado de fresa',
          ingredientes: [
            i('Leche semidescremada', '240 ml'),
            i('Fresas', '4 piezas (50 g)'),
            i('Azúcar', '½ cucharadita (2 g)'),
          ],
        },
        {
          tiempo: 'Comida',
          platillo: 'Fajitas de pollo con morrón',
          ingredientes: [
            i('Pechuga de pollo asada', '120 g'),
            i('Pimiento rojo o verde', '¼ taza (45 g)'),
            i('Cebolla picada', '2 cucharadas (10 g)'),
            i('Arroz blanco cocido', '½ taza (100 g)'),
            i('Sanissimo', '2 piezas'),
          ],
        },
        {
          tiempo: 'Media tarde',
          platillo: 'Verduras cocidas',
          ingredientes: [
            i('Calabacita italiana', '½ pieza (55 g)'),
            i('Chayote', '½ taza (60 g)'),
            i('Papa amarilla', '50 g'),
          ],
        },
        {
          tiempo: 'Cena',
          platillo: 'Atún con ensalada de verduras',
          ingredientes: [
            i('Atún', '2 latas (180 g)'),
            i('Chícharo', '10 g'),
            i('Elote', '10 g'),
            i('Papa', '10 g'),
            i('Zanahoria', '10 g'),
            i('Sanissimo', '3 piezas'),
          ],
        },
      ],
    },
    {
      dia: 'Viernes',
      fecha: '2026-11-06',
      comidas: [
        {
          tiempo: 'Desayuno',
          platillo: 'Huevo con ejotes a la mexicana',
          ingredientes: [
            i('Huevo', '2 piezas (100 g)'),
            i('Ejotes cocidos', '½ taza (65 g)'),
            i('Cebolla', '10 g'),
            i('Tomate rojo', '10 g'),
            i('Aceite de canola', '½ cucharadita'),
            i('Tortilla de maíz', '3 piezas (60 g)'),
          ],
        },
        {
          tiempo: 'Medio día',
          platillo: 'Plátano con yogur',
          ingredientes: [
            i('Plátano', '1 pieza (120 g)'),
            i('Yogur natural de leche descremada', '200 ml'),
          ],
        },
        {
          tiempo: 'Comida',
          platillo: 'Ejotes a la mexicana con pollo',
          ingredientes: [
            i('Pollo deshebrado', '1½ tazas (225 g)'),
            i('Ejotes crudos', '½ taza'),
            i('Cebolla', '3 g'),
            i('Aceite', '1 cucharadita (5 ml)'),
            i('Arroz blanco cocido', '1 taza (200 g)'),
          ],
        },
        {
          tiempo: 'Media tarde',
          platillo: 'Melón',
          ingredientes: [i('Melón', '1 taza (150 g)')],
        },
        {
          tiempo: 'Cena',
          platillo: null, // No legible en la fotografía original
          pendiente: 'No se alcanzó a distinguir en la fotografía del plan.',
          ingredientes: [],
        },
      ],
    },
    {
      dia: 'Sábado',
      fecha: '2026-11-07',
      comidas: [],
      pendiente: 'Sin alimentos registrados en el plan.',
    },
    {
      dia: 'Domingo',
      fecha: '2026-11-08',
      comidas: [],
      pendiente: 'Sin alimentos registrados en el plan.',
    },
  ],
};

export const DIETAS = [DIETA_SEMANA_2];

export const buscarDieta = (id) => DIETAS.find((d) => d.id === id) || null;

/* Comidas que sí se pueden evaluar (tienen platillo definido) */
export const comidasEvaluables = (dia) =>
  dia.comidas.filter((c) => c.platillo);
