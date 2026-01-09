import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Clock, DollarSign, CheckCircle, Loader, Map as MapIcon, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import './EstimatesComparison.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function EstimatesComparison({ customer, onLogout }) {
  const { conversationId } = useParams();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState(0);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEstimates();
    loadLeaflet();
  }, [conversationId]);

  useEffect(() => {
    if (showMap && mapReady && mapRef.current && !mapInstanceRef.current && estimates.length > 0) {
      initializeMap();
    }
  }, [showMap, mapReady, estimates]);

  useEffect(() => {
    if (mapInstanceRef.current && showMap && estimates.length > 0) {
      updateMapMarkers();
    }
  }, [selectedProblem, estimates, showMap]);

  const loadLeaflet = () => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => setMapReady(true);
      document.body.appendChild(script);
    } else if (window.L) {
      setMapReady(true);
    }
  };

  const fetchEstimates = async () => {
    try {
      console.log('Fetching estimates for conversation:', conversationId);
      const response = await fetch(`${API_URL}/api/estimate/${conversationId}`);

      if (!response.ok) {
        console.error('Estimates API error:', response.status, response.statusText);
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('Estimates data received:', data);
      setEstimates(data.estimates || []);
    } catch (err) {
      console.error('Error fetching estimates:', err);
      alert('Failed to load estimates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!window.L || !mapRef.current) return;

    // Default center (India - centered around typical dealership locations)
    let centerLat = 20.5937;
    let centerLng = 78.9629;
    let zoom = 5;

    const map = window.L.map(mapRef.current);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Calculate bounds from dealers
    const dealers = estimates[selectedProblem]?.dealerships || [];
    const validCoords = dealers.filter(d => d.coordinates?.lat && d.coordinates?.lng);

    if (validCoords.length > 0) {
      const bounds = validCoords.map(d => [d.coordinates.lat, d.coordinates.lng]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      // Fallback if no coordinates
      map.setView([centerLat, centerLng], zoom);
    }

    updateMapMarkers();
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const dealers = estimates[selectedProblem]?.dealerships || [];

    dealers.forEach((dealer, idx) => {
      // Debug: log coordinates
      console.log(`Dealer: ${dealer.name}, Coordinates:`, dealer.coordinates);

      // Skip if no coordinates
      if (!dealer.coordinates?.lat || !dealer.coordinates?.lng) {
        console.warn(`No coordinates for dealer: ${dealer.name}`, dealer.coordinates);
        return;
      }

      const isSelected = selectedDealer?.dealership_id === dealer.dealership_id;

      // Custom icon with number
      const icon = window.L.divIcon({
        className: 'custom-dealer-marker',
        html: `
          <div style="
            background: ${isSelected ? '#2563eb' : '#ef4444'};
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s;
          ">
            <span style="transform: rotate(45deg); font-weight: bold; font-size: 16px;">${idx + 1}</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [12, 40]
      });

      const marker = window.L.marker(
        [dealer.coordinates.lat, dealer.coordinates.lng],
        { icon }
      ).addTo(mapInstanceRef.current);

      // Format location address
      const locationStr = dealer.location?.address ||
        (dealer.location?.city && dealer.location?.state
          ? `${dealer.location.city}, ${dealer.location.state}`
          : 'Address not available');

      // Create popup content
      const popupContent = `
        <div style="min-width: 280px; font-family: system-ui;">
          <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
            <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #1f2937;">${dealer.name}</h3>
            <div style="display: flex; align-items: center; gap: 5px; color: #6b7280; font-size: 14px;">
              <span>⭐</span>
              <span>${dealer.rating ? dealer.rating.toFixed(1) : 'N/A'}/5</span>
            </div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: start; gap: 8px; margin-bottom: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span style="font-size: 13px; color: #4b5563; line-height: 1.4;">${locationStr}</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span style="font-size: 13px; color: #4b5563;">${Math.floor(dealer.estimated_time_minutes / 60)}h ${dealer.estimated_time_minutes % 60}m</span>
            </div>
          </div>

          <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            ${dealer.discount > 0 ? `
              <div style="text-decoration: line-through; color: #9ca3af; font-size: 13px; margin-bottom: 4px;">
                ₹${dealer.estimated_cost.toFixed(2)}
              </div>
            ` : ''}
            <div style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
              ₹${dealer.final_cost.toFixed(2)}
            </div>
            ${dealer.discount > 0 ? `
              <div style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; font-size: 12px; font-weight: 600;">
                Save ₹${dealer.discount.toFixed(2)}
              </div>
            ` : ''}
          </div>

          <div style="margin-bottom: 12px;">
            ${dealer.parts_available ? `
              <div style="display: flex; align-items: center; gap: 6px; color: #22c55e; font-size: 13px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>All parts available</span>
              </div>
            ` : `
              <div style="display: flex; align-items: center; gap: 6px; color: #f59e0b; font-size: 13px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Parts need ordering</span>
              </div>
            `}
          </div>

          <button 
            onclick="window.bookDealer_${dealer.dealership_id.replace(/[^a-zA-Z0-9]/g, '_')}()"
            style="
              width: 100%;
              background: #2563eb;
              color: white;
              border: none;
              padding: 12px 16px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#1d4ed8'"
            onmouseout="this.style.background='#2563eb'"
          >
            Book All 3 Issues
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 320,
        className: 'custom-popup'
      });

      marker.on('click', () => {
        setSelectedDealer(dealer);
      });

      // Create global booking function for this dealer
      window[`bookDealer_${dealer.dealership_id.replace(/[^a-zA-Z0-9]/g, '_')}`] = () => {
        handleBooking(dealer);
      };

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (markersRef.current.length > 0) {
      const group = window.L.featureGroup(markersRef.current);
      try {
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1), { maxZoom: 15 });
      } catch (e) {
        console.warn('Could not fit bounds:', e);
      }
    }
  };

  const handleBooking = async (dealer) => {
    if (!window.confirm(`Book appointment with ${dealer.name} for all 3 issues?`)) {
      return;
    }

    setBookingInProgress(true);

    try {
      const response = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.customer_id,
          vehicle_id: customer.vehicles[0].vehicle_id,
          dealership_id: dealer.dealership_id,
          conversation_id: conversationId,
          top_problems: estimates.map(e => ({
            problem_id: e.problem_id,
            problem_name: e.problem_name
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Booking confirmed! The dealership will review all 3 potential issues. Check "My Services" for tracking.');
        navigate('/my-services');
      } else {
        const error = await response.json();
        alert(error.detail || 'Booking failed. Please try again.');
      }
    } catch (err) {
      console.error('Booking error:', err);
      alert('Booking failed. Please try again.');
    } finally {
      setBookingInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="estimates-page">
        <Sidebar onLogout={onLogout} />
        <div className="main-content">
          <div className="loading-container" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '400px'
          }}>
            <Loader className="spinner" size={48} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading estimates...</p>
          </div>
        </div>
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <div className="estimates-page">
        <Sidebar onLogout={onLogout} />
        <div className="main-content">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2>No estimates available</h2>
            <p>Please start a new diagnosis.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/diagnose')}
              style={{ marginTop: '20px' }}
            >
              Start New Diagnosis
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="estimates-page">
      <Sidebar onLogout={onLogout} />

      <div className="main-content">
        <div className="estimates-header">
          <h1>Service Estimates</h1>
          <p>Compare prices and services across dealerships for your top 3 issues</p>
          <div className="view-toggle">
            <button
              className={!showMap ? 'active' : ''}
              onClick={() => setShowMap(false)}
            >
              List View
            </button>
            <button
              className={showMap ? 'active' : ''}
              onClick={() => setShowMap(true)}
            >
              <MapIcon size={16} />
              Map View
            </button>
          </div>
        </div>

        <div className="problem-tabs">
          {estimates.map((est, idx) => (
            <button
              key={idx}
              data-testid={`problem-tab-${idx}`}
              className={`problem-tab ${selectedProblem === idx ? 'active' : ''}`}
              onClick={() => setSelectedProblem(idx)}
            >
              <span className="tab-number">{idx + 1}</span>
              <span className="tab-name">{est.problem_name}</span>
            </button>
          ))}
        </div>

        {!showMap ? (
          <div className="dealers-grid">
            {estimates[selectedProblem]?.dealerships?.length > 0 ? (
              estimates[selectedProblem].dealerships.map((dealer, dIdx) => (
                <div key={dIdx} className="dealer-card card" data-testid={`dealer-card-${dIdx}`}>
                  <div className="dealer-header">
                    <h3>{dealer.name}</h3>
                    <div className="rating">
                      <span>⭐</span>
                      <span>{dealer.rating ? dealer.rating.toFixed(1) : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="dealer-info">
                    <div className="info-item">
                      <MapPin size={18} />
                      <span>
                        {dealer.location?.address ||
                          (dealer.location?.city && dealer.location?.state
                            ? `${dealer.location.city}, ${dealer.location.state}`
                            : 'Address not available')}
                      </span>
                    </div>
                    <div className="info-item">
                      <Clock size={18} />
                      <span>{Math.floor(dealer.estimated_time_minutes / 60)}h {dealer.estimated_time_minutes % 60}m</span>
                    </div>
                  </div>

                  <div className="pricing">
                    {dealer.discount > 0 && (
                      <div className="original-price">₹{dealer.estimated_cost.toFixed(2)}</div>
                    )}
                    <div className="final-price">
                      ₹{dealer.final_cost.toFixed(2)}
                    </div>
                    {dealer.discount > 0 && (
                      <div className="discount-badge">Save ₹{dealer.discount.toFixed(2)}</div>
                    )}
                  </div>

                  {dealer.parts_available ? (
                    <div className="availability available">
                      <CheckCircle size={16} />
                      <span>All parts available</span>
                    </div>
                  ) : (
                    <div className="availability unavailable">
                      <Clock size={16} />
                      <span>Parts need ordering</span>
                    </div>
                  )}

                  <button
                    data-testid={`book-button-${dIdx}`}
                    className="btn btn-primary"
                    onClick={() => handleBooking(dealer)}
                    disabled={bookingInProgress}
                  >
                    {bookingInProgress ? 'Booking...' : 'Book All 3 Issues'}
                  </button>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                <p>No dealers available for this problem.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="map-view-wrapper" style={{ position: 'relative', marginTop: '20px' }}>
            <div
              ref={mapRef}
              style={{
                width: '100%',
                height: '600px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                backgroundColor: '#f0f0f0'
              }}
            />
            {!mapReady && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '10px', margin: 0 }}>Loading map...</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
          width: 280px !important;
        }
        .custom-popup .leaflet-popup-tip {
          background: white;
        }
        .leaflet-container {
          font-family: system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </div>
  );
}

export default EstimatesComparison;