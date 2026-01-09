import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Car, LayoutDashboard, MessageSquare, Package, LogOut } from 'lucide-react';
import './Sidebar.css';

function Sidebar({ onLogout, activePage }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', testId: 'nav-dashboard' },
    { path: '/diagnose', icon: MessageSquare, label: 'Diagnose', testId: 'nav-diagnose' },
    { path: '/my-services', icon: Package, label: 'My Services', testId: 'nav-services' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Car size={32} className="sidebar-logo" />
        <h2>AutoCare</h2>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              data-testid={item.testId}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button className="nav-item logout-btn" onClick={onLogout} data-testid="logout-button">
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </div>
  );
}

export default Sidebar;
