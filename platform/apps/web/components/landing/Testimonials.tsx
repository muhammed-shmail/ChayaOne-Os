'use client';

import { Star } from 'lucide-react';
import { testimonials, type Testimonial } from './data';
import { Rise } from './primitives';

const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function Quote({ quote, name, cafe }: Testimonial) {
  return (
    <figure className="l-quote">
      <div className="l-stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={15} strokeWidth={0} fill="currentColor" aria-hidden />
        ))}
      </div>
      <blockquote><p>“{quote}”</p></blockquote>
      <figcaption className="who">
        <span className="l-avatar" aria-hidden>{initials(name)}</span>
        <span>
          <span className="nm">{name}</span>
          <span className="co">{cafe}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  // Duplicated once so the marquee can loop seamlessly at -50%.
  const loop = [...testimonials, ...testimonials];
  return (
    <section className="l-section" id="customers">
      <div className="l-container">
        <Rise>
          <p className="l-eyebrow">Loved by café owners</p>
          <h2 className="l-h2">The people behind the counter.</h2>
          <p className="l-lead">
            From filter-coffee institutions to third-wave roasteries — Chaya.One runs
            quietly in the background so owners can get back to their guests.
          </p>
        </Rise>
      </div>
      <div className="l-tst-wrap" style={{ marginTop: 44 }}>
        <div className="l-track">
          {loop.map((t, i) => <Quote key={i} {...t} />)}
        </div>
      </div>
    </section>
  );
}
