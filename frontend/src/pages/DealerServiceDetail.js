import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Check } from 'lucide-react';
import './DealerServiceDetail.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function DealerServiceDetail({ dealer }) {
  const { serviceId } = useParams();
  const [service, setService] = useState(null);
  const [status, setStatus] = useState('');
  const [cost, setCost] = useState('');
  const [time, setTime] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchServiceDetail();
  }, [serviceId]);

  const fetchServiceDetail = async () => {
    try {
      const response = await fetch(`${API_URL}/api/services/${serviceId}`);
      if (!response.ok) {
        throw new Error('Service not found');
      }
      const data = await response.json();
      const found = data.service;
      if (found) {
        setService(found);
        setStatus(found.status || 'Requested');
        setCost(found.final_cost || '');
        setTime(found.final_time_minutes || '');
        setSelectedProblemId(found.selected_problem?.problem_id || '');
        if (found.selected_problem?.problem_name) {
          setSearchQuery(found.selected_problem.problem_name);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/problems/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.problems || []);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleSelectProblem = async (problem) => {
    setSelectedProblemId(problem.problem_id);
    setSearchQuery(problem.problem_name);
    setShowSearch(false);
    
    // Auto-calculate cost and time based on problem using backend
    try {
      // First get the problem details
      const problemResponse = await fetch(`${API_URL}/api/problems/search?query=${encodeURIComponent(problem.problem_id)}`);
      const problemData = await problemResponse.json();
      const fullProblem = problemData.problems?.find(p => p.problem_id === problem.problem_id) || problem;
      
      // Calculate using backend logic
      const partsResponse = await fetch(`${API_URL}/api/dealers/${dealer.dealership_id}/parts?problem_id=${problem.problem_id}`);
      const partsData = await partsResponse.json();
      
      const labourResponse = await fetch(`${API_URL}/api/dealers/${dealer.dealership_id}/labour`);
      const labourData = await labourResponse.json();
      
      // Calculate cost
      let partsCost = 0;
      if (partsData.parts) {
        partsCost = partsData.parts.reduce((sum, part) => sum + (part.cost || 0), 0);
      }
      
      // Find matching labour
      const matchingLabour = labourData.labour?.find(l => l.labour_category === fullProblem.labour_category);
      const labourHours = fullProblem.estimated_labour_hours || 0;
      const labourCost = matchingLabour ? labourHours * matchingLabour.hourly_rate : 0;
      
      const totalCost = partsCost + labourCost;
      const totalTime = fullProblem.estimated_service_time_minutes || 0;
      
      setCost(totalCost.toFixed(2));
      setTime(totalTime);
    } catch (err) {
      console.error('Auto-fill error:', err);
      // Fallback to problem defaults
      if (problem.estimated_service_time_minutes) {
        setTime(problem.estimated_service_time_minutes);
      }
    }
  };

  const handleUpdate = async () => {
    if (!selectedProblemId && !service.selected_problem) {
      alert('Please select or search for an actual issue');
      return;
    }

    if (!cost || !time) {
      alert('Please provide cost and time estimates');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_request_id: serviceId,
          status,
          selected_problem_id: selectedProblemId || service.selected_problem?.problem_id,
          final_cost: parseFloat(cost),
          final_time_minutes: parseInt(time)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Update failed');
      }

      alert('Service updated successfully! Customer will see the changes in their service tracking page.');
      navigate('/dealer/dashboard');
    } catch (err) {
      console.error('Update error:', err);
      alert(err.message || 'Update failed. Please try again.');
    }
  };

  if (loading) {
    return <div className="dealer-detail-page"><div className="spinner"></div></div>;
  }

  if (!service) {
    return <div className="dealer-detail-page"><p>Service not found</p></div>;
  }

  return (
    <div className="dealer-detail-page">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/dealer/dashboard')}>
          <ArrowLeft size={20} />
          Back
        </button>
        <h1>Service Details</h1>
      </div>

      <div className="detail-content">
        <div className="detail-card card">
          <h2>Customer Information</h2>
          <div className="detail-grid">
            <div className="detail-row">
              <span className="label">Service ID</span>
              <span className="value">{service.service_request_id}</span>
            </div>
            <div className="detail-row">
              <span className="label">Customer</span>
              <span className="value">{service.customer_name}</span>
            </div>
            <div className="detail-row">
              <span className="label">Phone</span>
              <span className="value">{service.customer_phone}</span>
            </div>
            <div className="detail-row">
              <span className="label">Vehicle</span>
              <span className="value">{service.vehicle_model} - {service.vehicle_registration}</span>
            </div>
          </div>

          {service.top_problems && service.top_problems.length > 0 && (
            <div className="top-problems-section">
              <h3>AI Detected Top 3 Issues:</h3>
              <p className="section-description">Select one of these or search for a different issue</p>
              <div className="problems-list">
                {service.top_problems.map((prob, idx) => (
                  <div 
                    key={idx} 
                    className={`problem-option ${selectedProblemId === prob.problem_id ? 'selected' : ''}`}
                    onClick={async () => {
                      setSelectedProblemId(prob.problem_id);
                      setSearchQuery(prob.problem_name);
                      
                      // Auto-fill cost and time when selecting from top 3
                      if (prob.estimated_cost) {
                        setCost(prob.estimated_cost.toFixed(2));
                      } else {
                        // Fetch full problem details if cost not available
                        await handleSelectProblem({ problem_id: prob.problem_id, problem_name: prob.problem_name });
                        return;
                      }
                      
                      if (prob.estimated_time_minutes) {
                        setTime(prob.estimated_time_minutes);
                      }
                    }}
                  >
                    {selectedProblemId === prob.problem_id && <Check size={18} className="check-icon" />}
                    <div>
                      <p className="problem-name">{prob.problem_name}</p>
                      {prob.estimated_cost && prob.estimated_time_minutes ? (
                        <p className="problem-cost">
                          Est: ₹{prob.estimated_cost.toFixed(2)} | {Math.floor(prob.estimated_time_minutes / 60)}h {prob.estimated_time_minutes % 60}m
                        </p>
                      ) : (
                        <p className="problem-cost">Click to calculate cost and time</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="update-card card">
          <h3>Update Service</h3>
          
          <div className="input-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="status-select">
              <option value="Requested">Requested</option>
              <option value="Approved">Approved</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="input-group">
            <label>Select/Search Issue</label>
            <div className="search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowSearch(true)}
                placeholder="Search for actual issue..."
                data-testid="issue-search"
              />
              <Search size={18} className="search-icon" />
            </div>
            
            {showSearch && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((problem, idx) => (
                  <div
                    key={idx}
                    className="search-result-item"
                    onClick={() => handleSelectProblem(problem)}
                    data-testid={`search-result-${idx}`}
                  >
                    <p className="result-name">{problem.problem_name}</p>
                    <p className="result-desc">
                      {problem.detailed_description?.[0] || problem.description || 'No description available'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="search-results">
                <p className="no-results">No matching issues found</p>
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Final Cost (₹)</label>
            <input 
              type="number" 
              value={cost} 
              onChange={(e) => setCost(e.target.value)} 
              data-testid="cost-input"
            />
          </div>

          <div className="input-group">
            <label>Estimated Time (minutes)</label>
            <input 
              type="number" 
              value={time} 
              onChange={(e) => setTime(e.target.value)} 
              data-testid="time-input"
            />
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleUpdate} 
            data-testid="update-service-button"
          >
            Update Service
          </button>
        </div>
      </div>
    </div>
  );
}

export default DealerServiceDetail;
