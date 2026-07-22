'use client';

import { Check } from 'lucide-react';
import { plans } from './data';
import { Rise, Group, GroupItem } from './primitives';

export function Pricing({ dbPlans }: { dbPlans?: any[] }) {
  const mergedPlans = plans.map((p) => {
    const dbPlan = dbPlans?.find((dp) => dp.key === p.name.toLowerCase());
    if (!dbPlan) return p;

    const prices = (dbPlan.pricePaise ?? {}) as { monthly?: number; yearly?: number };
    const monthlyPrice = prices.monthly;

    if (monthlyPrice !== undefined && monthlyPrice !== null) {
      return {
        ...p,
        price: `₹${(monthlyPrice / 100).toLocaleString('en-IN')}`,
        unit: '/mo',
      };
    }

    return p;
  });

  return (
    <section className="l-section" id="pricing">
      <div className="l-container">
        <Rise>
          <p className="l-eyebrow">Simple, honest pricing</p>
          <h2 className="l-h2">Pricing that scales with your counter.</h2>
          <p className="l-lead">
            Start free for 14 days. No card, no setup fee, and never a cut of your
            sales — you keep every rupee you earn.
          </p>
        </Rise>

        <Group className="l-price-grid" style={{ marginTop: 46 }} stagger={0.1}>
          {mergedPlans.map((p) => (
            <GroupItem key={p.name} style={{ height: '100%' }}>
              <div className={`l-price ${p.popular ? 'pop' : ''}`}>
                {p.popular && <span className="l-price-tag">Most popular</span>}
                <h3 className="l-price-name">{p.name}</h3>
                <p className="l-price-note">{p.note}</p>
                <div className="l-price-amt">{p.price}{p.unit && <small>{p.unit}</small>}</div>
                <ul className="l-price-feats">
                  {p.feats.map((f) => (
                    <li key={f}><Check size={16} strokeWidth={2.4} /> {f}</li>
                  ))}
                </ul>
                <a
                  href={p.cta === 'Book a demo' ? '#contact' : '/login'}
                  className={`l-btn ${p.popular ? 'l-btn-primary' : 'l-btn-dark'}`}
                >
                  {p.cta}
                </a>
              </div>
            </GroupItem>
          ))}
        </Group>
        <p className="l-price-foot">Prices in INR, billed monthly · GST applicable · Cancel anytime.</p>
      </div>
    </section>
  );
}
