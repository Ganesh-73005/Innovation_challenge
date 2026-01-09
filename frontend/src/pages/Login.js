import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import './Login.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function Login({ onLogin, onDealerLogin }) {
  const [isDealer, setIsDealer] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dealershipId, setDealershipId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        onLogin(data.customer, data.vehicles);
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDealerLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('dealership_id', dealershipId);
      formData.append('password', password);

      const response = await fetch(`${API_URL}/api/auth/dealer-login`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        onDealerLogin(data.dealer);
        navigate('/dealer/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="bg-gradient"></div>
      
      <div className="login-container">
        <div className="login-header">
          <Car size={48} className="logo-icon" />
          <h1>AutoCare Intelligence</h1>
          <p>Multi-Agent Automotive Service Platform</p>
        </div>

        <div className="login-tabs">
          <button 
            data-testid="customer-tab"
            className={`tab ${!isDealer ? 'active' : ''}`}
            onClick={() => setIsDealer(false)}
          >
            Customer
          </button>
          <button 
            data-testid="dealer-tab"
            className={`tab ${isDealer ? 'active' : ''}`}
            onClick={() => setIsDealer(true)}
          >
            Dealer
          </button>
        </div>

        {!isDealer ? (
          <form onSubmit={handleCustomerLogin} className="login-form" data-testid="customer-login-form">
            <div className="input-group">
              <label>Email</label>
              <input
                data-testid="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                data-testid="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <div className="error-message" data-testid="error-message">{error}</div>}
            <button data-testid="login-button" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div className="demo-credentials">
              <p>Demo: rajesh.sharma0@email.com / password123</p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDealerLogin} className="login-form" data-testid="dealer-login-form">
            <div className="input-group">
              <label>Dealership ID</label>
              <input
                data-testid="dealership-id-input"
                type="text"
                value={dealershipId}
                onChange={(e) => setDealershipId(e.target.value)}
                placeholder="DEALER_001"
                required
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                data-testid="dealer-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <div className="error-message" data-testid="error-message">{error}</div>}
            <button data-testid="dealer-login-button" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div className="demo-credentials">
              <p>Demo: DEALER_001 / dealer123</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
