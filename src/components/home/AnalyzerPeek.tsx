// Isla de React: lo que revisa el analizador, grupo por grupo, con el peso real de cada grupo en la nota.
// El HTML sale completo del build (los 4 grupos están en el DOM; sin JS, Analyzer.astro los muestra todos),
// así Google y la IA leen las 21 revisiones aunque la isla no hidrate.
// Movimiento con Motion (motion/react-mini = WAAPI, ~2 KB): un haz recorre la lista al aparecer y al cambiar
// de grupo, el subrayado se desliza entre pestañas y la barra de peso crece. Con movimiento reducido, nada se mueve.
import { useEffect, useRef, useState } from 'react';
import { useAnimate } from 'motion/react-mini';
import { groups, totalWeight } from '../../lib/checks';

const EASE = [0.16, 1, 0.3, 1] as const;
const weightOf = (i: number) => groups[i].checks.reduce((s, c) => s + c.weight, 0);
const pct = (n: number) => Math.round((n / totalWeight) * 100);

export default function AnalyzerPeek() {
  const [active, setActive] = useState(0);
  const [live, setLive] = useState(false);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const first = useRef(true);

  const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // subrayado deslizante: se mide el botón activo y se mueve con transform (sin animar ancho = sin reflujo)
  function placeIndicator(i: number, instant: boolean) {
    const root = scope.current, b = tabs.current[i];
    if (!root || !b) return;
    const ind = root.querySelector<HTMLElement>('.ap-ind');
    if (!ind) return;
    const t = `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth})`;
    if (instant || still()) { ind.style.transform = t; return; }
    animate(ind, { transform: t }, { duration: 0.45, ease: EASE });
  }

  // el haz del faro pasa por la lista; cada fila se ilumina un instante cuando el haz la cruza
  function scan(i: number) {
    if (still()) return;
    const root = scope.current;
    if (!root) return;
    const panel = root.querySelector<HTMLElement>(`#ap-panel-${groups[i].id}`);
    const beam = root.querySelector<HTMLElement>('.ap-scan');
    if (!panel || !beam) return;
    const rows = panel.querySelectorAll<HTMLElement>('.ap-row');
    const h = panel.offsetHeight, d = 0.32 + rows.length * 0.1;
    beam.style.top = panel.offsetTop + 'px';
    animate(beam, { transform: ['translateY(0)', `translateY(${h}px)`], opacity: [0, 1, 1, 0] }, { duration: d, ease: 'linear' });
    animate(panel.querySelectorAll('.ap-flash'), { opacity: [0, 1, 0] }, { duration: 0.7, delay: (k: number) => 0.12 + k * 0.1, ease: 'easeOut' });
    animate(panel.querySelectorAll('.ap-ok'), { transform: ['scale(1)', 'scale(1.28)', 'scale(1)'] }, { duration: 0.5, delay: (k: number) => 0.14 + k * 0.1, ease: EASE });
  }

  useEffect(() => {
    setLive(true);
    const onResize = () => placeIndicator(active, true);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [active]);

  useEffect(() => {
    placeIndicator(active, first.current);
    const root = scope.current;
    const fill = root?.querySelector<HTMLElement>('.ap-fill');
    const s = `scaleX(${weightOf(active) / totalWeight})`;
    if (fill) { if (still()) fill.style.transform = s; else animate(fill, { transform: s }, { duration: 0.7, ease: EASE }); }
    if (!first.current && !still() && root) {
      animate(root.querySelectorAll(`#ap-panel-${groups[active].id} .ap-row`), { opacity: [0, 1], transform: ['translateY(0.5rem)', 'translateY(0)'] },
        { duration: 0.45, delay: (k: number) => k * 0.035, ease: EASE });
    }
    // la isla hidrata cuando entra en pantalla (client:visible): ese es el momento del primer barrido
    const t = setTimeout(() => scan(active), first.current ? 250 : 120);
    first.current = false;
    return () => clearTimeout(t);
  }, [active]);

  function onKey(e: React.KeyboardEvent) {
    const n = groups.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (active + 1) % n;
    else if (e.key === 'ArrowLeft') next = (active - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  const w = weightOf(active);
  return (
    <div className={live ? 'ap ap-live' : 'ap'} ref={scope}>
      <div className="ap-tabs" role="tablist" aria-label="Grupos de revisiones" onKeyDown={onKey}>
        {groups.map((g, i) => (
          <button
            key={g.id} type="button" role="tab" id={`ap-tab-${g.id}`} aria-controls={`ap-panel-${g.id}`}
            aria-selected={i === active} tabIndex={i === active ? 0 : -1}
            ref={(el) => { tabs.current[i] = el; }} onClick={() => setActive(i)}
          >
            {g.name} <span className="ap-count num">{g.checks.length}</span>
          </button>
        ))}
        <span className="ap-ind" aria-hidden="true" />
      </div>

      <p className="ap-weight">
        <span className="ap-wtext"><strong>{groups[active].name}</strong> pesa <span className="num">{w} de {totalWeight}</span> puntos de la nota <span className="num">({pct(w)} %)</span></span>
        <span className="ap-bar" aria-hidden="true"><span className="ap-fill" style={{ transform: `scaleX(${w / totalWeight})` }} /></span>
      </p>

      <div className="ap-panels">
        <span className="ap-scan" aria-hidden="true" />
        {groups.map((g, i) => (
          <div key={g.id} className="ap-panel" role="tabpanel" id={`ap-panel-${g.id}`} aria-labelledby={`ap-tab-${g.id}`} hidden={i !== active}>
            <h3 className="ap-gname">{g.name}</h3>
            <ul className="ap-list" role="list">
              {g.checks.map((c) => (
                <li className="ap-row" key={c.label}>
                  <span className="ap-flash" aria-hidden="true" />
                  <span className="ap-ok" aria-hidden="true" />
                  <span className="ap-txt">
                    <span className="ap-label">{c.label}</span>
                    <span className="ap-what">{c.what}</span>
                  </span>
                  <span className="ap-pts num" title="Peso en la nota">{c.weight} {c.weight === 1 ? 'punto' : 'puntos'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <form className="ap-form" action="/analiza" method="get">
        <label className="ap-flabel" htmlFor="ap-url">Revisa tu web con estas {groups.reduce((s, g) => s + g.checks.length, 0)} revisiones</label>
        <div className="ap-frow">
          <input id="ap-url" name="url" type="text" inputMode="url" placeholder="tunegocio.cl" autoComplete="off" autoCapitalize="off" spellCheck={false} required />
          <button type="submit" className="btn btn-primary">Analizar mi web</button>
        </div>
      </form>
    </div>
  );
}
