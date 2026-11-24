import {
  ArrowLeftRight,
  CarFront,
  Globe2,
  Home,
  List,
  Settings2,
  SlidersHorizontal,
  Users,
} from "lucide-react";

export function Header({ en, toggleLang, goHome, connected }) {
  return (
    <header>
      <button className="brand" onClick={goHome} aria-label="Victoria-Taxi">
        <span className="brand-icon">
          <CarFront size={24} />
        </span>
        Victoria<span className="brand-light">Taxi</span>
      </button>
      <div className="header-right">
        {!connected && <span className="demo">{en ? "Local demo" : "Demo local"}</span>}
        <button
          className="language"
          onClick={toggleLang}
          aria-label={en ? "Cambiar a español" : "Switch to English"}
        >
          <Globe2 size={16} />
          {en ? "ES" : "EN"}
        </button>
      </div>
    </header>
  );
}

export function Sidebar({
  t,
  role,
  profile,
  tab,
  navigate,
  changeProfile,
  en,
}) {
  const links = [
    ["overview", Home],
    ["drivers", Users],
    ["trips", List],
    ["rates", SlidersHorizontal],
    ["settings", Settings2],
  ];
  return (
    <aside>
      <div className="identity">
        <span className="avatar">{profile.initials}</span>
        <div>
          <strong>{profile.name}</strong>
          <small>{t[role]}</small>
        </div>
      </div>
      {role === "admin" && (
        <nav>
          {links.map(([key, Icon]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={17} />
              {t[key]}
            </button>
          ))}
        </nav>
      )}
      <button className="switch" onClick={changeProfile}>
        <ArrowLeftRight size={16} />
        {en ? "Switch profile" : "Cambiar perfil"}
      </button>
    </aside>
  );
}

