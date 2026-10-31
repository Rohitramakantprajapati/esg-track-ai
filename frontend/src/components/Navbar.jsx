import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Upload Document' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/auditor', label: 'Auditor Panel' },
  { to: '/reports', label: 'Reports' },
  { to: '/alerts', label: 'Alerts' },
];

function Navbar() {
  return (
    <header className="nav-shell">
      <div className="logo-block">ESG Track</div>
      <nav className="nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export default Navbar;
