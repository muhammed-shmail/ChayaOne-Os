/**
 * Chaya.One landing — self-contained style layer.
 * Everything is scoped under `.landing` and driven by `--l-*` tokens, so it
 * renders identically regardless of the app's global light/dark theme and
 * never leaks into the product surfaces. Delivered as one <style> block (same
 * pattern as TeaLoader) to sidestep global-CSS import ordering.
 */
export function LandingStyles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `
.landing{
  /* Palette (exact brief tokens) + a few derived tints */
  --l-bg:#F8F3EA; --l-card:#FFFDF8; --l-cream:#F3E6D0;
  --l-brown:#6B3E1F; --l-brown-2:#8A5A32;
  --l-gold:#B88A2F; --l-gold-d:#9A7220; --l-gold-l:#D9B45E;
  --l-green:#4F8A5B; --l-border:#E8DCC7;
  --l-ink:#2A2018; --l-ink-2:#6B5A49; --l-ink-3:#9C8A76;
  --l-glass:rgba(255,253,248,.72); --l-glass-line:rgba(232,220,199,.9);
  --l-display:var(--font-landing-display),'Playfair Display',Georgia,serif;
  --l-mono:var(--font-mono),ui-monospace,'SFMono-Regular',Menlo,monospace;
  --l-sh-1:0 1px 2px rgba(74,48,20,.05),0 2px 6px rgba(74,48,20,.05);
  --l-sh-2:0 10px 34px rgba(74,48,20,.10),0 3px 10px rgba(74,48,20,.06);
  --l-sh-3:0 30px 70px rgba(74,48,20,.16),0 10px 24px rgba(74,48,20,.09);
  --l-glow:0 0 0 4px rgba(184,138,47,.14);
  --l-gold-grad:linear-gradient(135deg,#E7C97A 0%,#B88A2F 52%,#9A7220 100%);

  color-scheme:light;
  position:relative;
  min-height:100vh;
  overflow-x:clip;
  background:var(--l-bg);
  color:var(--l-ink);
  font-family:var(--font-landing-body),'Inter',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  font-feature-settings:"cv02","cv03","cv04";
}
.landing :is(h1,h2,h3,h4){
  font-family:var(--l-display);
  font-weight:700; letter-spacing:-.012em; line-height:1.04; color:var(--l-ink);
}
.landing ::selection{ background:var(--l-gold); color:#fff; }
.landing a{ color:inherit; text-decoration:none; }
.landing :where(a,button,input,[tabindex]):focus-visible{
  outline:none; border-radius:12px;
  box-shadow:0 0 0 2px var(--l-bg),0 0 0 4px var(--l-gold);
}
.l-tnum{ font-variant-numeric:tabular-nums; }
.l-mono{ font-family:var(--l-mono); font-variant-numeric:tabular-nums; }

/* ---------- layout ---------- */
.l-container{ width:100%; max-width:1200px; margin:0 auto; padding:0 clamp(20px,5vw,40px); }
.l-section{ position:relative; padding:clamp(72px,10vw,132px) 0; }
.l-section-tight{ padding:clamp(48px,7vw,84px) 0; }

/* ---------- animated background ---------- */
.l-atmos{ position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
.l-orb{ position:absolute; border-radius:50%; filter:blur(70px); opacity:.55;
  will-change:transform; animation:l-drift 22s ease-in-out infinite alternate; }
.l-orb.a{ width:52vw; height:52vw; left:-16vw; top:-14vw;
  background:radial-gradient(circle at 30% 30%,rgba(217,180,94,.55),transparent 62%); }
.l-orb.b{ width:46vw; height:46vw; right:-14vw; top:6vw;
  background:radial-gradient(circle at 50% 50%,rgba(107,62,31,.22),transparent 60%);
  animation-duration:26s; animation-delay:-6s; }
.l-orb.c{ width:48vw; height:48vw; left:24vw; bottom:-22vw;
  background:radial-gradient(circle at 50% 50%,rgba(243,230,208,.9),transparent 60%);
  animation-duration:30s; animation-delay:-12s; }
@keyframes l-drift{
  0%{ transform:translate3d(0,0,0) scale(1); }
  50%{ transform:translate3d(3vw,4vh,0) scale(1.08); }
  100%{ transform:translate3d(-2vw,-3vh,0) scale(.96); }
}
.l-grain{ position:fixed; inset:0; z-index:1; pointer-events:none; opacity:.4; mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E"); }
.l-shell{ position:relative; z-index:2; }

/* ---------- buttons ---------- */
.l-btn{ display:inline-flex; align-items:center; justify-content:center; gap:9px;
  font-family:var(--font-landing-body),Inter,sans-serif; font-weight:600; font-size:15px;
  line-height:1; padding:14px 22px; border-radius:14px; cursor:pointer;
  border:1px solid transparent; transition:transform .25s var(--e,cubic-bezier(.22,.61,.24,1)),
  box-shadow .25s ease, background .25s ease, color .2s ease; white-space:nowrap; }
.l-btn:active{ transform:translateY(0) scale(.985); }
.l-btn-lg{ padding:17px 28px; font-size:16px; border-radius:16px; }
.l-btn-primary{ background:var(--l-gold-grad); color:#33240E; border-color:var(--l-gold-d);
  box-shadow:var(--l-sh-2),inset 0 1px 0 rgba(255,255,255,.4); }
.l-btn-primary:hover{ transform:translateY(-2px); box-shadow:var(--l-sh-3),var(--l-glow),inset 0 1px 0 rgba(255,255,255,.5); }
.l-btn-dark{ background:var(--l-brown); color:#FBF3E4; border-color:var(--l-brown); box-shadow:var(--l-sh-1); }
.l-btn-dark:hover{ transform:translateY(-2px); box-shadow:var(--l-sh-2); background:#5B331A; }
.l-btn-ghost{ background:rgba(255,253,248,.6); color:var(--l-ink); border-color:var(--l-border); box-shadow:var(--l-sh-1); }
.l-btn-ghost:hover{ transform:translateY(-2px); box-shadow:var(--l-sh-2); border-color:var(--l-gold); background:var(--l-card); }
.l-btn .ic{ transition:transform .3s ease; }
.l-btn:hover .ic{ transform:translateX(3px); }

/* ---------- eyebrow / badges ---------- */
.l-eyebrow{ display:inline-flex; align-items:center; gap:9px;
  font-family:var(--font-landing-body),Inter,sans-serif; font-size:12px; font-weight:700;
  letter-spacing:.18em; text-transform:uppercase; color:var(--l-gold-d); }
.l-eyebrow::before{ content:''; width:22px; height:1.5px; background:var(--l-gold); opacity:.7; }
.l-eyebrow.center::after{ content:''; width:22px; height:1.5px; background:var(--l-gold); opacity:.7; }
.l-badge{ display:inline-flex; align-items:center; gap:10px; padding:7px 8px 7px 14px;
  border-radius:999px; background:var(--l-glass); border:1px solid var(--l-glass-line);
  box-shadow:var(--l-sh-1); font-size:13px; font-weight:600; color:var(--l-ink-2);
  backdrop-filter:blur(8px); }
.l-badge .tag{ font-size:11px; font-weight:700; letter-spacing:.04em; color:#33240E;
  background:var(--l-gold-grad); padding:4px 9px; border-radius:999px; }
.l-dot{ width:7px; height:7px; border-radius:50%; background:var(--l-green);
  box-shadow:0 0 0 4px rgba(79,138,91,.18); }
.l-dot.live{ animation:l-blink 2s ease-in-out infinite; }
@keyframes l-blink{ 0%,100%{ opacity:1; } 50%{ opacity:.35; } }

/* ---------- section heading ---------- */
.l-h2{ font-size:clamp(2rem,4.4vw,3.4rem); font-weight:700; margin:16px 0 0; }
.l-lead{ margin-top:18px; font-size:clamp(16px,1.6vw,19px); line-height:1.6; color:var(--l-ink-2); max-width:60ch; }
.l-em{ font-style:italic; color:var(--l-gold-d); }

/* ---------- nav ---------- */
.l-nav{ position:fixed; top:0; left:0; right:0; z-index:60;
  transition:padding .3s ease, background .3s ease; padding:16px 0; }
.l-nav-inner{ display:flex; align-items:center; gap:20px; padding:10px 12px 10px 18px;
  border-radius:18px; border:1px solid transparent; transition:all .35s ease; }
.l-nav.scrolled .l-nav-inner{ background:var(--l-glass); border-color:var(--l-glass-line);
  box-shadow:var(--l-sh-2); backdrop-filter:blur(14px) saturate(1.1); }
.l-brand{ display:flex; align-items:center; gap:11px; margin-right:auto; }
.l-brand img{ height:38px; width:auto; object-fit:contain; }
.l-brand .wm{ font-family:var(--l-display); font-weight:700; font-size:22px; letter-spacing:-.01em; }
.l-brand .wm b{ color:var(--l-gold-d); font-weight:700; }
.l-menu{ display:flex; align-items:center; gap:4px; }
.l-nav-link{ position:relative; font-size:14.5px; font-weight:500; color:var(--l-ink-2);
  padding:9px 14px; border-radius:10px; transition:color .2s ease; }
.l-nav-link::after{ content:''; position:absolute; left:14px; right:14px; bottom:6px; height:1.5px;
  background:var(--l-gold); transform:scaleX(0); transform-origin:left; transition:transform .3s cubic-bezier(.22,.61,.24,1); }
.l-nav-link:hover{ color:var(--l-ink); }
.l-nav-link:hover::after{ transform:scaleX(1); }
.l-nav-actions{ display:flex; align-items:center; gap:10px; }
.l-burger{ display:none; align-items:center; justify-content:center; width:44px; height:44px;
  border-radius:12px; border:1px solid var(--l-border); background:var(--l-glass); color:var(--l-ink); }

/* mobile drawer */
.l-drawer-scrim{ position:fixed; inset:0; z-index:70; background:rgba(42,32,24,.4); backdrop-filter:blur(3px); }
.l-drawer{ position:fixed; z-index:71; top:12px; right:12px; left:12px;
  background:var(--l-card); border:1px solid var(--l-border); border-radius:22px;
  box-shadow:var(--l-sh-3); padding:16px; }
.l-drawer-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.l-drawer-link{ display:block; padding:14px 12px; font-size:16px; font-weight:600; color:var(--l-ink);
  border-radius:12px; }
.l-drawer-link:hover{ background:var(--l-cream); }
.l-drawer .l-btn{ width:100%; }

/* ---------- hero ---------- */
.l-hero{ padding-top:clamp(112px,15vh,168px); padding-bottom:clamp(56px,8vw,96px); position:relative; }
.l-cursor{ position:absolute; z-index:0; width:520px; height:520px; border-radius:50%; pointer-events:none;
  transform:translate(-50%,-50%); left:var(--mx,60%); top:var(--my,32%);
  background:radial-gradient(circle,rgba(184,138,47,.14),transparent 66%);
  transition:left .5s ease-out, top .5s ease-out; opacity:.9; }
/* minmax(0,…) so a track can shrink below its content's min-width — otherwise
   the dashboard's intrinsic width blows the row past the viewport and the hero
   heading overflows + clips (under overflow-x:clip) on narrow screens. */
.l-hero-grid{ position:relative; z-index:2; display:grid;
  grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);
  gap:clamp(28px,4vw,56px); align-items:center; }
.l-hero-title{ font-size:clamp(2rem,7.2vw,4.6rem); line-height:1.04; font-weight:700;
  letter-spacing:-.02em; margin:22px 0 0; }
.l-hero-sub{ margin-top:24px; font-size:clamp(16px,1.55vw,19px); line-height:1.62;
  color:var(--l-ink-2); max-width:42ch; }
.l-hero-cta{ display:flex; flex-wrap:wrap; gap:14px; margin-top:34px; }
.l-trusts{ display:flex; flex-wrap:wrap; gap:18px 26px; margin-top:34px; }
.l-trust{ display:inline-flex; align-items:center; gap:9px; font-size:13.5px; font-weight:600; color:var(--l-ink-2); }
.l-trust svg{ color:var(--l-green); }

/* letter reveal for hero heading */
.l-word{ display:inline-block; }
.l-char{ display:inline-block; will-change:transform; }

/* ---------- living counter (signature) ---------- */
.l-counter{ position:relative; z-index:2; perspective:1400px; }
.l-counter-stage{ position:relative; }
.l-float{ animation:l-float 7s ease-in-out infinite; }
.l-float.d1{ animation-duration:8.5s; animation-delay:-2s; }
.l-float.d2{ animation-duration:9.5s; animation-delay:-4s; }
@keyframes l-float{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-12px); } }

.l-panel{ background:var(--l-card); border:1px solid var(--l-glass-line); border-radius:22px;
  box-shadow:var(--l-sh-3); overflow:hidden; }
.l-panel-head{ display:flex; align-items:center; gap:9px; padding:13px 16px; border-bottom:1px solid var(--l-border);
  background:linear-gradient(180deg,rgba(243,230,208,.5),transparent); }
.l-panel-head .ttl{ font-size:12.5px; font-weight:700; letter-spacing:.02em; color:var(--l-ink); display:flex; align-items:center; gap:8px; }
.l-panel-head .ttl svg{ color:var(--l-gold-d); }
.l-panel-head .rt{ margin-left:auto; }

.l-counter-main{ display:grid; grid-template-columns:1.15fr .85fr; gap:16px; align-items:start; }
.l-counter-col{ display:flex; flex-direction:column; gap:16px; }

/* revenue card */
.l-rev-amt{ font-family:var(--l-display); font-weight:700; font-size:clamp(26px,3.4vw,36px); letter-spacing:-.01em; }
.l-rev-sub{ font-size:12px; color:var(--l-ink-3); font-weight:600; }
.l-rev-up{ color:var(--l-green); font-weight:700; font-size:12px; display:inline-flex; align-items:center; gap:3px; }
.l-spark{ display:flex; align-items:flex-end; gap:5px; height:56px; margin-top:14px; }
.l-spark i{ flex:1; border-radius:5px 5px 3px 3px; background:linear-gradient(180deg,var(--l-gold-l),var(--l-gold));
  transition:height .8s cubic-bezier(.22,.61,.24,1); min-height:6px; }
.l-spark i.hot{ background:linear-gradient(180deg,#E7C97A,var(--l-brown-2)); }

/* KOT tickets */
.l-kot{ position:relative; background:#FFFBF2; border:1px solid var(--l-border); border-radius:12px;
  padding:12px 13px 14px; box-shadow:var(--l-sh-1); }
.l-kot + .l-kot{ margin-top:10px; }
.l-kot-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.l-kot-tbl{ font-size:12px; font-weight:800; color:var(--l-brown); font-family:var(--l-mono); letter-spacing:.02em; }
.l-kot-time{ font-size:10.5px; font-weight:700; color:var(--l-ink-3); font-family:var(--l-mono); }
.l-kot-row{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--l-ink-2); padding:2px 0; }
.l-kot-row .q{ font-family:var(--l-mono); font-weight:700; color:var(--l-gold-d); font-size:11.5px;
  min-width:20px; }
.l-kot-tear{ height:8px; margin:0 -13px -14px; margin-top:10px;
  background:radial-gradient(circle at 6px -2px,transparent 5px,var(--l-border) 5px,transparent 6px) repeat-x;
  background-size:12px 8px; opacity:.7; }
.l-tag-new{ font-size:9.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#fff;
  background:var(--l-green); padding:3px 7px; border-radius:6px; }

/* receipt / bill */
.l-receipt-row{ display:flex; align-items:center; justify-content:space-between; font-size:12.5px; padding:5px 0;
  color:var(--l-ink-2); border-bottom:1px dashed var(--l-border); }
.l-receipt-row .nm{ display:flex; gap:8px; }
.l-receipt-row .amt{ font-family:var(--l-mono); font-weight:600; color:var(--l-ink); }
.l-receipt-tot{ display:flex; align-items:center; justify-content:space-between; margin-top:9px; padding-top:10px;
  border-top:1.5px solid var(--l-ink); font-weight:800; font-size:14px; }
.l-receipt-tot .amt{ font-family:var(--l-mono); }

/* reward toast */
.l-toast{ position:absolute; right:-6px; bottom:-14px; z-index:6; display:flex; align-items:center; gap:11px;
  padding:11px 15px 11px 12px; background:var(--l-card); border:1px solid var(--l-glass-line);
  border-radius:15px; box-shadow:var(--l-sh-3); width:230px; }
.l-toast .ir{ width:34px; height:34px; border-radius:11px; display:grid; place-items:center;
  background:linear-gradient(135deg,rgba(184,138,47,.16),rgba(184,138,47,.06)); color:var(--l-gold-d); flex:none; }
.l-toast .tt{ font-size:12.5px; font-weight:700; color:var(--l-ink); }
.l-toast .ss{ font-size:11px; color:var(--l-ink-3); font-weight:600; }

/* ---------- feature chips ---------- */
.l-chips{ display:flex; flex-wrap:wrap; gap:12px; justify-content:center; }
.l-chip{ display:inline-flex; align-items:center; gap:9px; padding:11px 17px 11px 13px; border-radius:999px;
  background:var(--l-card); border:1px solid var(--l-border); box-shadow:var(--l-sh-1);
  font-size:14px; font-weight:600; color:var(--l-ink-2);
  transition:transform .28s cubic-bezier(.22,.61,.24,1),box-shadow .28s ease,border-color .28s ease,background .28s ease,color .2s ease; }
.l-chip .ci{ display:grid; place-items:center; width:28px; height:28px; border-radius:9px;
  background:rgba(184,138,47,.1); color:var(--l-gold-d); transition:transform .3s ease; }
.l-chip:hover{ transform:translateY(-4px); box-shadow:var(--l-sh-2); border-color:var(--l-gold); color:var(--l-ink); background:var(--l-card); }
.l-chip:hover .ci{ transform:rotate(-8deg) scale(1.06); }

/* ---------- stats ---------- */
.l-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:clamp(14px,2vw,22px); }
.l-stat{ position:relative; padding:26px 22px; border-radius:20px; background:var(--l-card);
  border:1px solid var(--l-border); box-shadow:var(--l-sh-1); overflow:hidden; }
.l-stat::before{ content:''; position:absolute; left:22px; top:0; width:34px; height:3px; border-radius:0 0 3px 3px; background:var(--l-gold-grad); }
.l-stat-num{ font-family:var(--l-display); font-weight:700; font-size:clamp(1.9rem,3.6vw,2.9rem);
  letter-spacing:-.01em; line-height:1; color:var(--l-brown); }
.l-stat-label{ margin-top:9px; font-size:13.5px; font-weight:600; color:var(--l-ink-2); }

/* ---------- feature cards ---------- */
.l-cards-hero{ display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(16px,2vw,22px); }
.l-cards-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:clamp(14px,1.6vw,18px); margin-top:22px; }
.l-zone{ font-size:11.5px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--l-gold-d);
  display:flex; align-items:center; gap:8px; }
.l-zone::after{ content:''; flex:1; height:1px; background:var(--l-border); }

.l-fcard{ position:relative; display:flex; flex-direction:column; height:100%;
  padding:22px; border-radius:24px; background:var(--l-glass); border:1px solid var(--l-glass-line);
  box-shadow:var(--l-sh-2); backdrop-filter:blur(10px); overflow:hidden;
  transition:box-shadow .35s ease,border-color .35s ease,background .35s ease; }
.l-fcard::after{ content:''; position:absolute; inset:0; border-radius:24px; pointer-events:none;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55); }
.l-fcard:hover{ box-shadow:var(--l-sh-3),var(--l-glow); border-color:var(--l-gold); }
.l-fcard-icon{ display:grid; place-items:center; width:50px; height:50px; border-radius:15px; flex:none;
  background:linear-gradient(140deg,rgba(184,138,47,.16),rgba(184,138,47,.05));
  border:1px solid rgba(184,138,47,.22); color:var(--l-gold-d);
  transition:transform .4s cubic-bezier(.22,.61,.24,1); }
.l-fcard:hover .l-fcard-icon{ transform:rotate(-9deg) scale(1.05); }
.l-fcard-title{ font-family:var(--l-display); font-weight:700; font-size:20px; margin-top:16px; letter-spacing:-.01em; }
.l-fcard-desc{ margin-top:8px; font-size:14px; line-height:1.55; color:var(--l-ink-2); }
.l-fcard-head{ display:flex; align-items:flex-start; justify-content:space-between; }
.l-live{ display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:800; letter-spacing:.05em;
  text-transform:uppercase; color:var(--l-green); background:rgba(79,138,91,.1); border:1px solid rgba(79,138,91,.22);
  padding:5px 9px; border-radius:999px; }
.l-fcard-arrow{ margin-top:auto; display:inline-flex; align-items:center; gap:7px; padding-top:16px;
  font-size:13px; font-weight:700; color:var(--l-gold-d); }
.l-fcard-arrow svg{ transition:transform .3s ease; }
.l-fcard:hover .l-fcard-arrow svg{ transform:translateX(4px); }
.l-fcard-illus{ margin-top:16px; }

/* small (grid) card */
.l-scard{ position:relative; padding:20px; border-radius:20px; background:var(--l-card);
  border:1px solid var(--l-border); box-shadow:var(--l-sh-1); height:100%;
  transition:transform .3s cubic-bezier(.22,.61,.24,1),box-shadow .3s ease,border-color .3s ease; }
.l-scard:hover{ transform:translateY(-5px); box-shadow:var(--l-sh-2); border-color:var(--l-gold); }
.l-scard-icon{ display:grid; place-items:center; width:42px; height:42px; border-radius:12px;
  background:rgba(184,138,47,.1); color:var(--l-gold-d); transition:transform .35s ease; }
.l-scard:hover .l-scard-icon{ transform:rotate(-8deg); }
.l-scard-title{ font-family:var(--l-display); font-weight:700; font-size:17px; margin-top:14px; }
.l-scard-desc{ margin-top:6px; font-size:13px; line-height:1.5; color:var(--l-ink-2); }

/* mini illustrations inside feature cards */
.l-mini{ border-radius:14px; border:1px solid var(--l-border); background:#FFFBF2; padding:12px; }
.l-mini-bars{ display:flex; align-items:flex-end; gap:6px; height:52px; }
.l-mini-bars i{ flex:1; border-radius:4px; background:linear-gradient(180deg,var(--l-gold-l),var(--l-gold)); animation:l-grow 2.4s ease-in-out infinite; }
.l-mini-bars i:nth-child(2){ animation-delay:.2s } .l-mini-bars i:nth-child(3){ animation-delay:.4s }
.l-mini-bars i:nth-child(4){ animation-delay:.6s } .l-mini-bars i:nth-child(5){ animation-delay:.8s }
@keyframes l-grow{ 0%,100%{ transform:scaleY(.62); transform-origin:bottom; } 50%{ transform:scaleY(1); } }
.l-mini-row{ display:flex; justify-content:space-between; font-size:11.5px; padding:4px 0; color:var(--l-ink-2);
  border-bottom:1px dashed var(--l-border); }
.l-mini-row .m{ font-family:var(--l-mono); font-weight:600; color:var(--l-ink); }
.l-mini-row:last-child{ border:0; }

/* ---------- pricing ---------- */
.l-price-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:20px; align-items:stretch; }
.l-price{ position:relative; display:flex; flex-direction:column; padding:28px; border-radius:24px;
  background:var(--l-card); border:1px solid var(--l-border); box-shadow:var(--l-sh-1); height:100%; }
.l-price.pop{ background:linear-gradient(180deg,#2F1C0E,#4A2A13); color:#F6ECD9; border-color:#4A2A13; box-shadow:var(--l-sh-3); }
.l-price.pop :is(h3){ color:#FBF3E4; }
.l-price-tag{ position:absolute; top:-13px; left:50%; transform:translateX(-50%); font-size:11px; font-weight:800;
  letter-spacing:.08em; text-transform:uppercase; color:#33240E; background:var(--l-gold-grad); padding:6px 14px;
  border-radius:999px; box-shadow:var(--l-sh-2); }
.l-price-name{ font-family:var(--l-display); font-size:22px; font-weight:700; }
.l-price-note{ font-size:13px; color:var(--l-ink-2); margin-top:5px; }
.l-price.pop .l-price-note{ color:rgba(246,236,217,.72); }
.l-price-amt{ font-family:var(--l-display); font-weight:700; font-size:40px; margin:18px 0 2px; letter-spacing:-.01em; }
.l-price-amt small{ font-family:var(--font-landing-body),Inter,sans-serif; font-size:14px; font-weight:600; color:var(--l-ink-3); }
.l-price.pop .l-price-amt small{ color:rgba(246,236,217,.6); }
.l-price-feats{ list-style:none; padding:0; margin:20px 0 24px; display:flex; flex-direction:column; gap:11px; }
.l-price-feats li{ display:flex; gap:10px; font-size:13.5px; line-height:1.4; color:var(--l-ink-2); }
.l-price.pop .l-price-feats li{ color:rgba(246,236,217,.82); }
.l-price-feats svg{ color:var(--l-green); flex:none; margin-top:1px; }
.l-price.pop .l-price-feats svg{ color:var(--l-gold-l); }
.l-price .l-btn{ margin-top:auto; width:100%; }
.l-price-foot{ text-align:center; margin-top:20px; font-size:13px; color:var(--l-ink-3); }

/* ---------- testimonials ---------- */
.l-tst-wrap{ position:relative; overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent); }
.l-track{ display:flex; gap:20px; width:max-content; animation:l-marquee 46s linear infinite; }
.l-tst-wrap:hover .l-track{ animation-play-state:paused; }
@keyframes l-marquee{ to{ transform:translateX(-50%); } }
.l-quote{ width:min(86vw,380px); flex:none; padding:26px; border-radius:22px; background:var(--l-glass);
  border:1px solid var(--l-glass-line); box-shadow:var(--l-sh-2); backdrop-filter:blur(8px);
  display:flex; flex-direction:column; }
.l-stars{ display:flex; gap:3px; color:var(--l-gold); margin-bottom:14px; }
.l-quote p{ font-size:15.5px; line-height:1.62; color:var(--l-ink); font-weight:500; }
.l-quote .who{ display:flex; align-items:center; gap:12px; margin-top:20px; }
.l-avatar{ width:44px; height:44px; border-radius:50%; flex:none; display:grid; place-items:center;
  font-family:var(--l-display); font-weight:700; font-size:17px; color:#33240E;
  background:var(--l-gold-grad); box-shadow:inset 0 1px 0 rgba(255,255,255,.4); }
.l-quote .nm{ font-weight:700; font-size:14px; color:var(--l-ink); }
.l-quote .co{ font-size:12.5px; color:var(--l-ink-3); font-weight:600; }

/* ---------- cta band ---------- */
.l-cta-band{ position:relative; overflow:hidden; border-radius:32px; padding:clamp(40px,6vw,72px);
  background:linear-gradient(135deg,#2F1C0E 0%,#4A2A13 60%,#6B3E1F 100%); color:#F7EEDD; box-shadow:var(--l-sh-3); }
.l-cta-band::before{ content:''; position:absolute; width:420px; height:420px; right:-90px; top:-160px; border-radius:50%;
  background:radial-gradient(circle,rgba(217,180,94,.4),transparent 65%); }
.landing .l-cta-h{ position:relative; font-family:var(--l-display); font-weight:700; color:#FCF5E7;
  font-size:clamp(1.9rem,4vw,3rem); line-height:1.06; letter-spacing:-.01em; }
.l-cta-p{ position:relative; margin-top:16px; font-size:17px; line-height:1.6; color:rgba(247,238,221,.82); max-width:52ch; }
.l-cta-actions{ position:relative; display:flex; flex-wrap:wrap; gap:14px; margin-top:30px; }

/* ---------- about strip ---------- */
.l-about{ display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; }
.l-about .n7{ font-family:var(--l-display); font-weight:700; color:var(--l-brown); }

/* ---------- footer ---------- */
.l-footer{ position:relative; z-index:2; border-top:1px solid var(--l-border); background:rgba(255,253,248,.5); }
.l-foot-grid{ display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:36px 24px; }
.l-foot-col h4{ font-family:var(--font-landing-body),Inter,sans-serif; font-size:12px; font-weight:800;
  letter-spacing:.12em; text-transform:uppercase; color:var(--l-ink-3); margin-bottom:14px; }
.l-foot-link{ display:block; font-size:14px; color:var(--l-ink-2); padding:6px 0; transition:color .2s ease; width:fit-content; }
.l-foot-link:hover{ color:var(--l-gold-d); }
.l-foot-brand p{ margin-top:14px; font-size:14px; line-height:1.6; color:var(--l-ink-2); max-width:34ch; }
.l-social{ display:flex; gap:10px; margin-top:18px; }
.l-social a{ display:grid; place-items:center; width:40px; height:40px; border-radius:12px;
  border:1px solid var(--l-border); background:var(--l-card); color:var(--l-ink-2); transition:all .25s ease; }
.l-social a:hover{ color:var(--l-gold-d); border-color:var(--l-gold); transform:translateY(-2px); box-shadow:var(--l-sh-1); }
.l-foot-bottom{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px;
  margin-top:44px; padding-top:22px; border-top:1px solid var(--l-border); font-size:13px; color:var(--l-ink-3); }
.l-madein{ display:inline-flex; align-items:center; gap:7px; font-weight:600; }
.l-madein svg{ color:var(--l-gold-d); }

/* ---------- loading screen ---------- */
.l-load{ position:fixed; inset:0; z-index:200; display:grid; place-items:center; background:var(--l-bg); }
.l-load-in{ display:flex; flex-direction:column; align-items:center; gap:22px; }
.l-glass-cup{ position:relative; width:74px; height:92px; }
.l-glass-body{ position:absolute; left:8px; right:8px; bottom:0; top:14px; overflow:hidden;
  border:2px solid var(--l-brown); border-top:0; border-radius:5px 5px 20px 20px / 5px 5px 30px 30px;
  background:rgba(255,253,248,.6); }
.l-glass-tea{ position:absolute; left:0; right:0; bottom:0; height:0;
  background:var(--l-gold-grad); animation:l-fill 2.1s cubic-bezier(.5,0,.3,1) forwards; }
.l-glass-steam{ position:absolute; left:14px; right:14px; top:-18px; display:flex; justify-content:space-between; }
.l-glass-steam i{ width:3px; height:20px; border-radius:3px; background:var(--l-brown-2); opacity:0;
  animation:l-steam 2.4s ease-in-out infinite; }
.l-glass-steam i:nth-child(2){ animation-delay:.5s } .l-glass-steam i:nth-child(3){ animation-delay:1s }
.l-load img{ height:34px; }
.l-load-cap{ font-size:14px; font-weight:600; color:var(--l-ink-2); letter-spacing:.01em; }
.l-progress{ width:220px; height:5px; border-radius:999px; background:var(--l-border); overflow:hidden; }
.l-progress i{ display:block; height:100%; width:0; border-radius:999px; background:var(--l-gold-grad);
  animation:l-load-bar 2s cubic-bezier(.4,0,.2,1) forwards; }
@keyframes l-fill{ 0%{ height:6%; } 100%{ height:78%; } }
@keyframes l-steam{ 0%{ opacity:0; transform:translateY(6px) scaleY(.6); } 40%{ opacity:.5; } 100%{ opacity:0; transform:translateY(-14px) scaleY(1.15); } }
@keyframes l-load-bar{ 0%{ width:4%; } 55%{ width:66%; } 100%{ width:100%; } }

/* ---------- responsive ---------- */
@media (max-width:1000px){
  .l-hero-grid{ grid-template-columns:minmax(0,1fr); gap:44px; }
  .l-counter{ max-width:560px; margin:0 auto; }
  .l-cards-hero{ grid-template-columns:1fr 1fr; }
  .l-cards-grid{ grid-template-columns:repeat(3,1fr); }
  .l-foot-grid{ grid-template-columns:1fr 1fr; }
}
@media (max-width:860px){
  .l-menu{ display:none; }
  .l-burger{ display:inline-flex; }
  .l-nav-actions .l-desk{ display:none; }
  .l-price-grid{ grid-template-columns:1fr; max-width:440px; margin:0 auto; }
  .l-price.pop{ order:-1; }
}
@media (max-width:640px){
  .l-stats{ grid-template-columns:1fr 1fr; }
  .l-cards-hero{ grid-template-columns:1fr; }
  .l-cards-grid{ grid-template-columns:1fr 1fr; }
  .l-counter-main{ grid-template-columns:1fr; }
  .l-foot-grid{ grid-template-columns:1fr; gap:26px; }
  .l-hero-cta .l-btn{ flex:1 1 100%; }
}
@media (max-width:420px){
  .l-cards-grid{ grid-template-columns:1fr; }
}

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion:reduce){
  .landing *,.landing *::before,.landing *::after{
    animation-duration:.001ms !important; animation-iteration-count:1 !important;
    transition-duration:.001ms !important;
  }
  .l-glass-tea{ height:64% !important; }
  .l-track{ transform:none !important; }
  .l-orb{ opacity:.4; }
}
`;
