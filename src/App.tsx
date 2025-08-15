import { useEffect, useState } from 'react';

export default function App() {
  const [route, setRoute] = useState<'home' | 'about' | 'dashboards' | 'contact'>('home');
  const [openReport, setOpenReport] = useState<string | null>(null);

  // Add preview image paths (place files in /public/previews/*.jpg)
  const reports: { id: string; title: string; src: string; preview?: string }[] = [
    {
      id: 'r1',
      title: 'Executive Sales Insights',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNjMxY2M3ZDAtNzIzZi00MWI1LWE0ZmQtZDdjMDcwNzBiMjE4IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/sales.jpg',
    },
    {
      id: 'r2',
      title: 'Geocoding Compliance',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiOTBkNGI1Y2ItMmJjZC00ZmViLWJlZDUtMjkwNmI2MjYyYzhhIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/geo.jpg',
    },
    {
      id: 'r3',
      title: 'Hotel Booking Analysis',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNGJkNWQ0NDYtMDMwOS00NjE3LWE4Y2MtYjRjMWUxZDExYTE2IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/hotel.jpg',
    },
    {
      id: 'r4',
      title: 'Global Steel KPI Matrix',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNWRjNjEwYmUtODNkMS00MzI5LTk5M2YtYmE4MDkzNDhjMmNmIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/steel.jpg',
    },
    // r5 left as-is; you can add a Qlik URL + preview later
    { id: 'r5', title: 'Under Construction', src: '' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 selection:bg-fuchsia-500/30 selection:text-slate-100">
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img
              src="/PVFavicon.png"
              alt="Power Visualize"
              className="h-12 w-auto"
            />
  <span className="font-semibold tracking-wide">PowerVisualize</span>
</div>

          <nav className="flex items-center gap-2 text-sm">
            {(['home', 'about', 'dashboards', 'contact'] as const).map((key) => (
              <button
                key={key}
                onClick={() => { setRoute(key); setOpenReport(null); }}
                className={`px-3 py-2 rounded-xl transition-all duration-200 hover:bg-slate-800 hover:translate-y-[-1px] ${
                  route === key ? 'bg-slate-800 ring-1 ring-slate-700' : 'border border-transparent'
                }`}
              >
                {key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
            <a
              href="mailto:rowens@powervisualize.com"
              className="ml-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-all duration-200 hover:translate-y-[-1px]"
            >
              Email
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {route === 'home' && <Home setRoute={setRoute} />}
        {route === 'about' && <About />}
        {route === 'dashboards' && (
          openReport ? (
            <ReportViewer report={reports.find((r) => r.id === openReport)!} onBack={() => setOpenReport(null)} />
          ) : (
            <DashboardList reports={reports} onOpen={setOpenReport} setRoute={setRoute} />
          )
        )}
        {route === 'contact' && <Contact />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 pt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} Power Visualize LLC • Built with React + Tailwind • Deployed on Vercel
      </footer>
    </div>
  );
}

/* ------------------------------------ */
/* Home                                 */
/* ------------------------------------ */

function Home({ setRoute }: { setRoute: (r: 'home' | 'about' | 'dashboards' | 'contact') => void }) {
  return (
    <section className="grid md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight">Power BI, Fabric & Automation</h1>
        <p className="mt-4 text-slate-300">
          I build pragmatic analytics with Power BI & Fabric, and automate the last mile with Power Automate + Power Apps by
          using data INSIGHTS to create ACTION. Too often BI development ends with analysis—where I excel is taking the team a
          step further, in acting on that insight.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setRoute('dashboards')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
          >
            View Dashboards
          </button>
          <button
            onClick={() => setRoute('about')}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-all duration-200 hover:translate-y-[-1px]"
          >
            About
          </button>
        </div>
        <TechBadges />
      </div>
      <HeroCard />
    </section>
  );
}

function HeroCard() {
  return (
    <div className="relative rounded-3xl p-6 md:p-10 bg-gradient-to-br from-slate-900 to-slate-800 ring-1 ring-slate-700 shadow-2xl">
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 blur-2xl" />
      <div className="relative">
        <h2 className="text-xl font-medium">Featured: Hotel Bookings Analysis</h2>
        <p className="text-slate-300 mt-2 text-sm">Interactive KPI dashboard showcasing DAX measures, bookmarks, targeted slicers, and design.</p>

        {/* Responsive embed (homepage stays as-is) */}
        <div className="mt-6 aspect-video rounded-2xl ring-1 ring-slate-700 overflow-hidden bg-[#0b0f17]">
          <iframe
            title="Hotel Bookings Analysis"
            src={
              'https://app.powerbi.com/view?r=eyJrIjoiNGJkNWQ0NDYtMDMwOS00NjE3LWE4Y2MtYjRjMWUxZDExYTE2IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9&filterPaneEnabled=false&navContentPaneEnabled=false'
            }
            className="w-full h-full block"
            frameBorder={0}
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

function TechBadges() {
  const items = ['Power BI', 'Microsoft Fabric', 'Semantic Models', 'DAX', 'M', 'SQL / T-SQL', 'Python', 'Power Automate', 'Power Apps', 'Dataverse', 'Snowflake', 'Azure'];
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-slate-800 ring-1 ring-slate-700">
          {t}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------ */
/* About                                */
/* ------------------------------------ */

function About() {
  return (
    <section className="prose prose-invert max-w-none">
      <h1><b> About Me</b></h1>
      <br></br>
      <p>
        I’m Ryan Owens, a Senior BI developer who ships clean, reliable analytics with Power BI and Microsoft Fabric. I focus on practical data models, fast
        DAX, and a UX that helps non-technical teams act quickly, as well as advanced dashboards for the technically sound manager to easily build their own changes to visualizations. I’ve built and embedded dashboards reaching 100+ customers, automated alerting with Power Automate,
        and launched lightweight apps in Power Apps to close the loop.  I've utilized Fabric to build data warehouses and lakehouses, extracting and transforming the data using dataflows and python notebooks to create bronze, silver, and gold layers of data structure.<br /><br />
      </p>
      <h3>Core Skill Set</h3>
      <ul>
        <li>Power BI & Fabric: data modeling (star schemas, semantic models), DAX/M, RLS, performance tuning, lakehouses using medallion architecture</li>
        <li>Automation & Apps: Power Automate (KPI alerts, distribution, workflow orchestration), Power Apps (mobile/Teams apps)</li>
        <li>Data Engineering: SQL/T-SQL (SPs, indexing), Python/PySpark pipelines, lakehouse patterns</li>
        <li>Platforms & Sources: SQL Server, Snowflake, Dataverse; integrations with Jira, Salesforce, MongoDB, Smartsheet; Azure & AWS</li>
        <li>Tooling: Tableau & SAS (prior work), AI copilots (Cursor, ChatGPT) to accelerate delivery</li>
      </ul><br /><br />
      <h3>Recent Experience</h3>
      <ul>
        <li>
          <strong>Senior BI Developer (2023–Present):</strong> embedded, RLS-secured customer dashboards; Fabric pipelines and lakehouses in the medallion architecture; alerting & report
          distribution with Power Automate; Power Apps for on-call workflows; impact tracking for AI-driven collections tools.
        </li>
        <li>
          <strong>BI Developer (2019–2023):</strong> Power BI/Tableau delivery, Snowflake data engineering, cross-team analytics enablement, and
          dashboarding COE leadership.
        </li>
        <li>
          <strong>Earlier:</strong> Data Analyst (Philadelphia Union) with ML/sentiment in SAS; prior roles where I began visual analytics and KPI reporting.
        </li>
      </ul>

      <p className="mt-6">
        Find me on{' '}
        <a href="https://github.com/rowens2025" target="_blank" rel="noopener noreferrer" className="underline decoration-slate-600 hover:decoration-slate-300">
          GitHub (@rowens2025)
        </a>
        .
      </p>
    </section>
  );
}

/* ------------------------------------ */
/* Utilities for Dashboards page        */
/* ------------------------------------ */

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Support Safari <16 oddities
      const matches = 'matches' in e ? (e as MediaQueryListEvent).matches : (e as MediaQueryList).matches;
      setIsMobile(matches);
    };
    setIsMobile(mql.matches);
    mql.addEventListener?.('change', onChange);
    // @ts-ignore - for older Safari
    mql.addListener?.(onChange);
    return () => {
      mql.removeEventListener?.('change', onChange);
      // @ts-ignore
      mql.removeListener?.(onChange);
    };
  }, [breakpoint]);
  return isMobile;
}

function CardThumbnail({ title, preview }: { title: string; preview?: string }) {
  return (
    <div className="aspect-video rounded-xl ring-1 ring-slate-800 overflow-hidden bg-slate-950/60">
      {preview ? (
        <img src={preview} alt={title} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.01]" />
      ) : (
        <div className="w-full h-full grid place-items-center text-slate-500 text-xs">Preview</div>
      )}
    </div>
  );
}

/** Mini preview that visually fits-to-card, hides panes, and matches dark theme */
function PreviewFrame({ title, src, scale = 0.18 }: { title: string; src: string; scale?: number }) {
  const inv = 1 / scale; // make iframe larger, then scale it down
  return (
    <div className="aspect-video rounded-xl bg-slate-900 ring-1 ring-slate-800 overflow-hidden">
      <div className="relative w-full h-full bg-[#0b0f17]">
        <iframe
          title={title + ' preview'}
          src={`${src}&filterPaneEnabled=false&navContentPaneEnabled=false`}
          frameBorder={0}
          allowFullScreen
          style={{
            width: `${100 * inv}%`,
            height: `${100 * inv}%`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            display: 'block',
            border: '0',
            pointerEvents: 'none', // allow card click
            backgroundColor: '#0b0f17',
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
}

function SmartCardPreview({
  title,
  src,
  preview,
  isMobile,
}: {
  title: string;
  src?: string;
  preview?: string;
  isMobile: boolean;
}) {
  // If no src (under construction), show simple thumbnail/placeholder (or "Preview")
  if (!src) return <CardThumbnail title={title} preview={preview} />;

  // Mobile = image only; Desktop = live mini iframe
  return isMobile ? <CardThumbnail title={title} preview={preview} /> : <PreviewFrame title={title} src={src} />;
}

/* ------------------------------------ */
/* Dashboards                           */
/* ------------------------------------ */

function DashboardList({
  reports,
  onOpen,
  setRoute,
}: {
  reports: { id: string; title: string; src: string; preview?: string }[];
  onOpen: (id: string) => void;
  setRoute: (r: 'home' | 'about' | 'dashboards' | 'contact') => void;
}) {
  const isMobile = useIsMobile(640); // Tailwind's sm breakpoint

  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboards</h2>
          <p className="text-slate-400 text-sm">
            Showcasing a variety of compelling and interactive dashboards.
            <br />
            <br />
            While some BI Developers are content with reacting to data, we prefer to act on it.  Reach us in the{' '}
            <button
              onClick={() => setRoute('contact')}
              className="underline decoration-slate-600 hover:decoration-slate-300"
            >
              Contact
            </button>{' '}
            section, to discover how we’d utilize this data to create new efficiencies and automations to drive metrics in a positive direction.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => r.src && onOpen(r.id)}
            className="group text-left rounded-2xl p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all duration-200 hover:translate-y-[-2px]"
          >
            <div className="relative">
              <SmartCardPreview title={r.title} src={r.src} preview={r.preview} isMobile={isMobile} />
              {/* Hover hint */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
            </div>

            <div className="mt-3 font-medium flex items-center justify-between">
              <span>{r.title}</span>
              <span className="text-xs text-slate-400 group-hover:text-slate-200 transition">
                {r.src ? 'Open →' : 'Unavailable'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------ */
/* Report Viewer                        */
/* ------------------------------------ */

function ReportViewer({ report, onBack }: { report: { title: string; src: string }; onBack: () => void }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-all duration-200 hover:translate-y-[-1px]"
        >
          Back
        </button>
        <h2 className="text-lg font-semibold">{report.title}</h2>
        <div />
      </div>

      {report.src ? (
        <div className="w-full rounded-2xl ring-1 ring-slate-800 overflow-hidden bg-[#0b0f17]">
          <iframe
            key={report.src}
            title={report.title}
            src={`${report.src}&filterPaneEnabled=false&navContentPaneEnabled=false`}
            className="block w-full"
            style={{ height: '85vh', backgroundColor: '#0b0f17' }}
            frameBorder={0}
            allowFullScreen
          />
        </div>
      ) : (
        <div className="w-full rounded-2xl ring-1 ring-slate-800 grid place-items-center text-slate-400" style={{ height: '75vh' }}>
          Add your report embed URL to <code>reports</code> in App.tsx
        </div>
      )}
    </section>
  );
}

/* ------------------------------------ */
/* Contact                              */
/* ------------------------------------ */

function Contact() {
  return (
    <section className="max-w-xl">
      <h2 className="text-2xl font-semibold">Contact</h2>
      <p className="text-slate-400 text-sm mt-1">
        Send a message—this form delivers straight to <span className="text-slate-200">rowens@powervisualize.com</span>.
      </p>
      <form action="https://formspree.io/f/myzpobor" method="POST" className="mt-6 grid gap-4">
        <input type="hidden" name="_subject" value="Portfolio contact — powervisualize.com" />
        <input className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800" name="name" placeholder="Your name" required />
        <input className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800" type="email" name="email" placeholder="Your email" required />
        <textarea className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 min-h-[140px]" name="message" placeholder="Tell me about your project..." required />
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
        >
          Send
        </button>
      </form>
      <p className="text-xs text-slate-500 mt-3">By submitting, you consent to be contacted about your inquiry.</p>
    </section>
  );
}

