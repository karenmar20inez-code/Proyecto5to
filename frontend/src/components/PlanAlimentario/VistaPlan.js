import { AlertTriangle, Lock, LockOpen, RefreshCw, ShoppingBasket } from 'lucide-react';
import './PlanAlimentario.css';

const fraccion = (n) => {
  const entero = Math.floor(n);
  const resto = Math.round((n - entero) * 4);
  const f = ['', '¼', '½', '¾'][resto];
  return `${entero || ''}${f}` || '0';
};

/** Advertencia que acompaña SIEMPRE a un plan generado */
export function AdvertenciaPlan({ texto }) {
  return (
    <p className="aviso aviso--alerta plan-advertencia" role="note">
      <AlertTriangle aria-hidden="true" />
      <span>{texto || 'Plan orientativo generado automáticamente. Debe ser revisado por un nutriólogo o profesional de la salud antes de seguirlo.'}</span>
    </p>
  );
}

/**
 * Vista semanal de un plan generado. Con `editable` (nutriólogo, plan en borrador) muestra los
 * controles para fijar comidas, cambiar una comida o regenerar un día.
 */
function VistaPlan({ plan, editable = false, mostrarValidacion = false, fijadas = new Set(), onFijar, onCambiarComida, onRegenerarDia, ocupado = false }) {
  return (
    <div className="plan-semanal">
      {(plan.advertencias || []).map((a) => <AdvertenciaPlan key={a} texto={a} />)}

      <div className="plan-resumen">
        <span className="insignia insignia--info">{plan.kcalObjetivo} kcal/día</span>
        {(plan.distribucion || []).map((d, i) => <span key={`${d.tiempo}-${i}`} className="insignia">{d.etiqueta} {d.porcentaje} %</span>)}
      </div>

      {plan.exclusiones?.length > 0 && (
        <details className="plan-exclusiones">
          <summary>Por qué se excluyeron platillos ({plan.exclusiones.reduce((t, e) => t + e.cantidad, 0)})</summary>
          <ul>{plan.exclusiones.map((e) => <li key={e.motivo}>{e.motivo}: {e.cantidad}</li>)}</ul>
        </details>
      )}

      <div className="plan-dias">
        {plan.dias.map((dia, di) => (
          <section key={dia.dia} className="plan-dia" aria-labelledby={`plan-dia-${di}`}>
            <header className="plan-dia__encabezado">
              <h3 id={`plan-dia-${di}`}>{dia.dia}</h3>
              <span className="plan-dia__kcal">{dia.kcal ?? dia.comidas.reduce((t, c) => t + (c.kcal || 0), 0)} kcal</span>
              {editable && (
                <button type="button" className="boton boton--fantasma boton--chico boton--icono" disabled={ocupado}
                  onClick={() => onRegenerarDia(di)} aria-label={`Regenerar el ${dia.dia}`} title={`Regenerar el ${dia.dia}`}>
                  <RefreshCw aria-hidden="true" />
                </button>
              )}
            </header>
            <ul className="plan-comidas">
              {dia.comidas.map((c, mi) => {
                const clave = `${di}-${mi}`;
                const fija = fijadas.has(clave);
                return (
                  <li key={clave} className={`plan-comida${editable ? ' plan-comida--editable' : ''}${fija ? ' plan-comida--fija' : ''}`}>
                    <div className="plan-comida__tiempo">{c.etiquetaTiempo}</div>
                    <div className="plan-comida__nombre">{c.nombre}{mostrarValidacion && c.validado !== true && <> <span className="insignia insignia--aviso">sin validar</span></>}</div>
                    <div className="plan-comida__meta">
                      {c.porcion !== 1 && <>Porción ×{fraccion(c.porcion)} · </>}{c.kcal} kcal
                    </div>
                    <details className="plan-comida__ingredientes">
                      <summary>Ingredientes</summary>
                      <ul>
                        {c.ingredientes.map((i) => <li key={i.alimento}>{i.alimento}{i.cantidad ? ` — ${i.cantidad}` : ''}</li>)}
                      </ul>
                      {c.porcion !== 1 && <p className="campo__ayuda">Cantidades para 1 porción; multiplícalas por {fraccion(c.porcion)}.</p>}
                    </details>
                    {editable && (
                      <div className="plan-comida__acciones">
                        <button type="button" className="boton boton--fantasma boton--chico boton--icono" disabled={ocupado}
                          onClick={() => onFijar(clave)} aria-pressed={fija}
                          aria-label={fija ? `Desfijar ${c.nombre}` : `Fijar ${c.nombre} al regenerar`} title={fija ? 'Desfijar' : 'Fijar al regenerar'}>
                          {fija ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
                        </button>
                        <button type="button" className="boton boton--fantasma boton--chico boton--icono" disabled={ocupado || fija}
                          onClick={() => onCambiarComida(di, mi)} aria-label={`Cambiar ${c.nombre}`} title="Cambiar este platillo">
                          <RefreshCw aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {plan.listaCompras?.length > 0 && (
        <details className="panel plan-compras">
          <summary><ShoppingBasket aria-hidden="true" /> Lista de compras de la semana ({plan.listaCompras.length})</summary>
          <ul>
            {plan.listaCompras.map((i) => (
              <li key={i.alimento}><strong>{i.alimento}</strong>{i.cantidades.length > 0 && <span> — {i.cantidades.join(' + ')}</span>}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default VistaPlan;
