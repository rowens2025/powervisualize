import { useState } from 'react';

export default function App() {
  const [route, setRoute] = useState<'home' | 'about' | 'dashboards' | 'contact'>('home');
  const [openReport, setOpenReport] = useState<string | null>(null);

  const reports = [
    { id: 'r1', title: 'Executive Sales Insights', src: 'https://app.powerbi.com/view?r=eyJrIjoiNjMxY2M3ZDAtNzIzZi00MWI1LWE0ZmQtZDdjMDcwNzBiMjE4IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9' },
    { id: 'r2', title: 'Geocoding Compliance', src: 'https://app.powerbi.com/view?r=eyJrIjoiOTBkNGI1Y2ItMmJjZC00ZmViLWJlZDUtMjkwNmI2MjYyYzhhIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9' },
    { id: 'r3', title: 'Hotel Booking Analysis', src: 'https://app.powerbi.com/view?r=eyJrIjoiNGJkNWQ0NDYtMDMwOS00NjE3LWE4Y2MtYjRjMWUxZDExYTE2IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9' },
    { id: 'r4', title: 'Global Steel KPI Matrix', src: 'https://app.powerbi.com/view?r=eyJrIjoiNWRjNjEwYmUtODNkMS00MzI5LTk5M2YtYmE4MDkzNDhjMmNmIiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9' },
    { id: 'r5', title: 'Under Construction', src: '' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100">
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500"/>
            <span className="font-semibold tracking-wide">PowerVisualize</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            {['home','about','dashboards','contact'].map((key) => (
              <button
                key={key}
                onClick={() => { setRoute(key as any); setOpenReport(null); }}
                className={`px-3 py-2 rounded-xl hover:bg-slate-800 transition ${route===key? 'bg-slate-800 ring-1 ring-slate-700' : ''}`}
              >{key[0].toUpperCase()+key.slice(1)}</button>
            ))}
            <a href="mailto:hello@powervisualize.com" className="ml-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800">Email</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {route === 'home' && <Home setRoute={setRoute} />}
        {route === 'about' && <About />}
        {route === 'dashboards' && (
          openReport ? (
            <ReportViewer report={reports.find(r=>r.id===openReport)!} onBack={() => setOpenReport(null)} />
          ) : (
            <DashboardList reports={reports} onOpen={setOpenReport} />
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

function Home({ setRoute }: { setRoute: (r: 'home'|'about'|'dashboards'|'contact') => void }) {
  return (
    <section className="grid md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
          Power BI, Fabric & Automation
        </h1>
        <p className="mt-4 text-slate-300">
          I build pragmatic analytics with Power BI & Fabric, and automate the last mile with Power Automate + Power Apps by using data INSIGHTS to create ACTION.  Too often BI development ends with analysis, where I excel is taking the team a step further, in acting on that insight.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setRoute('dashboards')} className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold">
            View Dashboards
          </button>
          <button onClick={() => setRoute('about')} className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800">About</button>
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
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 blur-2xl"/>
      <div className="relative">
        <h2 className="text-xl font-medium">Featured: Hotel Bookings Analysis</h2>
        <p className="text-slate-300 mt-2 text-sm">
          Interactive KPI dashboard showcasing DAX measures, bookmarks, targeted slicers, and design.
        </p>

        {/* Responsive embed */}
        <div className="mt-6 aspect-video rounded-2xl ring-1 ring-slate-700 overflow-hidden bg-[#0b0f17]">
          <iframe
            title="Hotel Bookings Analysis"
            src={"https://app.powerbi.com/view?r=eyJrIjoiNGJkNWQ0NDYtMDMwOS00NjE3LWE4Y2MtYjRjMWUxZDExYTE2IiwidCI6IjM2ZmE0ZWQ4LTEyMjMtNGQ4MC1iYjU4LWZhYjFkNzc2ZjNmZSIsImMiOjF9&filterPaneEnabled=false&navContentPaneEnabled=false"}
            className="w-full h-full block"
            frameBorder="0"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

function TechBadges() {
  const items = ['Power BI','Microsoft Fabric','Semantic Models','DAX','M','SQL / T-SQL','Python','Power Automate','Power Apps','Dataverse','Snowflake','Azure'];
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {items.map(t => (
        <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-slate-800 ring-1 ring-slate-700">{t}</span>
      ))}
    </div>
  );
}

function About() {
  return (
    <section className="prose prose-invert max-w-none">
      <h2>About Me</h2>
      <p>
        I’m Ryan Owens, a Senior BI developer who ships clean, reliable analytics with Power BI and Microsoft Fabric. I focus on practical data models, fast DAX, and a UX that helps non-technical teams act quickly. I’ve built and embedded dashboards for 100+ customers, automated alerting with Power Automate, and launched lightweight apps in Power Apps to close the loop.
      </p>
      <h3>Core Skill Set</h3>
      <ul>
        <li>Power BI & Fabric: data modeling (star schemas, semantic models), DAX/M, RLS, performance tuning</li>
        <li>Automation & Apps: Power Automate (KPI alerts, distribution, workflow orchestration), Power Apps (mobile/Teams apps)</li>
        <li>Data Engineering: SQL/T-SQL (SPs, indexing), Python/PySpark pipelines, lakehouse patterns</li>
        <li>Platforms & Sources: SQL Server, Snowflake, Dataverse; integrations with Jira, Salesforce, MongoDB, Smartsheet; Azure & AWS</li>
        <li>Tooling: Tableau & SAS (prior work), AI copilots (Cursor, ChatGPT) to accelerate delivery</li>
      </ul>
      <h3>Recent Experience</h3>
      <ul>
        <li><strong>AKUVO – Senior BI Developer (2023–Present):</strong> embedded, RLS-secured customer dashboards; Fabric pipelines; alerting & report distribution with Power Automate; Power Apps for on-call workflows; impact tracking for AI-driven collections tools.</li>
        <li><strong>MMIT – BI Developer (2019–2023):</strong> Power BI/Tableau delivery, Snowflake data engineering, cross-team analytics enablement, and dashboarding COE leadership.</li>
        <li><strong>Earlier:</strong> Data Analyst (Philadelphia Union) with ML/sentiment in SAS; prior roles where I began visual analytics and KPI reporting.</li>
      </ul>
    </section>
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
          frameBorder="0"
          allowFullScreen
          // Make it big, then visually shrink to fit card; disable pointer so card click works
          style={{
            width: `${100 * inv}%`,
            height: `${100 * inv}%`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            display: 'block',
            border: '0',
            pointerEvents: 'none',        // lets the surrounding <button> get the click
            backgroundColor: '#0b0f17'    // blends any outer gaps with page background
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
}

function DashboardList({
  reports,
  onOpen
}: {
  reports: { id: string; title: string; src: string }[];
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboards</h2>
          <p className="text-slate-400 text-sm">
            Five showcase reports. Replace each card’s src with your Publish-to-web URL or Embedded URL.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => r.src && onOpen(r.id)}
            className="group text-left rounded-2xl p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition"
          >
            {r.src ? (
              <PreviewFrame title={r.title} src={r.src} />
            ) : (
              <div className="aspect-video rounded-xl ring-1 ring-slate-800 grid place-items-center text-slate-500 text-xs bg-slate-950/60">
                Coming soon
              </div>
            )}

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

function ReportViewer({
  report,
  onBack
}: {
  report: { title: string; src: string };
  onBack: () => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800">
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
            frameBorder="0"
            allowFullScreen
          />
        </div>
      ) : (
        <div
          className="w-full rounded-2xl ring-1 ring-slate-800 grid place-items-center text-slate-400"
          style={{ height: '75vh' }}
        >
          Add your report embed URL to <code>reports</code> in App.tsx
        </div>
      )}
    </section>
  );
}

function Contact() {
  return (
    <section className="max-w-xl">
      <h2 className="text-2xl font-semibold">Contact</h2>
      <p className="text-slate-400 text-sm mt-1">
        Send a message. This form posts to mailto: by default — replace with your API later.
      </p>
      <form action="mailto:hello@powervisualize.com" method="post" encType="text/plain" className="mt-6 grid gap-4">
        <input className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800" name="name" placeholder="Your name" />
        <input className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800" name="email" placeholder="Your email" />
        <textarea
          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 min-h-[140px]"
          name="message"
          placeholder="Tell me about your project..."
        />
        <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold">
          Send
        </button>
      </form>
    </section>
  );
}
