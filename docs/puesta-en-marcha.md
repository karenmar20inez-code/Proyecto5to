# Puesta en marcha de NUTRIONIX — Sistema Integral de Gestión Nutricional

A partir de esta versión la API exige inicio de sesión y cifra información sensible.
El servidor **no arranca** sin `CLAVE_CIFRADO`.

## 1. Generar la clave de cifrado (una sola vez)

```bash
npm run generar-clave --prefix backend
```

Copia la línea `CLAVE_CIFRADO=...` en `backend/.env` y **guarda una copia segura fuera del equipo**:
si se pierde, los datos cifrados (teléfonos, notas SOAP, antecedentes) no podrán leerse.

Opcional en `backend/.env`:
- `CORS_ORIGENES=http://localhost:3000` (orígenes del frontend, separados por coma)
- `SESION_HORAS=12`, `SESION_INACTIVIDAD_MIN=30`
- `ZONA_HORARIA=America/Mexico_City`

## 2. Crear el primer administrador y los profesionales

```bash
npm run crear-administrador --prefix backend -- --correo tu@correo.com --nombre "Nombre Apellido"
```
```bash
npm run crear-administrador --prefix backend -- --correo nutriologa@correo.com --nombre "Nombre" --rol nutriologo --cedula 1234567
```

La contraseña se pide en la terminal. Después, los demás usuarios se crean desde **Administración**.

## 3. Migrar los datos existentes (idempotente)

```bash
npm run migrar --prefix backend -- --responsable nutriologa@correo.com --simular
```
```bash
npm run migrar --prefix backend -- --responsable nutriologa@correo.com
```

Crea un expediente (folio) por paciente, cifra datos de contacto en texto plano, copia
laboratorios que estaban en mediciones (sin inventar rangos) e instala las reglas de alerta.

## 4. Ejecutar

```bash
npm run dev --prefix backend
```
```bash
npm start --prefix frontend
```

## 5. Pruebas

```bash
npm test --prefix backend
```

La prueba de flujo completo con base de datos requiere una base **distinta** de producción
cuyo nombre contenga "prueba" (PowerShell):

```bash
$env:MONGO_URI_TEST="mongodb+srv://.../lanutria_pruebas?..."; npm test --prefix backend
```

## 6. Respaldos

```bash
npm run respaldo --prefix backend
```

Genera `backend/respaldos/la-nutria-AAAAMMDD-HHMM.json.enc` (cifrado). Restaurar:
`npm run restaurar --prefix backend -- --archivo ruta` (pide confirmación escrita).

## 7. Catálogos (CIE-10, medicamentos)

No se incluyen: importa la versión oficial desde CSV (`codigo,texto`):

```bash
npm run importar-catalogo --prefix backend -- --sistema CIE-10 --archivo cie10.csv --fuente "DGIS" --version "2024"
```

## Pendientes conocidos

- Adjuntar archivos (requiere almacenamiento cifrado por archivo).
- Firma electrónica avanzada (e.firma); hoy la firma es interna con huella SHA-256.
- Catálogos oficiales completos y validación de códigos LOINC por un responsable de interoperabilidad.
- Revisión clínica y legal real de reglas de alerta, formatos y cumplimiento normativo.
- Recordatorios a pacientes y portal del paciente.
