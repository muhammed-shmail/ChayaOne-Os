'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Coffee, ChefHat, Receipt, TrendingUp, Gift, Timer } from 'lucide-react';
import { CountUp } from '@/components/ui/motion';
import { TiltCard, useMounted } from './primitives';

/* Deterministic pools — the counter derives everything from a single `tick`
   counter so server and first client render match (no random on the path). */
const KOTS = [
  { table: 'Table 07', min: 2, items: [{ q: 2, name: 'Filter Coffee' }, { q: 1, name: 'Masala Dosa' }] },
  { table: 'Table 12', min: 1, items: [{ q: 1, name: 'Cold Brew' }, { q: 2, name: 'Veg Puff' }] },
  { table: 'Takeaway', min: 4, items: [{ q: 3, name: 'Cutting Chai' }, { q: 1, name: 'Bun Maska' }] },
  { table: 'Table 03', min: 3, items: [{ q: 1, name: 'Cappuccino' }, { q: 2, name: 'Croissant' }] },
  { table: 'Table 21', min: 1, items: [{ q: 2, name: 'Iced Latte' }, { q: 1, name: 'Brownie' }] },
];
const SALES = [180, 240, 95, 320, 150, 260, 410, 120, 300, 90];
const SPARK = [42, 60, 48, 70, 54, 82, 58, 90, 50, 76, 66, 94];
const REV_BASE = 48250;
const ORD_BASE = 128;

export function LivingCounter() {
  const reduce = useReducedMotion();
  const mounted = useMounted();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 3200);
    return () => clearInterval(id);
  }, [reduce]);

  const revenue = REV_BASE + SALES.slice(0, tick).reduce((a, b) => a + b, 0) +
    (tick > SALES.length ? (tick - SALES.length) * 205 : 0);
  const orders = ORD_BASE + tick;
  const spark = SPARK.map((_, i) => SPARK[(i + tick) % SPARK.length]!);
  const topKot = KOTS[tick % KOTS.length]!;
  const secondKot = KOTS[(tick + KOTS.length - 1) % KOTS.length]!;
  const showToast = mounted && !reduce && tick % 5 === 2;

  return (
    <div className="l-counter" aria-label="Live café dashboard preview" role="img">
      <TiltCard className="l-counter-stage" max={5}>
        {/* Revenue panel */}
        <div className="l-panel l-float" style={{ marginBottom: 16 }}>
          <div className="l-panel-head">
            <span className="ttl"><TrendingUp size={15} strokeWidth={2} /> Today · Live</span>
            <span className="rt l-badge" style={{ padding: '5px 10px', fontSize: 11 }}>
              <span className="l-dot live" /> Open
            </span>
          </div>
          <div style={{ padding: '16px 18px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="l-rev-amt l-tnum">
                  <CountUp value={revenue} format={(n) => `₹${n.toLocaleString('en-IN')}`} duration={900} />
                </div>
                <div className="l-rev-sub" style={{ marginTop: 4 }}>
                  <span className="l-rev-up"><TrendingUp size={12} strokeWidth={2.4} /> 18.4%</span>&nbsp; vs last week
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="l-rev-amt l-tnum" style={{ fontSize: 22 }}>
                  <CountUp value={orders} duration={700} />
                </div>
                <div className="l-rev-sub">orders</div>
              </div>
            </div>
            <div className="l-spark" aria-hidden>
              {spark.map((h, i) => (
                <i key={i} className={i === spark.length - 1 ? 'hot' : ''} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="l-counter-main">
          {/* POS bill */}
          <div className="l-panel l-float d2">
            <div className="l-panel-head">
              <span className="ttl"><Receipt size={15} strokeWidth={2} /> Bill · #4821</span>
            </div>
            <div style={{ padding: '14px 16px 16px' }}>
              <div className="l-receipt-row"><span className="nm"><b className="l-mono">2×</b> Filter Coffee</span><span className="amt">₹120</span></div>
              <div className="l-receipt-row"><span className="nm"><b className="l-mono">1×</b> Masala Dosa</span><span className="amt">₹90</span></div>
              <div className="l-receipt-row"><span className="nm"><b className="l-mono">1×</b> Cold Brew</span><span className="amt">₹160</span></div>
              <div className="l-receipt-row" style={{ borderBottom: 0, color: 'var(--l-ink-3)' }}>
                <span className="nm">GST 5%</span><span className="amt">₹18.50</span>
              </div>
              <div className="l-receipt-tot"><span>Total</span><span className="amt">₹388.50</span></div>
            </div>
          </div>

          {/* KDS tickets */}
          <div className="l-panel l-float d1" style={{ background: 'transparent', border: 0, boxShadow: 'none', overflow: 'visible' }}>
            <div className="l-panel-head" style={{ background: 'var(--l-card)', border: '1px solid var(--l-glass-line)', borderRadius: 14, marginBottom: 10 }}>
              <span className="ttl"><ChefHat size={15} strokeWidth={2} /> Kitchen</span>
              <span className="rt l-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--l-ink-3)' }}>2 firing</span>
            </div>
            <div style={{ position: 'relative', minHeight: 148 }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={tick}
                  layout
                  initial={reduce ? false : { opacity: 0, y: -14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.45, ease: [0.22, 0.61, 0.24, 1] }}
                  className="l-kot"
                >
                  <div className="l-kot-top">
                    <span className="l-kot-tbl">{topKot.table}</span>
                    <span className="l-tag-new">New</span>
                  </div>
                  {topKot.items.map((it, i) => (
                    <div key={i} className="l-kot-row"><span className="q">{it.q}×</span> {it.name}</div>
                  ))}
                  <div className="l-kot-tear" />
                </motion.div>
              </AnimatePresence>
              <div className="l-kot" style={{ marginTop: 10, opacity: 0.82 }}>
                <div className="l-kot-top">
                  <span className="l-kot-tbl">{secondKot.table}</span>
                  <span className="l-kot-time"><Timer size={10} strokeWidth={2.4} style={{ verticalAlign: -1 }} /> {secondKot.min}:12</span>
                </div>
                {secondKot.items.map((it, i) => (
                  <div key={i} className="l-kot-row"><span className="q">{it.q}×</span> {it.name}</div>
                ))}
                <div className="l-kot-tear" />
              </div>
            </div>
          </div>
        </div>

        {/* Reward toast */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              className="l-toast"
              initial={{ opacity: 0, x: 30, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.5, ease: [0.22, 0.61, 0.24, 1] }}
            >
              <span className="ir"><Gift size={17} strokeWidth={2} /></span>
              <div>
                <div className="tt">+40 points earned</div>
                <div className="ss">Ananya just paid ₹388</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </TiltCard>

      {/* Ambient badge to reinforce "café" identity */}
      <div className="l-float d2" style={{ position: 'absolute', left: -14, top: -24, zIndex: 5 }} aria-hidden>
        <span className="l-badge" style={{ padding: '8px 12px' }}>
          <Coffee size={15} strokeWidth={2} style={{ color: 'var(--l-gold-d)' }} /> Morning service
        </span>
      </div>
    </div>
  );
}
