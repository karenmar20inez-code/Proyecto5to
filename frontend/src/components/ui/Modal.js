import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Diálogo modal accesible y reutilizable.
 *  - Foco atrapado dentro del diálogo y devuelto al cerrar.
 *  - Cierre con Escape y con el botón X de la esquina superior derecha.
 *  - Clic en el fondo: cierra solo si `cerrarAlFondo` (por omisión sí). En formularios largos
 *    conviene desactivarlo para no perder lo capturado por un clic accidental.
 *  - Bloquea el desplazamiento de la página de fondo mientras está abierto.
 *  - El contenido se desplaza dentro del modal si no cabe en la pantalla.
 */
function Modal({ titulo, descripcion, abierto, onCerrar, children, acciones, ancho, cerrarAlFondo = true }) {
  const ref = useRef(null);
  // La función de cierre suele ser una flecha nueva en cada render: se guarda en una ref
  // para que el efecto no se reinicie (y no mueva el foco) con cada tecla del formulario.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    const previo = document.activeElement;
    const enfocables = () => ref.current?.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [];
    // Primer campo del contenido (no el botón X); si no hay, el propio diálogo
    const primero = ref.current?.querySelector('.modal__cuerpo input:not(:disabled), .modal__cuerpo select:not(:disabled), .modal__cuerpo textarea:not(:disabled)');
    (primero || ref.current)?.focus();

    const teclado = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrarRef.current?.(); }
      if (e.key === 'Tab') {
        const lista = [...enfocables()];
        if (!lista.length) return;
        const inicio = lista[0];
        const fin = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === inicio) { e.preventDefault(); fin.focus(); }
        else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); inicio.focus(); }
      }
    };
    document.addEventListener('keydown', teclado);
    document.body.classList.add('modal-abierto');
    return () => {
      document.removeEventListener('keydown', teclado);
      document.body.classList.remove('modal-abierto');
      previo?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;
  /* Se dibuja directamente en <body> (portal de React): así el velo cubre toda la pantalla aunque el
     botón que lo abre esté dentro de un panel de vidrio (backdrop-filter crea un contenedor que
     atrapaba a position: fixed y en celular dejaba el modal fuera de la pantalla). */
  return createPortal(
    <div className="modal-fondo" onMouseDown={(e) => { if (cerrarAlFondo && e.target === e.currentTarget) onCerrar?.(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo"
        aria-describedby={descripcion ? 'modal-descripcion' : undefined} ref={ref} tabIndex={-1}
        style={ancho ? { width: `min(${ancho}px, 100%)` } : undefined}>
        <div className="modal__encabezado">
          <div>
            <h2 id="modal-titulo">{titulo}</h2>
            {descripcion && <p className="modal__descripcion" id="modal-descripcion">{descripcion}</p>}
          </div>
          {onCerrar && (
            <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar ventana" title="Cerrar">
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="modal__cuerpo">{children}</div>
        {acciones && <div className="modal__acciones">{acciones}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
