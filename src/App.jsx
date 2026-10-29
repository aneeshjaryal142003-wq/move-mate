import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight, ArrowUpRight, Bell, Box, Check, ChevronDown, CircleHelp, Command,
  Compass, CreditCard, Headphones, LayoutDashboard, LogOut, Menu, PackageCheck,
  Plus, Search, Settings, ShieldCheck, Ship, Sparkles, Truck, X,
} from "lucide-react";
import {
  Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams,
} from "react-router-dom";
import api from "./api";
import { useAuth } from "./auth";

const ShipmentVolumeChart = lazy(() => import("./ShipmentVolumeChart"));

const modes = [
  { id: "road", label: "Road", icon: Truck, detail: "Flexible, door-to-door" },
  { id: "rail", label: "Rail", icon: Command, detail: "A balanced way to ship" },
  { id: "air", label: "Air", icon: ArrowUpRight, detail: "When every hour counts" },
  { id: "sea", label: "Sea", icon: Ship, detail: "Big moves, lower cost" },
];

const demoShipments = [
  { id: "sample-1", trackingCode: "MM-2048A7", origin: "Austin, TX", destination: "Seattle, WA", mode: "Road", status: "In transit", price: 482.4, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), eta: new Date(Date.now() + 86400000 * 2).toISOString() },
  { id: "sample-2", trackingCode: "MM-19C3F2", origin: "Miami, FL", destination: "New York, NY", mode: "Air", status: "Delivered", price: 824, createdAt: new Date(Date.now() - 86400000 * 6).toISOString(), eta: new Date(Date.now() - 86400000).toISOString() },
  { id: "sample-3", trackingCode: "MM-71D8B5", origin: "Portland, OR", destination: "Denver, CO", mode: "Rail", status: "Booked", price: 318.75, createdAt: new Date(Date.now() - 86400000).toISOString(), eta: new Date(Date.now() + 86400000 * 5).toISOString() },
  { id: "sample-4", trackingCode: "MM-620E91", origin: "Los Angeles, CA", destination: "Chicago, IL", mode: "Sea", status: "In transit", price: 556, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), eta: new Date(Date.now() + 86400000 * 8).toISOString() },
];

const dashboardDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date()).toUpperCase();

const volumeData = [
  { month: "May", shipments: 28 }, { month: "Jun", shipments: 38 },
  { month: "Jul", shipments: 32 }, { month: "Aug", shipments: 53 },
  { month: "Sep", shipments: 45 }, { month: "Oct", shipments: 68 },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function formatDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", options).format(new Date(value));
}

