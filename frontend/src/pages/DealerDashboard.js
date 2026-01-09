import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, User, Phone, Car, LogOut } from 'lucide-react';
import './DealerDashboard.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function DealerDashboard({ dealer, onLogout }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dealers/${dealer.dealership_id}/services`);
      const data = await response.json();
      setServices(data.services || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: services.length,
    requested: services.filter(s => s.status === 'Requested').length,
    inProgress: services.filter(s => s.status === 'In Progress').length,
    completed: services.filter(s => s.status === 'Completed').length
  };

  return (
    <div className="dealer-page">
      <div className="dealer-sidebar">
        <div className="dealer-header">
          <Car size={32} />
          <h2>{dealer.name}</h2>
        </div>
        <button className="nav-item logout-btn" onClick={onLogout} data-testid="dealer-logout">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>

      <div className="dealer-main">
        <div className="dealer-dashboard-header">
          <h1 data-testid="dealer-welcome">Service Dashboard</h1>
          <p>{dealer.location.address}</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Requests</div>
          </div>
          <div className="stat-card card">
            <div className="stat-value">{stats.requested}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card card">
            <div className="stat-value">{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card card">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        <div className="services-list">
          <h2>Service Requests</h2>
          {loading ? (
            <div className="spinner"></div>
          ) : services.length === 0 ? (
            <div className="no-services card">
              <p>No service requests</p>
            </div>
          ) : (
            services.map((service, idx) => (
              <div 
                key={idx} 
                className="dealer-service-card card" 
                onClick={() => navigate(`/dealer/service/${service.service_request_id}`)}
                data-testid={`dealer-service-${idx}`}
              >
                <div className="service-main-info">
                  <div>
                    <h3>
                      {service.selected_problem?.problem_name || 
                       (service.top_problems && service.top_problems.length > 0 
                        ? `${service.top_problems.length} Issues Detected`
                        : 'Service Request')}
                    </h3>
                    <p className="service-id">{service.service_request_id}</p>
                  </div>
                  <span className={`status-badge status-${service.status.toLowerCase().replace(' ', '-')}`}>
                    {service.status}
                  </span>
                </div>

                <div className="service-details">
                  <div className="detail">
                    <User size={16} />
                    <span>{service.customer_name}</span>
                  </div>
                  <div className="detail">
                    <Phone size={16} />
                    <span>{service.customer_phone}</span>
                  </div>
                  <div className="detail">
                    <Car size={16} />
                    <span>{service.vehicle_model} - {service.vehicle_registration}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default DealerDashboard;
