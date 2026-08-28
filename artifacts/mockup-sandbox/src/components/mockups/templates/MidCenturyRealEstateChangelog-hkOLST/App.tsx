import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Wrench, Bug, BarChart3, Home, Calendar,
  ArrowUpRight, Star, MapPin, Users, TrendingUp, Clock
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid
} from 'recharts';

/* ---------------------------------- DATA ---------------------------------- */

const PALETTE = {
  cream: '#F4ECDD',
  paper: '#FBF6EA',
  walnut: '#4A3327',
  teak: '#7C5A3E',
  rust: '#C2602E',
  teal: '#3E7C74',
  mustard: '#D9A441',
  sage: '#8A9B6E',
};

const adoptionData = [
  { q: 'Q1 ’24', tours: 312, saved: 540 },
  { q: 'Q2 ’24', tours: 428, saved: 712 },
  { q: 'Q3 ’24', tours: 519, saved: 884 },
  { q: 'Q4 ’24', tours: 671, saved: 1093 },
];

const responseData = [
  { m: 'Sep', hrs: 9.2 },
  { m: 'Oct', hrs: 7.4 },
  { m: 'Nov', hrs: 5.8 },
  { m: 'Dec', hrs: 4.1 },
  { m: 'Jan', hrs: 2.9 },
];

const TAGS = {
  new: { label: 'New', color: PALETTE.rust, icon: Sparkles },
  improved: { label: 'Improved', color: PALETTE.teal, icon: Wrench },
  fixed: { label: 'Fixed', color: PALETTE.mustard, icon: Bug },
  report: { label: 'Report', color: PALETTE.sage, icon: BarChart3 },
};

const releases = [
  {
    version: '24.12',
    name: 'The Hearthside Update',
    date: 'December 18, 2024',
    note: 'Our biggest winter release since the office moved off Maple Street. We brought the warmth of the open house to your screen.',
    stats: [
      { label: 'Avg. response time', value: '2.9 hrs', delta: '−61% YoY' },
      { label: 'Virtual tours hosted', value: '671', delta: '+29% QoQ' },
      { label: 'Saved searches', value: '1,093', delta: '+24% QoQ' },
    ],
    chart: 'response',
    items: [
      { tag: 'new', text: '“Front Porch” — a private homepage for every buyer family, with their saved homes, tour history, and agent notes in one place.' },
      { tag: 'new', text: 'Neighborhood Heritage Cards: original build year, architect (when known), and a photo from our 1962–1989 listing archive.' },
      { tag: 'improved', text: 'Tour scheduling now respects agent “supper hours” — no more 6:15pm bookings unless you opt in.' },
      { tag: 'fixed', text: 'Fixed an issue where mid-century listings tagged “Atomic Ranch” weren’t appearing in style filters.' },
      { tag: 'fixed', text: 'Print-friendly listing sheets restored — by popular demand from the Tuesday coffee club.' },
    ],
  },
  {
    version: '24.9',
    name: 'The Open House Almanac',
    date: 'September 30, 2024',
    note: 'A reporting release. Sixty-six years of handshakes, now with charts the whole office can read at a glance.',
    stats: [
      { label: 'Listings closed', value: '184', delta: '+12% QoQ' },
      { label: 'Open houses held', value: '97', delta: '+8% QoQ' },
      { label: 'Repeat families', value: '41%', delta: '3rd-gen clients: 9' },
    ],
    chart: 'adoption',
    items: [
      { tag: 'report', text: 'Quarterly Market Almanac: median days-on-market, sale-to-list ratio, and neighborhood momentum, mailed and emailed.' },
      { tag: 'new', text: 'Generational client tracking — see which families have bought with us across decades (the Hendersons are on home #5).' },
      { tag: 'improved', text: 'Comparative Market Analyses now render in our house style: warm paper tones, legible at arm’s length.' },
      { tag: 'fixed', text: 'Corrected square-footage rounding on pre-1970 listings imported from the county ledger.' },
    ],
  },
  {
    version: '24.6',
    name: 'The Picture Window Release',
    date: 'June 14, 2024',
    note: 'Photography, floor plans, and the little details that make a house feel like somebody’s Sunday afternoon.',
    stats: [
      { label: 'Photos re-shot', value: '2,140', delta: 'Golden hour only' },
      { label: 'Floor plans drawn', value: '128', delta: 'Hand-lettered labels' },
      { label: 'Listing views', value: '48.2k', delta: '+33% QoQ' },
    ],
    chart: null,
    items: [
      { tag: 'new', text: 'Sun-path overlay on every floor plan — know which rooms catch the morning light before you visit.' },
      { tag: 'new', text: '“As It Was” gallery toggle: view archival photos of the home alongside today’s listing shots.' },
      { tag: 'improved', text: 'Faster photo loading on slower connections. Tested on Marge’s computer at the front desk.' },
      { tag: 'improved', text: 'Map pins redrawn as little rooflines — easier to tell ranches from two-stories at a glance.' },
      { tag: 'fixed', text: 'Open house RSVPs no longer double-count when both spouses sign the guest book.' },
    ],
  },
  {
    version: '24.3',
    name: 'The Welcome Mat',
    date: 'March 8, 2024',
    note: 'The first release of our sixty-sixth year. We started where we always start — at the front door.',
    stats: [
      { label: 'New buyer accounts', value: '512', delta: 'First 90 days' },
      { label: 'Agent onboarding', value: '14 of 14', delta: '100% adopted' },
      { label: 'Support calls', value: '−38%', delta: 'vs. legacy portal' },
    ],
    chart: null,
    items: [
      { tag: 'new', text: 'Launched the new client portal, replacing the binder system in use since 1996 (the binders are retired with honors).' },
      { tag: 'new', text: 'Saved searches with gentle weekly digests — no push notifications, ever, on principle.' },
      { tag: 'improved', text: 'Agent profiles now include years with the firm, neighborhoods walked, and a favorite local diner.' },
      { tag: 'fixed', text: 'Resolved sign-in trouble for clients sharing one household email address (a surprisingly common arrangement).' },
    ],
  },
];

