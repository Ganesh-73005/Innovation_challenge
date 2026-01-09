import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import CustomerDashboard from './pages/CustomerDashboard';
import DiagnosisChat from './pages/DiagnosisChat';
import EstimatesComparison from './pages/EstimatesComparison';
import MyServices from './pages/MyServices';
import DealerDashboard from './pages/DealerDashboard';
import DealerServiceDetail from './pages/DealerServiceDetail';

function App() {
  const [customer, setCustomer] = useState(null);
  const [dealer, setDealer] = useState(null);

  useEffect(() => {
    const savedCustomer = localStorage.getItem('customer');
    const savedDealer = localStorage.getItem('dealer');
    if (savedCustomer) setCustomer(JSON.parse(savedCustomer));
    if (savedDealer) setDealer(JSON.parse(savedDealer));
  }, []);

  const handleLogin = (userData, vehicles) => {
    setCustomer({ ...userData, vehicles });
    localStorage.setItem('customer', JSON.stringify({ ...userData, vehicles }));
  };

  const handleDealerLogin = (dealerData) => {
    setDealer(dealerData);
    localStorage.setItem('dealer', JSON.stringify(dealerData));
  };

  const handleLogout = () => {
    setCustomer(null);
    setDealer(null);
    localStorage.removeItem('customer');
    localStorage.removeItem('dealer');
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login onLogin={handleLogin} onDealerLogin={handleDealerLogin} />} />
          <Route 
            path="/dashboard" 
            element={customer ? <CustomerDashboard customer={customer} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/diagnose" 
            element={customer ? <DiagnosisChat customer={customer} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/estimates/:conversationId" 
            element={customer ? <EstimatesComparison customer={customer} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/my-services" 
            element={customer ? <MyServices customer={customer} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/dealer/dashboard" 
            element={dealer ? <DealerDashboard dealer={dealer} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/dealer/service/:serviceId" 
            element={dealer ? <DealerServiceDetail dealer={dealer} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
