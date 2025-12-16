import { useEffect, useState } from 'react';

type Route = 'home' | 'about' | 'dashboards' | 'data-projects' | 'contact';

type Report = { id: string; title: string; src: string; preview?: string };

type DataProject = {
  id: string;
  title: string;
  preview?: string; // image path in /public
  slides?: {
    basePath: string; // e.g. "/dataprojects/dp1/slides"
    count: number; // e.g. 18
    prefix?: string; // default "Slide"
    ext?: string; // default "png"
  };
  maps?: { key: 'buildings' | 'nta'; label: string; src: string }[];
};

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [openDataProject, setOpenDataProject] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const reports: Report[] = [
    {
      id: 'r1',
      title: 'Over and Back Again: Tracking Steps',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiN2VmZDdmZWYtYjlkNC00ZGYxLWE5MTctYzMxODVjM2UzMmE2IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/frodosteps.png',
    },
    {
      id: 'r2',
      title: 'Bayesian Marketing Experiment',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNGRhYzIyMDEtYWUyYi00ZjVjLTg2YWEtNmM5NTFkYWE5YWVkIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/bayesian.png',
    },
    {
      id: 'r3',
      title: 'Executive Sales Insights',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNjMxY2M3ZDAtNzIzZi00MWI1LWE0ZmQtZDdjMDcwNzBiMjE4IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/sales.jpg',
    },
    {
      id: 'r4',
      title: 'Geocoding Compliance',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiOTBkNGI1Y2ItMmJjZC00ZmViLWJlZDUtMjkwNmI2MjYyYzhhIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/geo.jpg',
    },
    {
      id: 'r5',
      title: 'Hotel Booking Analysis',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNGJkNWQ0NDYtMDMwOS00NjE3LWE4Y2MtYjRjMWUxZDExYTE2IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/hotel.jpg',
    },
    {
      id: 'r6',
      title: 'Global Steel KPI Matrix',
      src: 'https://app.powerbi.com/view?r=eyJrIjoiNWRjNjEwYmUtODNkMS00MzI5LTk5M2YtYmE4MDkzNDhjMmNmIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9',
      preview: '/previews/steel.jpg',
    },
    { id: 'r7', title: 'Under Construction', src: '' },
  ];

  // ✅ Your first data project (dp1)
  const dataProjects: DataProject[] = [
    {
      id: 'dp1',
      title: 'NYC Flood Risk: Buildings vs Neighborhoods',
      preview: '/previews/dp1.png', // you created this
      slides: {
        basePath: '/dataprojects/dp1/slides',
        count: 18,
        prefix: 'Slide',
        ext: 'PNG',
      },
      maps: [
        { key: 'buildings', label: 'Buildings', src: '/maps/nyc_flood_risk_buildings.html' },
        { key: 'nta', label: 'Neighborhoods', src: '/maps/nyc_flood_risk_nta.html' },
      ],
    },
    { id: 'uc', title: 'Under Construction' },
  ];

  const navKeys: Route[] = ['home', 'about', 'dashboards', 'data-projects', 'contact'];

  function go(routeKey: Route) {
    setRoute(routeKey);
    setOpenReport(null);
    setOpenDataProject(null);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 selection:bg-fuchsia-500/30 selection:text-slate-100">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            {/* Brand */}
            <button onClick={() => go('home')} className="flex items-center gap-2">
              <img
                src="/PVFavicon.png"
                alt="PowerVisualize"
                className="h-10 w-10 -my-1 rounded-xl object-contain"
                draggable={false}
              />
              <span className="hidden sm:inline font-semibold tracking-wide">PowerVisualize</span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-2 text-sm">
              {navKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={`px-3 py-2 rounded-xl transition-all duration-200 hover:bg-slate-800 hover:translate-y-[-1px] ${
                    route === key ? 'bg-slate-800 ring-1 ring-slate-700' : 'border border-transparent'
                  }`}
                >
                  {key === 'data-projects' ? 'Data Projects' : key[0].toUpperCase() + key.slice(1)}
                </button>
              ))}
              <a
                href="mailto:rowens@powervisualize.com"
                className="ml-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-all duration-200 hover:translate-y-[-1px]"
              >
                Email
              </a>
            </nav>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-xl hover:bg-slate-800"
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Mobile dropdown */}
          {menuOpen && (
            <div className="sm:hidden pb-3 flex flex-col gap-2">
              {navKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition hover:bg-slate-800 ${
                    route === key ? 'bg-slate-800 ring-1 ring-slate-700' : 'border border-slate-800'
                  }`}
                >
                  {key === 'data-projects' ? 'Data Projects' : key[0].toUpperCase() + key.slice(1)}
                </button>
              ))}
              <a href="mailto:rowens@powervisualize.com" className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800">
                Email
              </a>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {route === 'home' && <Home setRoute={go} />}

        {route === 'about' && <About />}

        {route === 'dashboards' &&
          (openReport ? (
            <ReportViewer report={reports.find((r) => r.id === openReport)!} onBack={() => setOpenReport(null)} />
          ) : (
            <DashboardList reports={reports} onOpen={setOpenReport} setRoute={go} />
          ))}

        {route === 'data-projects' &&
          (openDataProject ? (
            <DataProjectViewer
              project={dataProjects.find((p) => p.id === openDataProject)!}
              onBack={() => setOpenDataProject(null)}
            />
          ) : (
            <DataProjectList projects={dataProjects} onOpen={setOpenDataProject} />
          ))}

        {route === 'contact' && <Contact />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 pt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} Power Visualize LLC • Built with React + Tailwind • Deployed on Vercel
      </footer>
    </div>
  );
}

/* ------------------------------------ */
/* Data Projects: List + Viewer         */
/* ------------------------------------ */

function DataProjectList({
  projects,
  onOpen,
}: {
  projects: DataProject[];
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Data Projects</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-3xl">
            Applied analytics projects built with Python (GeoPandas + Folium), focused on turning spatial data into a narrative.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => p.id !== 'uc' && onOpen(p.id)}
            className="group text-left rounded-2xl p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all duration-200 hover:translate-y-[-2px]"
          >
            <div className="aspect-video rounded-xl ring-1 ring-slate-800 overflow-hidden bg-slate-950/60">
              {p.preview ? (
                <img
                  src={p.preview}
                  alt={p.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-slate-500 text-xs">Preview</div>
              )}
            </div>

            <div className="mt-3 font-medium flex items-center justify-between">
              <span>{p.title}</span>
              <span className="text-xs text-slate-400 group-hover:text-slate-200 transition">
                {p.id === 'uc' ? 'Unavailable' : 'Open →'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function DataProjectViewer({ project, onBack }: { project: DataProject; onBack: () => void }) {
  const maps = project.maps ?? [];
  const [mapView, setMapView] = useState<'buildings' | 'nta'>(maps[0]?.key ?? 'buildings');
  const activeMap = maps.find((m) => m.key === mapView) ?? maps[0];

  const slides = project.slides;
  const [slideIdx, setSlideIdx] = useState(1);

  function slideSrc(i: number) {
    if (!slides) return '';
    const prefix = slides.prefix ?? 'Slide';
    const ext = slides.ext ?? 'png';
    // Your files are named Slide1.png, Slide2.png, ... Slide18.png
    return `${slides.basePath}/${prefix}${i}.${ext}`;
  }

  const containerWidth = 'w-full md:w-2/3 mx-auto';

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-all duration-200 hover:translate-y-[-1px]"
        >
          Back
        </button>
        <h2 className="text-lg font-semibold">{project.title}</h2>
        <div />
      </div>

      {/* Intro (placeholder copy) */}
      <div className={`${containerWidth} max-w-3xl`}>
        <p className="text-slate-300">
          Project that combines 3 disparate datasets on polygon shape and centroids to map them together and create an entirely new and robust dataset that is servicable across various industries and use cases.
        </p>
      </div>

      {/* Slides (WORKING slideshow) */}
      <div className={`${containerWidth} rounded-3xl bg-slate-900/60 border border-slate-800 overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <div className="font-medium">Project Slides</div>
            <div className="text-xs text-slate-400">Use arrows to browse Slide 1 → Slide {slides?.count ?? '?'}</div>
          </div>

          {slides ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSlideIdx((s) => Math.max(1, s - 1))}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 hover:bg-slate-800"
                disabled={slideIdx <= 1}
                aria-label="Previous slide"
              >
                ←
              </button>
              <div className="text-xs text-slate-400 tabular-nums">
                Slide {slideIdx} / {slides.count}
              </div>
              <button
                onClick={() => setSlideIdx((s) => Math.min(slides.count, s + 1))}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 hover:bg-slate-800"
                disabled={slideIdx >= slides.count}
                aria-label="Next slide"
              >
                →
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">No slides configured</div>
          )}
        </div>

        <div className="bg-[#0b0f17]">
          {slides ? (
            <div className="w-full">
              <img
                key={slideSrc(slideIdx)}
                src={slideSrc(slideIdx)}
                alt={`Slide ${slideIdx}`}
                className="w-full h-auto block"
                loading="eager"
                onError={(e) => {
                  // If a slide path is wrong, you’ll see this message in the UI
                  const el = e.currentTarget;
                  el.style.display = 'none';
                  const parent = el.parentElement;
                  if (parent && !parent.querySelector('[data-slide-error]')) {
                    const msg = document.createElement('div');
                    msg.setAttribute('data-slide-error', '1');
                    msg.className = 'p-6 text-slate-400 text-sm';
                    msg.innerText =
                      `Could not load: ${slideSrc(slideIdx)}\n` +
                      `Check file names + location under /public/dataprojects/dp1/slides/.`;
                    parent.appendChild(msg);
                  }
                }}
              />
            </div>
          ) : (
            <div className="aspect-video grid place-items-center text-slate-500 text-sm">Slides not configured.</div>
          )}
        </div>
      </div>

      {/* Map toggle + iframe */}
      <div className={`${containerWidth} rounded-3xl bg-slate-900/60 border border-slate-800 overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <div className="font-medium">Interactive Map</div>
            <div className="text-xs text-slate-400">Toggle views below (Folium exports embedded as HTML).</div>
          </div>

          {maps.length > 1 && (
            <div className="flex gap-2">
              {maps.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMapView(m.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    mapView === m.key
                      ? 'bg-slate-800 ring-1 ring-slate-700'
                      : 'border border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full h-[55vh] md:h-[60vh] bg-[#0b0f17]">
          {activeMap?.src ? (
            <iframe
              key={activeMap.src}
              title="Data project map"
              src={activeMap.src}
              className="w-full h-full block"
              frameBorder={0}
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-slate-500">Map not configured.</div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------ */
/* Home                                 */
/* ------------------------------------ */

function Home({ setRoute }: { setRoute: (r: Route) => void }) {
  return (
    <section className="grid md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight">Power BI, Fabric & Automation</h1>
        <p className="mt-4 text-slate-300">
          I engineer data, build pragmatic analytics with Python, R, SQL, Power BI & Fabric, and automate the last mile with
          notebooks and Power Automate—turning insights into action.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setRoute('dashboards')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
          >
            View Dashboards
          </button>
          <button
            onClick={() => setRoute('data-projects')}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-all duration-200 hover:translate-y-[-1px]"
          >
            Data Projects
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
        <h2 className="text-xl font-medium">Featured: Bayesian Marketing Experiment</h2>
        <p className="text-slate-300 mt-2 text-sm">Showcasing Power BI + Fabric capabilities for Bayesian analysis via Python.</p>

        <div className="mt-6 aspect-video rounded-2xl ring-1 ring-slate-700 overflow-hidden bg-[#0b0f17]">
          <iframe
            title="Bayesian Marketing Experiment"
            src="https://app.powerbi.com/view?r=eyJrIjoiNGRhYzIyMDEtYWUyYi00ZjVjLTg2YWEtNmM5NTFkYWE5YWVkIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9&filterPaneEnabled=false&navContentPaneEnabled=false"
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
  const items = [
    'Power BI',
    'Microsoft Fabric',
    'Semantic Models',
    'DAX',
    'M',
    'SQL / T-SQL',
    'Python',
    'Power Automate',
    'Power Apps',
    'Dataverse',
    'Snowflake',
    'Azure',
  ];
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
      <h1><b>About Me</b></h1>
      <br />
      <p>
        I’m Ryan Owens, a Senior BI developer who ships clean, reliable analytics with Power BI and Microsoft Fabric.
        I focus on practical data models, fast DAX, and a UX that helps non-technical teams act quickly.
      </p>

      <h3>Core Skill Set</h3>
      <ul>
        <li>Power BI & Fabric: data modeling (star schemas, semantic models), DAX/M, RLS, performance tuning</li>
        <li>Automation & Apps: Power Automate workflows, Power Apps prototypes</li>
        <li>Data Engineering: SQL/T-SQL, Python pipelines</li>
        <li>Platforms: SQL Server, Snowflake, Dataverse; Azure</li>
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
      const matches = 'matches' in e ? (e as MediaQueryListEvent).matches : (e as MediaQueryList).matches;
      setIsMobile(matches);
    };

    setIsMobile(mql.matches);
    mql.addEventListener?.('change', onChange);
    // @ts-ignore
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
        <img
          src={preview}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
        />
      ) : (
        <div className="w-full h-full grid place-items-center text-slate-500 text-xs">Preview</div>
      )}
    </div>
  );
}

function PreviewFrame({ title, src, scale = 0.18 }: { title: string; src: string; scale?: number }) {
  const inv = 1 / scale;
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
            pointerEvents: 'none',
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
  if (!src) return <CardThumbnail title={title} preview={preview} />;
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
  reports: Report[];
  onOpen: (id: string) => void;
  setRoute: (r: Route) => void;
}) {
  const isMobile = useIsMobile(640);

  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboards</h2>
          <p className="text-slate-400 text-sm">
            Showcasing a variety of compelling and interactive dashboards.
            <br />
            <br />
            Reach out in the{' '}
            <button onClick={() => setRoute('contact')} className="underline decoration-slate-600 hover:decoration-slate-300">
              Contact
            </button>{' '}
            section to discuss analytics + automation work.
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