function initials(name = "Move Mate") {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function StatusBadge({ status }) {
  const type = (status || "booked").toLowerCase().replace(/\s+/g, "-");
  return <span className={`status-badge status-${type}`}><span />{status || "Booked"}</span>;
}

function Brand() {
  return <Link className="brand" to="/" aria-label="MoveMate dashboard"><span className="brand-mark">m</span><span className="brand-name">move<span>mate</span></span></Link>;
}

function AppLayout() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    try { await logout(); navigate("/"); } catch (error) { setLogoutError(error.message); }
  }

  const titles = { "/": "Overview", "/shipments": "Shipments", "/shipments/new": "New shipment", "/track": "Track & trace", "/account": "Account settings" };
  const title = location.pathname.startsWith("/shipments/") && location.pathname !== "/shipments/new"
    ? "Shipment details"
    : titles[location.pathname] || "MoveMate";

  return <div className="app-shell">
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
    <aside className={`sidebar${mobileNav ? " sidebar-open" : ""}`}>
      <div className="sidebar-top"><Brand /><button className="sidebar-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">{user ? initials(user.name) : "N"}</span><span className="workspace-name"><strong>{user?.name ? `${user.name.split(" ")[0]}'s workspace` : "Northstar Studio"}</strong><small>{user ? "Personal workspace" : "Sample workspace"}</small></span><ChevronDown size={15} /></div>
      <nav className="side-nav" aria-label="Workspace navigation">
        <span className="nav-caption">WORKSPACE</span>
        <NavLink end to="/" className={({ isActive }) => `nav-link${isActive ? " nav-active" : ""}`} onClick={() => setMobileNav(false)}><LayoutDashboard size={17} />Overview</NavLink>
        <NavLink to="/shipments" className={({ isActive }) => `nav-link${isActive ? " nav-active" : ""}`} onClick={() => setMobileNav(false)}><Box size={17} />Shipments</NavLink>
        <NavLink to="/track" className={({ isActive }) => `nav-link${isActive ? " nav-active" : ""}`} onClick={() => setMobileNav(false)}><Compass size={17} />Track & trace</NavLink>
        <NavLink to="/shipments/new" className={({ isActive }) => `nav-link${isActive ? " nav-active" : ""}`} onClick={() => setMobileNav(false)}><Plus size={17} />Get a quote</NavLink>
        <span className="nav-caption nav-caption-spaced">PREFERENCES</span>
        <NavLink to="/account" className={({ isActive }) => `nav-link${isActive ? " nav-active" : ""}`} onClick={() => setMobileNav(false)}><Settings size={17} />Account settings</NavLink>
        <a className="nav-link" href="mailto:support@movemate.example"><CircleHelp size={17} />Help & support</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-icon"><Headphones size={17} /></span><strong>Here when you need us.</strong><p>Questions about a shipment? Our team can help.</p><a href="mailto:support@movemate.example">Talk to support <ArrowRight size={13} /></a></div>
        <div className="profile-card"><span className={`profile-avatar${user ? "" : " demo-avatar"}`}>{initials(user?.name || "Northstar")}</span><span className="profile-copy"><strong>{user?.name || "Northstar Studio"}</strong><small>{user?.email || "Demo workspace"}</small></span>{user ? <button className="icon-button profile-action" onClick={handleLogout} aria-label="Sign out"><LogOut size={15} /></button> : <Link className="sign-in-small" to="/login">Sign in</Link>}</div>
      </div>
    </aside>
    <main className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{title}</strong></div></div><div className="topbar-actions"><Link className="global-search" to="/shipments"><Search size={16} /><span>Find a shipment...</span><kbd>⌘ K</kbd></Link><Link className="icon-button notification-button" to="/track" aria-label="Track a shipment"><Bell size={17} /></Link>{user ? <Link className="top-avatar" to="/account">{initials(user.name)}</Link> : <Link className="top-login" to="/login">Sign in</Link>}</div></header>
      {logoutError && <div className="global-error">{logoutError}</div>}
      {!ready && <div className="session-loading">Getting your workspace ready…</div>}
      <Outlet />
    </main>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="page-eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}

function StatCard({ label, value, note, icon: Icon, tone, trend }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={17} /></span></div><strong className="stat-value">{value}</strong><div className="stat-note">{trend && <span className="stat-trend"><ArrowUpRight size={13} />{trend}</span>}{note}</div></article>;
}

function ShipmentTable({ shipments, sample = false }) {
  return <div className="table-scroll"><table className="shipment-table"><thead><tr><th>SHIPMENT</th><th>ROUTE</th><th>MODE</th><th>STATUS</th><th>ETA</th><th>PRICE</th><th /></tr></thead><tbody>{shipments.map((shipment) => (
    <tr key={shipment.id}><td><Link className="tracking-link" to={sample ? "/track" : `/shipments/${shipment.id}`}><span className="shipment-mini-icon"><PackageCheck size={15} /></span><span><strong>{shipment.trackingCode}</strong><small>{formatDate(shipment.createdAt)}</small></span></Link></td><td><div className="route-cell"><span>{shipment.origin}</span><ArrowRight size={12} /><span>{shipment.destination}</span></div></td><td><span className="mode-cell">{shipment.mode}</span></td><td><StatusBadge status={shipment.status} /></td><td>{formatDate(shipment.eta)}</td><td className="price-cell">{formatCurrency(shipment.price)}</td><td><Link className="table-arrow" to={sample ? "/track" : `/shipments/${shipment.id}`} aria-label={`View ${shipment.trackingCode}`}><ArrowUpRight size={15} /></Link></td></tr>
  ))}</tbody></table></div>;
}

