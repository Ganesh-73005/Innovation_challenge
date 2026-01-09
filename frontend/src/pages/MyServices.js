import React, { useState, useEffect } from 'react';
import { Clock, MapPin } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import './MyServices.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function MyServices({ customer, onLogout }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
    // Refresh every 30 seconds to get dealer updates
    const interval = setInterval(fetchServices, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(`${API_URL}/api/customers/${customer.customer_id}/services`);
      const data = await response.json();
      setServices(data.services || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="services-page">
        <Sidebar onLogout={onLogout} activePage="my-services" />
        <div className="main-content">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="services-page">
      <Sidebar onLogout={onLogout} activePage="my-services" />
      
      <div className="main-content">
        <div className="services-header">
          <h1>My Services</h1>
          <p>Track your vehicle service requests</p>
        </div>

        {services.length === 0 ? (
          <div className="no-services card">
            <p>No service requests yet</p>
          </div>
        ) : (
          <div className="services-grid">
            {services.map((service, idx) => (
              <div key={idx} className="service-card card" data-testid={`service-card-${idx}`}>
                <div className="service-header">
                  <div>
                    <h3>Service Request</h3>
                    {service.selected_problem ? (
                      <p className="selected-issue">Issue: {service.selected_problem.problem_name}</p>
                    ) : (
                      <p className="pending-diagnosis">Awaiting dealer diagnosis</p>
                    )}
                  </div>
                  <span className={`status-badge status-${service.status.toLowerCase().replace(' ', '-')}`}>
                    {service.status}
                  </span>
                </div>

                {service.top_problems && service.top_problems.length > 0 && (
                  <div className="top-problems">
                    <p className="section-label">Top 3 Detected Issues:</p>
                    {service.top_problems.map((prob, pIdx) => (
                      <div key={pIdx} className="problem-item">
                        {pIdx + 1}. {prob.problem_name}
                      </div>
                    ))}
                  </div>
                )}

                <div className="service-info">
                  <div className="info-row">
                    <span className="label">Service ID</span>
                    <span className="value">{service.service_request_id}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Dealership</span>
                    <span className="value">{service.dealership_name}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Vehicle</span>
                    <span className="value">{service.vehicle_model} - {service.vehicle_registration}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Final Cost</span>
                    <span className="value cost">₹{service.final_cost?.toFixed(2)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Estimated Time</span>
                    <span className="value">
                      <Clock size={14} />
                      {Math.floor(service.final_time_minutes / 60)}h {service.final_time_minutes % 60}m
                    </span>
                  </div>
                </div>

                <div className="service-date">
                  Booked: {new Date(service.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyServices;
