import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Wrench, Package, Clock } from 'lucide-react';
import './CustomerDashboard.css';
import Sidebar from '../components/Sidebar';

function CustomerDashboard({ customer, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="dashboard-page">
      <Sidebar onLogout={onLogout} activePage="dashboard" />
      
      <div className="main-content">
        <div className="dashboard-header">
          <div>
            <h1 data-testid="welcome-message">Welcome back, {customer?.name?.split(' ')[0]}</h1>
            <p>Your personalized automotive service hub</p>
          </div>
        </div>

        <div className="car-showcase">
          <div className="car-visual-container">
            <div className="car-illustration">
              <div className="car-body"></div>
              <div className="car-wheel wheel-1"></div>
              <div className="car-wheel wheel-2"></div>
              <div className="car-window"></div>
            </div>
          </div>
          
          <div className="car-info">
            {customer?.vehicles && customer.vehicles.length > 0 ? (
              <div className="vehicle-card glass-card" data-testid="vehicle-info">
                <h3>{customer.vehicles[0].model}</h3>
                <div className="vehicle-details">
                  <div className="detail-item">
                    <span className="label">Registration</span>
                    <span className="value">{customer.vehicles[0].registration_number}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Year</span>
                    <span className="value">{customer.vehicles[0].year}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Color</span>
                    <span className="value">{customer.vehicles[0].color}</span>
                  </div>
                </div>
                <button 
                  data-testid="diagnose-button"
                  className="btn btn-primary"
                  onClick={() => navigate('/diagnose')}
                >
                  <Wrench size={18} />
                  Start Diagnosis
                </button>
              </div>
            ) : (
              <div className="no-vehicle">
                <Car size={48} />
                <p>No vehicles registered</p>
              </div>
            )}
          </div>
        </div>

        <div className="quick-actions">
          <div className="action-card card" onClick={() => navigate('/diagnose')} data-testid="diagnose-issue-card">
            <Wrench size={32} className="action-icon" />
            <h3>Diagnose Issue</h3>
            <p>AI-powered problem detection</p>
          </div>
          <div className="action-card card" onClick={() => navigate('/my-services')} data-testid="track-services-card">
            <Package size={32} className="action-icon" />
            <h3>Track Services</h3>
            <p>View ongoing repairs</p>
          </div>
          <div className="action-card card" data-testid="booking-history-card">
            <Clock size={32} className="action-icon" />
            <h3>History</h3>
            <p>Past service records</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerDashboard;