function useShipments(user) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!user) { setShipments([]); setLoading(false); return undefined; }
    setLoading(true);
    api.shipments().then((result) => { if (active) setShipments(result.shipments); }).catch((reason) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);
  return { shipments, loading, error };
}

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shipments, loading, error } = useShipments(user);
  const isSample = !user;
  const data = isSample ? demoShipments : shipments;
  const inTransit = data.filter((shipment) => shipment.status.toLowerCase() === "in transit").length;
  const delivered = data.filter((shipment) => shipment.status.toLowerCase() === "delivered").length;
  const spend = data.reduce((sum, shipment) => sum + shipment.price, 0);

  return <div className="page-content dashboard-page">
    <div className="welcome-strip"><span className="welcome-orb"><Sparkles size={17} /></span><span><strong>{user ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome to your workspace"}</strong><small>{user ? "Here’s what’s happening with your logistics today." : "A more considered way to manage every shipment."}</small></span>{isSample && <span className="demo-pill">PREVIEW</span>}</div>
    <PageHeading eyebrow={dashboardDate} title="Your operations, at a glance." description="One view for every shipment, route, and delivery." action={<button className="primary-button" onClick={() => navigate("/shipments/new")}><Plus size={16} />Create shipment</button>} />
    {isSample && <div className="preview-notice"><Sparkles size={15} /><span>You’re viewing a sample workspace. <Link to="/login">Sign in</Link> or create an account to see your own shipments.</span></div>}
    {error && <div className="inline-error">{error}</div>}
    <section className="stats-grid">
      <StatCard label="Total shipments" value={isSample ? "1,284" : loading ? "—" : data.length.toLocaleString()} note={isSample ? "Across all time" : "In your workspace"} icon={PackageCheck} tone="tone-green" trend={isSample ? "+12.8%" : null} />
      <StatCard label="In transit" value={isSample ? "36" : loading ? "—" : inTransit.toLocaleString()} note="Moving right now" icon={Truck} tone="tone-blue" trend={isSample ? "+4.2%" : null} />
      <StatCard label="Delivered" value={isSample ? "1,196" : loading ? "—" : delivered.toLocaleString()} note="Successfully delivered" icon={Check} tone="tone-purple" trend={isSample ? "+8.1%" : null} />
      <StatCard label="Shipment spend" value={isSample ? "$48.2k" : loading ? "—" : formatCurrency(spend)} note={isSample ? "This month" : "Across your shipments"} icon={CreditCard} tone="tone-orange" trend={isSample ? "−2.4%" : null} />
    </section>
    <section className="dashboard-grid">
      <article className="panel volume-panel"><div className="panel-heading"><div><h2>Shipment volume</h2><p>A look at your shipping activity</p></div><button className="select-button">Last 6 months <ChevronDown size={14} /></button></div><div className="chart-legend"><span /><strong>Shipments</strong><small>+12.8% from last period</small></div><div className="volume-chart"><Suspense fallback={<div className="table-loading">Loading chart…</div>}><ShipmentVolumeChart data={volumeData} /></Suspense></div></article>
      <article className="panel delivery-panel"><div className="panel-heading"><div><h2>Delivery performance</h2><p>On-time delivery rate</p></div><span className="more-button">···</span></div><div className="delivery-score"><div className="score-ring"><strong>{isSample ? "98.4" : data.length ? "100" : "—"}<small>{data.length ? "%" : ""}</small></strong></div><div className="score-context"><strong>{isSample ? "Looking good." : data.length ? "Off to a great start." : "Ready when you are."}</strong><span>Above your 95% target</span><span className="positive-change"><ArrowUpRight size={13} />{isSample ? "2.4% this month" : "First shipment awaits"}</span></div></div><div className="performance-divider" /><div className="performance-row"><span><i className="dot-green" />On-time deliveries</span><strong>{isSample ? "98.4%" : data.length ? "100%" : "—"}</strong></div><div className="performance-row"><span><i className="dot-gray" />Needs attention</span><strong>{isSample ? "1.6%" : data.length ? "0%" : "—"}</strong></div><Link className="panel-link" to="/shipments">View delivery details <ArrowRight size={14} /></Link></article>
    </section>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent shipments</h2><p>Your latest moves, all in one place</p></div><Link className="subtle-button" to="/shipments">View all <ArrowRight size={14} /></Link></div>{!isSample && !loading && data.length === 0 ? <div className="empty-state"><span><PackageCheck size={21} /></span><strong>Your first shipment starts here.</strong><p>Get a route estimate and book a shipment to see it on your dashboard.</p><button className="secondary-button" onClick={() => navigate("/shipments/new")}><Plus size={15} />Create a shipment</button></div> : loading ? <div className="table-loading">Loading your shipments…</div> : <ShipmentTable shipments={data.slice(0, 4)} sample={isSample} />}</section>
    <div className="dashboard-footer"><span><ShieldCheck size={14} /> Your shipments are protected with MoveMate.</span><span>Need a hand? <a href="mailto:support@movemate.example">We’re right here.</a></span></div>
  </div>;
}

function NewShipmentPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ origin: "", destination: "", weight: "50", mode: "road" });
  const [quote, setQuote] = useState(null);
  const [selectedMode, setSelectedMode] = useState("road");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  function updateForm(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  async function handleQuote(event) {
    event.preventDefault();
    setError("");
    setQuote(null);
    setLoading(true);
    try {
      const result = await api.quote({ ...form, weight: Number(form.weight) });
      setQuote(result.quote);
      setSelectedMode(result.quote.selectedMode);
    } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }

  async function handleBook() {
    if (!user) {
      navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    setBooking(true);
    setError("");
    try {
      const result = await api.book({ origin: quote.shipment.origin, destination: quote.shipment.destination, weight: quote.shipment.weight, mode: selectedMode });
      navigate(`/shipments/${result.shipment.id}`, { state: { created: true } });
    } catch (reason) { setError(reason.message); } finally { setBooking(false); }
  }

  const selectedEstimate = quote?.estimates.find((estimate) => estimate.id === selectedMode);

  return <div className="page-content workflow-page"><PageHeading eyebrow="PLAN YOUR NEXT MOVE" title="Ship with a little more certainty." description="Build your route, compare transport options, and get your shipment moving." /><div className="workflow-layout"><form className="panel shipment-form" onSubmit={handleQuote}><div className="step-heading"><span>01</span><div><h2>Your shipment</h2><p>First, let us know where it’s headed.</p></div></div><div className="form-grid"><label className="app-field"><span>Pickup location</span><div className="app-input"><span className="field-dot field-dot-green" /><input name="origin" value={form.origin} onChange={updateForm} placeholder="City, state or ZIP" maxLength="120" required /></div></label><span className="workflow-route-arrow"><ArrowRight size={16} /></span><label className="app-field"><span>Delivery location</span><div className="app-input"><span className="field-dot field-dot-orange" /><input name="destination" value={form.destination} onChange={updateForm} placeholder="City, state or ZIP" maxLength="120" required /></div></label></div><label className="app-field weight-input"><span>Shipment weight</span><div className="app-input"><input name="weight" type="number" min="1" max="5000" step="1" value={form.weight} onChange={updateForm} required /><span className="unit-suffix">lb</span></div><small>Whole numbers, 1–5,000 lb</small></label><div className="form-divider-app" /><div className="step-heading step-heading-mode"><span>02</span><div><h2>Choose your transport</h2><p>Pick a starting mode. You can compare every option next.</p></div></div><div className="transport-choices">{modes.map(({ id, label, icon: Icon, detail }) => <label className={`transport-choice${form.mode === id ? " choice-active" : ""}`} key={id}><input type="radio" name="mode" value={id} checked={form.mode === id} onChange={updateForm} /><span className="choice-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{detail}</small></span>{form.mode === id && <Check className="choice-check" size={15} />}</label>)}</div>{error && <div className="inline-error">{error}</div>}<button className="primary-button form-submit" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : <Sparkles size={16} />}{loading ? "Finding your routes…" : "Compare route options"}<ArrowRight size={15} /></button><p className="form-trust"><ShieldCheck size={14} /> Secure estimates. No obligation to book.</p></form><aside className="workflow-aside"><div className="aside-map"><div className="map-grid" /><div className="map-route map-route-one" /><div className="map-route map-route-two" /><span className="map-location map-location-one"><i />PICKUP</span><span className="map-location map-location-two"><i />DELIVERY</span><div className="map-plane"><Truck size={19} /></div><div className="map-badge"><span><span className="live-dot" />ROUTE READY</span><strong>Made for your move</strong></div></div><div className="aside-copy"><span className="aside-kicker"><Sparkles size={14} /> A BETTER WAY TO MOVE</span><h2>Every route<br />has a <span>smarter way.</span></h2><p>Compare your options side-by-side, then let your shipment take the route that makes sense.</p><div className="aside-perks"><span><Check size={14} />Clear pricing estimates</span><span><Check size={14} />Four transport modes</span><span><Check size={14} />Progress you can follow</span></div></div></aside></div>
    {quote && <section className="quote-results panel"><div className="panel-heading"><div><div className="page-eyebrow">YOUR ROUTE OPTIONS</div><h2>{quote.shipment.origin} <ArrowRight size={19} /> {quote.shipment.destination}</h2><p>{quote.shipment.weight} lb · Planning estimates in {quote.currency}</p></div><span className="estimate-badge">ESTIMATE #{quote.id.slice(0, 8).toUpperCase()}</span></div><div className="quote-option-list">{quote.estimates.map((estimate) => {const ModeIcon = modes.find((mode) => mode.id === estimate.id)?.icon || Truck; return <button key={estimate.id} type="button" className={`quote-option${selectedMode === estimate.id ? " quote-option-active" : ""}`} onClick={() => setSelectedMode(estimate.id)}><span className="choice-icon"><ModeIcon size={17} /></span><span className="quote-option-name"><strong>{estimate.name}</strong><small>Typical transit time</small></span><span className="quote-option-time">{estimate.transitTime}</span><strong className="quote-option-price">{formatCurrency(estimate.price)}</strong>{selectedMode === estimate.id && <span className="quote-option-selected"><Check size={14} /></span>}</button>;})}</div><div className="book-row"><p>Planning estimate only. Final carrier pricing may vary.</p><button className="primary-button" onClick={handleBook} disabled={booking}>{booking ? <span className="spinner" /> : <PackageCheck size={16} />}{booking ? "Booking shipment…" : user ? `Book ${selectedEstimate?.name} shipment` : `Sign in to book · ${formatCurrency(selectedEstimate?.price)}`}<ArrowRight size={15} /></button></div></section>}
  </div>;
}

function ShipmentsPage() {
  const { user } = useAuth();
  const { shipments, loading, error } = useShipments(user);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All shipments");
  const data = user ? shipments : demoShipments;
  const filtered = data.filter((shipment) => `${shipment.trackingCode} ${shipment.origin} ${shipment.destination}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All shipments" || shipment.status === filter));

  return <div className="page-content"><PageHeading eyebrow="YOUR LOGISTICS, ORGANIZED" title="Shipments" description="Follow every move from the first mile to the last." action={<Link className="primary-button" to="/shipments/new"><Plus size={16} />New shipment</Link>} />{!user && <div className="preview-notice"><Sparkles size={15} /><span>Sample shipment data. <Link to="/login">Sign in</Link> to manage your own shipments.</span></div>}{error && <div className="inline-error">{error}</div>}<section className="panel shipment-list-panel"><div className="list-toolbar"><div><strong>{filtered.length} shipments</strong><span>{user ? "in your workspace" : "in this sample view"}</span></div><div className="list-controls"><label className="list-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shipments" /></label><select className="select-button status-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All shipments</option><option>Booked</option><option>In transit</option><option>Delivered</option></select></div></div>{loading ? <div className="table-loading">Loading shipments…</div> : filtered.length ? <ShipmentTable shipments={filtered} sample={!user} /> : <div className="empty-state"><span><PackageCheck size={21} /></span><strong>No shipments match that search.</strong><p>Try a different tracking number or status.</p></div>}</section></div>;
}

function TrackPage() {
  const [code, setCode] = useState("");
  const [shipment, setShipment] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setShipment(null);
    try { const result = await api.track(code.trim()); setShipment(result.shipment); } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }

  return <div className="page-content tracking-page"><PageHeading eyebrow="KNOW WHERE IT'S GOING" title="Track a shipment." description="One tracking number. A clearer picture of the journey." /><div className="tracking-hero"><div className="tracking-illustration"><div className="tracking-globe"><span className="globe-latitude" /><span className="globe-longitude" /><div className="tracking-pin"><Compass size={21} /></div><span className="globe-point point-one" /><span className="globe-point point-two" /><span className="globe-point point-three" /></div><div className="tracking-float float-one"><span className="float-check"><Check size={12} /></span>On the move</div><div className="tracking-float float-two"><span className="float-dot" />Live updates</div></div><form className="track-form" onSubmit={handleSearch}><div className="page-eyebrow">SHIPMENT LOOKUP</div><h2>Where’s your shipment?</h2><p>Enter the tracking number from your booking confirmation.</p><label className="app-field"><span>TRACKING NUMBER</span><div className="app-input"><Search size={16} /><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. MM-4F29AB" minLength="4" maxLength="40" required /></div></label>{error && <div className="inline-error">{error}</div>}<button className="primary-button track-submit" disabled={loading}>{loading ? <span className="spinner" /> : <Search size={16} />}{loading ? "Looking it up…" : "Track shipment"}<ArrowRight size={15} /></button></form></div>{shipment && <TrackingResult shipment={shipment} />}</div>;
}

function TrackingResult({ shipment }) {
  return <section className="panel tracking-result"><div className="tracking-result-head"><div><div className="page-eyebrow">TRACKING DETAILS</div><h2>{shipment.trackingCode}</h2><p>{shipment.origin} <ArrowRight size={14} /> {shipment.destination}</p></div><StatusBadge status={shipment.status} /></div><div className="track-route-overview"><div><span>TRANSPORT MODE</span><strong>{shipment.mode}</strong></div><div><span>ESTIMATED ARRIVAL</span><strong>{formatDate(shipment.eta, { month: "long", day: "numeric", year: "numeric" })}</strong></div><div><span>SHIPMENT WEIGHT</span><strong>{shipment.weight} lb</strong></div></div><div className="timeline"><h3>Journey updates</h3>{shipment.events.slice().reverse().map((event, index) => <div className={`timeline-event${index === 0 ? " timeline-current" : ""}`} key={`${event.status}-${event.at}`}><span className="timeline-point">{index === 0 ? <Truck size={13} /> : <Check size={13} />}</span><span><strong>{event.status}</strong><small>{event.description}</small></span><time>{formatDate(event.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>)}</div></section>;
}

function ShipmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.shipment(id).then((result) => { if (active) setShipment(result.shipment); }).catch((reason) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return <div className="page-content"><PageHeading eyebrow={location.state?.created ? "BOOKING CONFIRMED" : "SHIPMENT DETAILS"} title={shipment?.trackingCode || "Shipment details"} description={location.state?.created ? "Your shipment is booked. Keep this tracking number handy." : "Follow your shipment from pickup through delivery."} action={<Link className="secondary-button" to="/track"><Compass size={15} />Track shipment</Link>} />{location.state?.created && <div className="success-banner"><span><Check size={15} /></span>Your shipment is confirmed. Updates will appear in the tracking timeline.</div>}{error && <div className="inline-error">{user ? error : <>Sign in to view your shipment details. <Link to="/login">Sign in</Link></>}</div>}{loading && <div className="table-loading">Loading shipment details…</div>}{shipment && <TrackingResult shipment={shipment} />}</div>;
}

function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function signOut() {
    try { await logout(); navigate("/"); } catch (reason) { setError(reason.message); }
  }

  if (!user) return <div className="page-content"><PageHeading eyebrow="WORKSPACE PROFILE" title="Account settings" description="Sign in to manage your MoveMate account." /><div className="panel account-panel-empty"><span className="empty-icon"><ShieldCheck size={23} /></span><h2>Make this workspace yours.</h2><p>Sign in or create an account to save shipments and track every delivery.</p><Link className="primary-button" to="/login">Sign in to MoveMate <ArrowRight size={15} /></Link></div></div>;

  return <div className="page-content"><PageHeading eyebrow="WORKSPACE PROFILE" title="Account settings" description="Your identity and workspace preferences." /><section className="panel account-settings"><div className="account-profile"><span className="account-avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>MoveMate member</small></span></div><div className="settings-row"><span><strong>Full name</strong><small>Your display name in the workspace</small></span><span>{user.name}</span></div><div className="settings-row"><span><strong>Email address</strong><small>Used for account access</small></span><span>{user.email}</span></div><div className="settings-row"><span><strong>Account security</strong><small>Your password is protected with a salted hash</small></span><span className="security-tag"><ShieldCheck size={14} />Protected</span></div>{error && <div className="inline-error">{error}</div>}<button className="secondary-button logout-button" onClick={signOut}><LogOut size={15} />Sign out</button></section></div>;
}

function LoginPage() {
  const { user, login, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [createAccount, setCreateAccount] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(createAccount ? form : { email: form.email, password: form.password }, createAccount);
      navigate(location.state?.from || "/", { replace: true });
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  function updateForm(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  return <div className="auth-page"><div className="auth-decoration"><div className="auth-brand"><Brand /></div><div className="auth-art"><div className="auth-art-orbit orbit-a" /><div className="auth-art-orbit orbit-b" /><div className="auth-art-center"><Truck size={43} /><span><Check size={14} /></span></div><div className="auth-art-route route-a" /><div className="auth-art-route route-b" /><div className="auth-art-label label-a"><span />MOVE WITH CONFIDENCE</div><div className="auth-art-label label-b"><span />EVERY STEP, CONNECTED</div></div><div className="auth-quote"><span className="auth-quote-mark">“</span><blockquote>Good logistics don’t have to be complicated. Great logistics feel like someone’s got your back.</blockquote><span>THE MOVEMATE WAY</span></div><div className="auth-decoration-footer">A smarter way to move things. <span>Since day one.</span></div></div><section className="auth-form-side"><div className="auth-mobile-brand"><Brand /></div><div className="auth-card"><span className="auth-badge"><ShieldCheck size={14} />YOUR PRIVATE WORKSPACE</span><h1>{createAccount ? <>Your next move<br />starts <span>here.</span></> : <>Welcome<br /><span>back.</span></>}</h1><p>{createAccount ? "Create your account and bring every shipment into one smarter workspace." : "Sign in to pick up right where you left off."}</p><form className="auth-form" onSubmit={handleSubmit}>{createAccount && <label className="app-field"><span>YOUR NAME</span><div className="app-input"><input name="name" value={form.name} onChange={updateForm} placeholder="How should we call you?" maxLength="60" required autoComplete="name" /></div></label>}<label className="app-field"><span>EMAIL ADDRESS</span><div className="app-input"><input type="email" name="email" value={form.email} onChange={updateForm} placeholder="you@company.com" maxLength="254" required autoComplete="email" /></div></label><label className="app-field"><span>PASSWORD <span className="field-hint">10 CHARACTERS MIN</span></span><div className="app-input"><input type="password" name="password" value={form.password} onChange={updateForm} placeholder="Enter your password" minLength="10" maxLength="128" required autoComplete={createAccount ? "new-password" : "current-password"} /></div></label>{error && <div className="inline-error">{error}</div>}<button className="primary-button auth-submit" disabled={busy || !ready}>{busy ? <span className="spinner" /> : <ShieldCheck size={15} />}{busy ? "One moment…" : createAccount ? "Create your account" : "Sign in to MoveMate"}<ArrowRight size={15} /></button></form><div className="auth-toggle">{createAccount ? "Already have a workspace?" : "New to MoveMate?"}<button onClick={() => {setCreateAccount(!createAccount); setError("");}}> {createAccount ? "Sign in" : "Create an account"}</button></div><div className="auth-legal"><ShieldCheck size={13} />Your password is encrypted before it’s stored.</div><Link className="auth-home-link" to="/">← Back to your workspace</Link></div></section></div>;
}

function NotFoundPage() {
  return <div className="not-found"><span>404</span><h1>This route got lost.</h1><p>Let’s get your logistics back on track.</p><Link className="primary-button" to="/">Go to overview <ArrowRight size={15} /></Link></div>;
}

export default function App() {
  return <Routes><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="shipments" element={<ShipmentsPage />} /><Route path="shipments/new" element={<NewShipmentPage />} /><Route path="shipments/:id" element={<ShipmentDetailPage />} /><Route path="track" element={<TrackPage />} /><Route path="account" element={<AccountPage />} /></Route><Route path="login" element={<LoginPage />} /><Route path="*" element={<NotFoundPage />} /></Routes>;
}