/* -------------------------------- HELPERS --------------------------------- */

const Starburst = ({ size = 28, color = PALETTE.rust }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    {[...Array(8)].map((_, i) => (
      <line
        key={i}
        x1="20" y1="20"
        x2={20 + 17 * Math.cos((i * Math.PI) / 4)}
        y2={20 + 17 * Math.sin((i * Math.PI) / 4)}
        stroke={color}
        strokeWidth={i % 2 ? 1.5 : 2.5}
        strokeLinecap="round"
      />
    ))}
    <circle cx="20" cy="20" r="4" fill={color} />
  </svg>
);

const Boomerang = ({ className, color }) => (
  <svg viewBox="0 0 200 120" className={className} fill="none">
    <path d="M10 110 C 60 10, 90 10, 100 40 C 110 10, 140 10, 190 110 C 140 60, 110 55, 100 70 C 90 55, 60 60, 10 110 Z" fill={color} />
  </svg>
);

const Tag = ({ type }) => {
  const t = TAGS[type];
  const Icon = t.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase shrink-0"
      style={{ backgroundColor: t.color, color: PALETTE.paper, borderRadius: '12px 4px 12px 4px' }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {t.label}
    </span>
  );
};

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

/* ---------------------------------- APP ----------------------------------- */

export default function App() {
  const [filter, setFilter] = useState('all');

  const filterOptions = [
    { key: 'all', label: 'Everything' },
    { key: 'new', label: 'New' },
    { key: 'improved', label: 'Improved' },
    { key: 'fixed', label: 'Fixed' },
    { key: 'report', label: 'Reports' },
  ];

  const visibleReleases = releases
    .map((r) => ({
      ...r,
      items: filter === 'all' ? r.items : r.items.filter((i) => i.tag === filter),
    }))
    .filter((r) => r.items.length > 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETTE.cream, color: PALETTE.walnut }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        body { margin: 0; }
        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .font-body { font-family: 'Jost', 'Futura', sans-serif; }
        .paper-grain {
          background-image: radial-gradient(${PALETTE.teak}14 1px, transparent 1px);
          background-size: 22px 22px;
        }
        .release-card {
          box-shadow: 0 1px 0 ${PALETTE.walnut}1a, 0 12px 28px -18px ${PALETTE.walnut}66;
          transition: box-shadow .35s ease, transform .35s ease;
        }
        .release-card:hover {
          box-shadow: 0 1px 0 ${PALETTE.walnut}1a, 0 20px 40px -20px ${PALETTE.walnut}80;
          transform: translateY(-2px);
        }
        .timeline-dot::before {
          content: ''; position: absolute; left: -5px; top: 50%; transform: translateY(-50%);
          width: 10px; height: 10px; border-radius: 50%; background: ${PALETTE.rust};
          border: 2px solid ${PALETTE.cream};
        }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: ${PALETTE.cream}; }
        ::-webkit-scrollbar-thumb { background: ${PALETTE.teak}; border-radius: 5px; border: 2px solid ${PALETTE.cream}; }
        .filter-btn { transition: all .25s ease; }
      `}} />

      {/* ------------------------------ HEADER ------------------------------ */}
      <header className="font-body border-b-4" style={{ borderColor: PALETTE.walnut, backgroundColor: PALETTE.paper }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Starburst size={34} />
            <div>
              <div className="font-display text-xl font-semibold leading-none" style={{ color: PALETTE.walnut }}>
                Marigold &amp; Webb <span style={{ color: PALETTE.rust }}>Realty</span>
              </div>
              <div className="text-[11px] tracking-[0.25em] uppercase mt-1" style={{ color: PALETTE.teak }}>
                Est. 1958 · Glendale Heights
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {['Listings', 'Neighborhoods', 'Our Story'].map((n) => (
              <a key={n} href="#" className="hover:opacity-70 transition-opacity flex items-center gap-1">{n}</a>
            ))}
            <a href="#" className="px-4 py-2 text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
               style={{ backgroundColor: PALETTE.teal, color: PALETTE.paper, borderRadius: '16px 6px 16px 6px' }}>
              Client Portal <ArrowUpRight size={14} />
            </a>
          </nav>
        </div>
      </header>

      {/* -------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden paper-grain" style={{ backgroundColor: PALETTE.paper }}>
        <Boomerang className="absolute -right-16 -top-10 w-72 opacity-[0.12] rotate-12" color={PALETTE.teal} />
        <Boomerang className="absolute -left-20 bottom-0 w-80 opacity-[0.10] -rotate-12" color={PALETTE.rust} />
        <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-16 pb-14 relative">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <div className="flex items-center gap-3 mb-5">
              <span className="font-body text-xs tracking-[0.3em] uppercase font-semibold px-3 py-1.5"
                    style={{ backgroundColor: PALETTE.mustard, color: PALETTE.walnut, borderRadius: '14px 4px 14px 4px' }}>
                Release Notes
              </span>
              <span className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: PALETTE.teak }}>
                Volume 66 · The Client Portal
              </span>
            </div>
            <h1 className="font-display font-semibold leading-[1.05] text-[clamp(2.4rem,5.5vw,4.2rem)] max-w-3xl" style={{ color: PALETTE.walnut }}>
              What’s new around <em style={{ color: PALETTE.rust, fontStyle: 'italic' }}>the house</em>.
            </h1>
            <p className="font-body text-lg mt-5 max-w-2xl leading-relaxed" style={{ color: '#6B5240' }}>
              Sixty-six years ago, Harold Webb kept his change log in a spiral notebook by the rotary phone.
              We keep ours here now — every improvement to the portal, the reports, and the way we welcome
              your family home.
            </p>

            {/* topline stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-10 max-w-3xl"
                 style={{ backgroundColor: PALETTE.walnut + '22', borderRadius: '20px 6px 20px 6px', overflow: 'hidden' }}>
              {[
                { icon: Home, value: '184', label: 'Homes closed in 2024' },
                { icon: Users, value: '41%', label: 'Repeat-family clients' },
                { icon: Clock, value: '2.9 hrs', label: 'Avg. agent response' },
                { icon: TrendingUp, value: '+33%', label: 'Listing views YoY' },
              ].map((s, i) => (
                <div key={i} className="font-body p-5" style={{ backgroundColor: PALETTE.cream }}>
                  <s.icon size={18} style={{ color: PALETTE.teal }} strokeWidth={2.2} />
                  <div className="font-display text-2xl font-semibold mt-2" style={{ color: PALETTE.walnut }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: PALETTE.teak }}>{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ----------------------------- FILTER BAR ---------------------------- */}
      <div className="sticky top-0 z-20 border-b" style={{ backgroundColor: PALETTE.cream + 'F2', borderColor: PALETTE.walnut + '22', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-3 flex items-center gap-2 flex-wrap font-body">
          <span className="text-xs uppercase tracking-[0.2em] font-semibold mr-2" style={{ color: PALETTE.teak }}>Show me</span>
          {filterOptions.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="filter-btn px-4 py-1.5 text-sm font-semibold"
                style={{
                  backgroundColor: active ? PALETTE.walnut : 'transparent',
                  color: active ? PALETTE.paper : PALETTE.walnut,
                  border: `1.5px solid ${PALETTE.walnut}`,
                  borderRadius: '14px 5px 14px 5px',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ----------------------------- RELEASES ------------------------------ */}
      <main className="max-w-6xl mx-auto px-6 lg:px-10 py-14">
        <div className="relative pl-6 md:pl-10" style={{ borderLeft: `2px solid ${PALETTE.walnut}33` }}>
          {visibleReleases.map((r, idx) => (
            <motion.article
              key={r.version}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              className="relative timeline-dot mb-14 last:mb-0"
              style={{ left: 0 }}
            >
              {/* date marker */}
              <div className="font-body flex items-center gap-2 mb-3 text-sm font-medium" style={{ color: PALETTE.teak }}>
                <Calendar size={14} />
                {r.date}
                <span className="px-2 py-0.5 text-xs font-bold tracking-wider"
                      style={{ backgroundColor: PALETTE.walnut, color: PALETTE.mustard, borderRadius: '10px 3px 10px 3px' }}>
                  v{r.version}
                </span>
              </div>

              <div className="release-card p-7 md:p-9" style={{ backgroundColor: PALETTE.paper, borderRadius: '28px 8px 28px 8px', border: `1px solid ${PALETTE.walnut}1f` }}>
                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
                  {/* left column */}
                  <div>
                    <h2 className="font-display text-3xl font-semibold" style={{ color: PALETTE.walnut }}>
                      {r.name}
                    </h2>
                    <p className="font-body mt-2 leading-relaxed" style={{ color: '#6B5240' }}>{r.note}</p>

                    <ul className="mt-6 space-y-4">
                      {r.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 font-body text-[15px] leading-relaxed">
                          <Tag type={item.tag} />
                          <span style={{ color: '#544036' }}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* right column: stats + chart */}
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-px overflow-hidden"
                         style={{ backgroundColor: PALETTE.walnut + '1f', borderRadius: '18px 5px 18px 5px' }}>
                      {r.stats.map((s, i) => (
                        <div key={i} className="font-body p-3.5" style={{ backgroundColor: PALETTE.cream }}>
                          <div className="font-display text-lg font-semibold leading-tight" style={{ color: PALETTE.rust }}>{s.value}</div>
                          <div className="text-[10.5px] uppercase tracking-wide mt-1 font-semibold" style={{ color: PALETTE.walnut }}>{s.label}</div>
                          <div className="text-[10.5px] mt-0.5" style={{ color: PALETTE.teal }}>{s.delta}</div>
                        </div>
                      ))}
                    </div>

                    {r.chart === 'response' && (
                      <div className="p-4 flex-1 min-h-[220px]" style={{ backgroundColor: PALETTE.cream, borderRadius: '18px 5px 18px 5px' }}>
                        <div className="font-body text-xs uppercase tracking-[0.18em] font-semibold mb-2 flex items-center gap-1.5" style={{ color: PALETTE.walnut }}>
                          <Clock size={12} /> Avg. inquiry response (hours)
                        </div>
                        <ResponsiveContainer width="100%" height={170}>
                          <LineChart data={responseData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                            <CartesianGrid stroke={PALETTE.walnut + '1a'} strokeDasharray="2 4" vertical={false} />
                            <XAxis dataKey="m" tick={{ fill: PALETTE.teak, fontSize: 11, fontFamily: 'Jost' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: PALETTE.teak, fontSize: 11, fontFamily: 'Jost' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: PALETTE.walnut, border: 'none', borderRadius: '10px 3px 10px 3px', color: PALETTE.paper, fontFamily: 'Jost', fontSize: 12 }} labelStyle={{ color: PALETTE.mustard }} itemStyle={{ color: PALETTE.paper }} />
                            <Line type="monotone" dataKey="hrs" stroke={PALETTE.rust} strokeWidth={3} dot={{ r: 4, fill: PALETTE.rust, strokeWidth: 0 }} activeDot={{ r: 6, fill: PALETTE.teal }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {r.chart === 'adoption' && (
                      <div className="p-4 flex-1 min-h-[220px]" style={{ backgroundColor: PALETTE.cream, borderRadius: '18px 5px 18px 5px' }}>
                        <div className="font-body text-xs uppercase tracking-[0.18em] font-semibold mb-2 flex items-center gap-1.5" style={{ color: PALETTE.walnut }}>
                          <BarChart3 size={12} /> Portal activity by quarter
                        </div>
                        <ResponsiveContainer width="100%" height={170}>
                          <BarChart data={adoptionData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barGap={3}>
                            <CartesianGrid stroke={PALETTE.walnut + '1a'} strokeDasharray="2 4" vertical={false} />
                            <XAxis dataKey="q" tick={{ fill: PALETTE.teak, fontSize: 11, fontFamily: 'Jost' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: PALETTE.teak, fontSize: 11, fontFamily: 'Jost' }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: PALETTE.walnut + '0d' }} contentStyle={{ backgroundColor: PALETTE.walnut, border: 'none', borderRadius: '10px 3px 10px 3px', fontFamily: 'Jost', fontSize: 12 }} labelStyle={{ color: PALETTE.mustard }} itemStyle={{ color: PALETTE.paper }} />
                            <Bar dataKey="tours" name="Virtual tours" fill={PALETTE.teal} radius={[6, 2, 0, 0]} />
                            <Bar dataKey="saved" name="Saved searches" fill={PALETTE.mustard} radius={[6, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {!r.chart && (
                      <div className="p-5 flex items-center gap-4" style={{ backgroundColor: PALETTE.teal, borderRadius: '18px 5px 18px 5px' }}>
                        <Star size={26} style={{ color: PALETTE.mustard }} fill={PALETTE.mustard} />
                        <p className="font-body text-sm leading-relaxed" style={{ color: PALETTE.paper }}>
                          {idx % 2 === 0
                            ? '“It feels like the listing book Harold used to keep on the coffee table — only it answers back.” — Doris H., client since 1971'
                            : '“The new portal got our youngest agent and our longest-standing client onto the same page. Literally.” — Frank W., Broker'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* archive note */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
          className="mt-16 p-8 md:p-10 relative overflow-hidden"
          style={{ backgroundColor: PALETTE.walnut, borderRadius: '32px 10px 32px 10px' }}
        >
          <Boomerang className="absolute -right-10 -bottom-8 w-64 opacity-[0.14]" color={PALETTE.mustard} />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <Starburst size={22} color={PALETTE.mustard} />
                <span className="font-body text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: PALETTE.mustard }}>The Archive</span>
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-semibold" style={{ color: PALETTE.paper }}>
                Looking for the spiral notebooks?
              </h3>
              <p className="font-body mt-2 max-w-xl leading-relaxed" style={{ color: PALETTE.cream + 'cc' }}>
                Release notes from 2019–2023, plus scanned market reports going back to our first
                mimeographed newsletter in March 1961, live in the archive room — now digitized.
              </p>
            </div>
            <a href="#" className="font-body shrink-0 inline-flex items-center gap-2 px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
               style={{ backgroundColor: PALETTE.rust, color: PALETTE.paper, borderRadius: '18px 6px 18px 6px' }}>
              Browse the archive <ArrowUpRight size={16} />
            </a>
          </div>
        </motion.div>
      </main>

      {/* -------------------------------- FOOTER ------------------------------ */}
      <footer className="font-body border-t-4 mt-4" style={{ borderColor: PALETTE.walnut, backgroundColor: PALETTE.paper }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <Starburst size={20} color={PALETTE.teal} />
            <span className="text-sm" style={{ color: PALETTE.teak }}>
              Marigold &amp; Webb Realty · 412 Crestline Drive, Glendale Heights · Family-run since 1958
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: PALETTE.rust }}>
            <MapPin size={14} />
            <span>Updated by hand, every quarter, with care.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}