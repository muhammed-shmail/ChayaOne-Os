'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { stats } from './data';
import { Group, GroupItem } from './primitives';

function StatNum({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (reduce) { setN(value); return; }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1500;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(value * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setN(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value]);

  const shown = n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span ref={ref} className="l-stat-num l-tnum">{prefix}{shown}{suffix}</span>;
}

export function Stats() {
  return (
    <section className="l-section-tight" aria-label="Chaya.One by the numbers">
      <div className="l-container">
        <Group className="l-stats">
          {stats.map((s) => (
            <GroupItem key={s.label} style={{ height: '100%' }}>
              <div className="l-stat">
                <StatNum value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
                <div className="l-stat-label">{s.label}</div>
              </div>
            </GroupItem>
          ))}
        </Group>
      </div>
    </section>
  );
}
