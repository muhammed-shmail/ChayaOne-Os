'use client';

import { ArrowUpRight, Sparkles } from 'lucide-react';
import { chips, heroCards, gridCards } from './data';
import { Rise, Group, GroupItem, TiltCard } from './primitives';

/* ---- tiny live illustrations, one per marquee card ---- */
function PosMini() {
  return (
    <div className="l-mini l-fcard-illus">
      <div className="l-mini-row"><span>2× Filter Coffee</span><span className="m">₹120</span></div>
      <div className="l-mini-row"><span>1× Masala Dosa</span><span className="m">₹90</span></div>
      <div className="l-mini-row" style={{ borderBottom: 0, fontWeight: 700, color: 'var(--l-ink)' }}>
        <span>Total · incl GST</span><span className="m">₹220.50</span>
      </div>
    </div>
  );
}
function KdsMini() {
  return (
    <div className="l-mini l-fcard-illus">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span className="l-kot-tbl">Table 07</span>
        <span className="l-tag-new">Firing</span>
      </div>
      <div className="l-mini-row"><span>2× Cappuccino</span><span className="m">02:14</span></div>
      <div className="l-mini-row" style={{ borderBottom: 0 }}><span>1× Croissant</span><span className="m">00:48</span></div>
    </div>
  );
}
function DashMini() {
  const bars = [52, 74, 60, 88, 68];
  return (
    <div className="l-mini l-fcard-illus">
      <div className="l-mini-bars" aria-hidden>
        {bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 11, fontSize: 12, lineHeight: 1.4, color: 'var(--l-ink-2)' }}>
        <Sparkles size={14} strokeWidth={2} style={{ color: 'var(--l-gold-d)', flex: 'none', marginTop: 1 }} />
        <span><b style={{ color: 'var(--l-ink)' }}>AI ·</b> Push cold brew at 4pm — margins peak then.</span>
      </div>
    </div>
  );
}
const MINIS = [PosMini, KdsMini, DashMini];

export function ChipsBand() {
  return (
    <section className="l-section-tight" aria-label="Everything included">
      <div className="l-container">
        <Rise>
          <p className="l-eyebrow center" style={{ justifyContent: 'center', display: 'flex', marginBottom: 26 }}>
            One system · every capability
          </p>
        </Rise>
        <Group className="l-chips">
          {chips.map(({ Icon, label }) => (
            <GroupItem key={label} y={16}>
              <span className="l-chip">
                <span className="ci"><Icon size={17} strokeWidth={2} /></span>
                {label}
              </span>
            </GroupItem>
          ))}
        </Group>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="l-section" id="features">
      <div className="l-container">
        <Rise>
          <p className="l-eyebrow">Built around your café</p>
          <h2 className="l-h2">From the counter to the kitchen<br />to the books.</h2>
          <p className="l-lead">
            Chaya.One isn’t a bundle of apps. It’s one operating system where every
            part of your café talks to the next — so a tap at the till lands in the
            kitchen, updates stock, and rewards a regular, all at once.
          </p>
        </Rise>

        <div className="l-cards-hero" style={{ marginTop: 46 }}>
          {heroCards.map((card, i) => {
            const Mini = MINIS[i] ?? PosMini;
            const Icon = card.Icon;
            return (
              <Rise key={card.title} delay={i * 0.08} style={{ height: '100%' }}>
                <TiltCard className="l-fcard" style={{ height: '100%' }} max={7}>
                  <div className="l-fcard-head">
                    <span className="l-fcard-icon"><Icon size={24} strokeWidth={2} /></span>
                    {card.live && <span className="l-live"><span className="l-dot live" /> Live</span>}
                  </div>
                  <span style={{ marginTop: 16, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--l-gold-d)' }}>
                    {card.zone}
                  </span>
                  <h3 className="l-fcard-title" style={{ marginTop: 4 }}>{card.title}</h3>
                  <p className="l-fcard-desc">{card.desc}</p>
                  <Mini />
                  <span className="l-fcard-arrow">Explore <ArrowUpRight size={16} strokeWidth={2.2} /></span>
                </TiltCard>
              </Rise>
            );
          })}
        </div>

        <Group className="l-cards-grid">
          {gridCards.map(({ Icon, title, desc }) => (
            <GroupItem key={title} style={{ height: '100%' }}>
              <div className="l-scard">
                <span className="l-scard-icon"><Icon size={20} strokeWidth={2} /></span>
                <h3 className="l-scard-title">{title}</h3>
                <p className="l-scard-desc">{desc}</p>
              </div>
            </GroupItem>
          ))}
        </Group>
      </div>
    </section>
  );
}
