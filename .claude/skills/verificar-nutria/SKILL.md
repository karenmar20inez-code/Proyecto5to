---
name: verificar-nutria
description: Verificación completa de La Nutria antes de entregar un cambio. Ejecuta las pruebas del backend y compila el frontend, y reporta el resultado. Úsala con /verificar-nutria o cuando se pida comprobar que el proyecto sigue funcionando.
---

# Verificar La Nutria

Ejecuta estos pasos desde la raíz del proyecto, en orden, y reporta cada resultado.

1. Pruebas del backend (sin base de datos de producción):

   ```bash
   npm test --prefix backend
   ```

   Reporta pasan / fallan / omitidas. La prueba `expediente.db.test.js` se omite
   si no existe `MONGO_URI_TEST`; eso es normal.

2. Compilación del frontend:

   ```bash
   npm run build --prefix frontend
   ```

   Reporta si compila y lista las advertencias de ESLint, si las hay.

3. Si algo falla, muestra solo la línea decisiva del error y el archivo afectado.
   No corrijas nada sin antes explicar el cambio propuesto.

## Restricciones

- No abras ni muestres archivos `.env`.
- No despliegues ni publiques nada.
- No ejecutes scripts que escriban en MongoDB Atlas (`migrar`, `restaurar`,
  `crear-administrador`, `importar-catalogo`).
