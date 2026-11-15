// EarthEar landing sayfası ("/"). Uygulama "/app" altında; buradan ses ya da mikrofon BAŞLAMAZ.
// Metin: content.ts (EN varsayılan, TR). Dil seçimi localStorage 'lang' (uygulamayla ortak) + /app bağlantılarına ?lang=.
import { useEffect, useState } from 'react';
import '../styles/tokens.css';
import './landing.css';
import { C, NAV, REPO, type LLang } from './content.ts';
import { HeroIntro } from './HeroIntro.tsx';

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const initialLang = (): LLang => { try { const s = localStorage.getItem('lang'); return s === 'tr' ? 'tr' : 'en'; } catch { return 'en'; } };

/** Kaydırınca beliren bölüm (reduced-motion'da hemen görünür). */
function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.reveal')];
    if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/** Bölüm: başlık + içerik. Bileşen dışında tanımlı (dil değişince yeniden kurulmasın; "in" sınıfı korunur). */
function Section({ id, eyebrow, title, children, className = '' }: { id: string; eyebrow: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`sec reveal ${className}`} aria-labelledby={`${id}-h`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-h`}>{title}</h2>
      {children}
    </section>
  );
}

export default function Landing() {
  const [lang, setLangS] = useState<LLang>(initialLang);
  const [menu, setMenu] = useState(false);
  const L = (x: { en: string; tr: string }) => x[lang];
  const app = (href = '/app') => `${href}${href.includes('?') ? '&' : '?'}lang=${lang}`;
  const setLang = (l: LLang) => { setLangS(l); try { localStorage.setItem('lang', l); } catch { /* yok say */ } };
  useEffect(() => { document.documentElement.lang = lang; document.title = lang === 'tr' ? 'EarthEar — Değişen gezegeni dinle' : 'EarthEar — Listen to the Changing Planet'; }, [lang]);
  useReveal();
  /** Gerçek GPU ile çekilmiş görüntü: 1× (1440 px) + 2× (2880 px), tembel yükleme. */
  const HAS2X = ['africa-europe', 'canopy', 'globe-lightning', 'night', 'currents', 'radar-aerosol', 'weather'];
  const pic = (name: string, alt: string) => <img src={`/landing/${name}.webp`} srcSet={HAS2X.includes(name) ? `/landing/${name}.webp 1x, /landing/${name}@2x.webp 2x` : undefined} alt={alt} width={name === 'africa-europe' ? 1100 : 1440} height={name === 'africa-europe' ? 740 : 900} loading="lazy" decoding="async" />;

  return (
    <div className="lp">
      <a className="skip" href={app()}>{L(C.skip)}</a>
      <header className="lp-hdr">
        <a className="wordmark" href="#top" aria-label="EarthEar">Earth<span>Ear</span></a>
        <button type="button" className="menu-btn" aria-expanded={menu} aria-controls="lp-nav" onClick={() => setMenu(!menu)}>{L(C.menu)}</button>
        <nav id="lp-nav" className={`lp-nav${menu ? ' open' : ''}`} aria-label={lang === 'tr' ? 'Bölümler' : 'Sections'}>
          <ul>{NAV.map((n) => <li key={n.id}><a href={`#${n.id}`} onClick={() => setMenu(false)}>{n[lang]}</a></li>)}</ul>
          <div className="lang" role="group" aria-label={L(C.langLabel)}>
            {(['en', 'tr'] as LLang[]).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <a className="btn btn-primary btn-sm" href={app()}>{L(C.cta)}</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <HeroIntro skipLabel={L(C.hero.skip)} />
          <div className="hero-copy">
            <p className="brand">{L(C.hero.brand)}</p>
            <h1 id="hero-h">{L(C.hero.title)}</h1>
            <p className="lede">{L(C.hero.text)}</p>
            <div className="btns">
              <a className="btn btn-primary" href={app()}>{L(C.cta)}</a>
              <a className="btn btn-ghost" href="#how">{L(C.hero.how)}</a>
            </div>
          </div>
        </section>

        <Section eyebrow={L(C.why.eyebrow)} title={L(C.why.title)} id="why">
          <p className="intro">{L(C.why.intro)}</p>
          <div className="grid3">{C.why.cards.map((c, i) => <article key={i} className="card"><span className="num" aria-hidden="true">0{i + 1}</span><h3>{L(c.h)}</h3><p>{L(c.p)}</p></article>)}</div>
        </Section>

        <Section id="about" eyebrow={L(C.about.eyebrow)} title={L(C.about.title)}>
          <p className="intro big">{L(C.about.lead)}</p>
          <figure className="shot wide">{pic('africa-europe', L(C.about.shotAlt))}</figure>
          <h3 className="sub">{L(C.about.diffTitle)}</h3>
          <div className="grid3">{C.about.diff.map((c, i) => <article key={i} className="card"><h4>{L(c.h)}</h4><p>{L(c.p)}</p></article>)}</div>
          <h3 className="sub">{L(C.about.useTitle)}</h3>
          <ul className="uses">{C.about.use.map((u, i) => <li key={i}><b>{L(u.b)}</b> {L(u.p)}</li>)}</ul>
        </Section>

        <Section eyebrow={L(C.pillars.eyebrow)} title={L(C.pillars.title)} id="innovation">
          <div className="pillars">{C.pillars.items.map((p, i) => (
            <article key={i} className="pillar">
              {pic(p.img, L(p.alt))}
              <div><h3>{L(p.h)}</h3><p>{L(p.p)}</p></div>
            </article>
          ))}</div>
        </Section>

        <Section id="users" eyebrow={L(C.users.eyebrow)} title={L(C.users.title)}>
          <div className="personas">{C.users.cards.map((c, i) => <article key={i} className={`card${c.main ? ' main' : ''}`}><h3>{L(c.h)}</h3><p>{L(c.p)}</p></article>)}</div>
        </Section>

        <Section id="how" eyebrow={L(C.how.eyebrow)} title={L(C.how.title)}>
          <ol className="steps">{C.how.steps.map((s, i) => <li key={i} className="card"><span className="num" aria-hidden="true">{i + 1}</span><h3>{L(s.k)}</h3><p>{L(s.p)}</p></li>)}</ol>
          <div className="formula" role="group" aria-labelledby="map-h">
            <h3 id="map-h">{L(C.how.mapTitle)}</h3>
            <dl>{C.how.map.map(([a, b], i) => <div key={i}><dt>{L(a)}</dt><dd><span aria-hidden="true">→ </span>{L(b)}</dd></div>)}</dl>
          </div>
        </Section>

        <Section id="data" eyebrow={L(C.data.eyebrow)} title={L(C.data.title)}>
          <p className="intro">{L(C.data.note)}</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="data-h">
            <table className="dt">
              <thead><tr>{C.data.cols.map((c, i) => <th key={i} scope="col">{L(c)}</th>)}</tr></thead>
              <tbody>{C.data.rows.map((r, i) => <tr key={i}><th scope="row">{L(r[0])}</th><td>{L(r[1])}</td><td>{L(r[2])}</td><td>{L(r[3])}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>

        <Section id="cases" eyebrow={L(C.cases.eyebrow)} title={L(C.cases.title)}>
          <div className="grid3 cases">{C.cases.items.map((c, i) => (
            <article key={i} className="card case">
              <h3>{L(c.h)}</h3>
              <p className="meta"><span>{L(C.cases.variable)}:</span> {L(c.v)}</p>
              <p><span className="meta-k">{L(C.cases.hear)}:</span> {L(c.hear)}</p>
              <a className="btn btn-primary btn-sm" href={app(c.href)} aria-label={`${L(C.cases.listen)}: ${L(c.h)}`}>{L(C.cases.listen)}</a>
            </article>
          ))}</div>
        </Section>

        <Section eyebrow={L(C.live.eyebrow)} title={L(C.live.title)} id="live">
          <div className="grid2">{C.live.shots.map((s, i) => <figure key={i} className="shot">{pic(s.img, L(s.cap))}<figcaption>{L(s.cap)}</figcaption></figure>)}</div>
          <p className="center"><a className="btn btn-primary btn-lg" href={app()}>{L(C.live.btn)}</a></p>
        </Section>

        <Section eyebrow={L(C.guide.eyebrow)} title={L(C.guide.title)} id="guide">
          <p className="intro">{L(C.guide.p)}</p>
          <p className="small">{L(C.guide.tested)}</p>
          <ul className="cmds">{C.guide.cmds.map(([c, d]) => <li key={c}><code lang={/[çğışöüİ]|git|aç|nasıl/.test(c) ? 'tr' : 'en'}>“{c}”</code><span>{L(d)}</span></li>)}</ul>
        </Section>

        <Section eyebrow={L(C.concl.eyebrow)} title={L(C.concl.title)} id="conclusion">
          <div className="grid2">{C.concl.cards.map((c, i) => <article key={i} className="card"><h3>{L(c.h)}</h3><p>{L(c.p)}</p></article>)}</div>
          <div className="future">
            <h3>{L(C.concl.futureTitle)}</h3>
            <p className="small">{L(C.concl.futureNote)}</p>
            <ul>{C.concl.future.map((f, i) => <li key={i}>{L(f)}</li>)}</ul>
          </div>
        </Section>

        <Section id="faq" eyebrow={L(C.faq.eyebrow)} title={L(C.faq.title)}>
          <div className="faq">{C.faq.items.map(([q, a], i) => <details key={i}><summary><h3>{L(q)}</h3></summary><p>{L(a)}</p></details>)}</div>
        </Section>

        <Section eyebrow={L(C.sources.eyebrow)} title={L(C.sources.title)} id="sources">
          <ul className="sources">{C.sources.items.map((s) => <li key={s.n}><a href={s.href} target="_blank" rel="noreferrer">{s.n}</a><span>{L(s.d)}</span>{s.credit && <small>{s.credit}</small>}</li>)}</ul>
          <div className="card audit"><h3>{L(C.sources.auditTitle)}</h3><p>{L(C.sources.audit)}</p><a className="btn btn-ghost btn-sm" href={REPO} target="_blank" rel="noreferrer">{L(C.sources.repo)}</a></div>
        </Section>

        <Section eyebrow={L(C.team.eyebrow)} title={L(C.team.title)} id="team">
          <ul className="team">{C.team.members.map(([n, r]) => <li key={n}><b>{n}</b><span>{L(r)}</span></li>)}</ul>
          <p className="small">{L(C.team.event)}</p>
          <h3 className="sub">{L(C.team.soundsTitle)}</h3>
          <p className="small">{L(C.team.sounds)}</p>
        </Section>

        <section className="final reveal" aria-labelledby="final-h">
          <h2 id="final-h">{L(C.final.title)}</h2>
          <p>{L(C.final.text)}</p>
          <a className="btn btn-primary btn-lg" href={app()}>{L(C.cta)}</a>
        </section>
      </main>

      <footer className="lp-foot">
        <nav aria-label={lang === 'tr' ? 'Alt bağlantılar' : 'Footer'}><ul>{NAV.map((n) => <li key={n.id}><a href={`#${n.id}`}>{n[lang]}</a></li>)}<li><a href={REPO} target="_blank" rel="noreferrer">GitHub</a></li></ul></nav>
        <p>{L(C.footer.copy)}</p>
        <p className="small">{L(C.footer.disclaimer)}</p>
      </footer>
    </div>
  );
}
