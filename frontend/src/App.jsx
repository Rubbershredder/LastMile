import React, { useState, useEffect, useRef } from 'react';
import { FaLeaf, FaShieldAlt, FaStar, FaRoute, FaExchangeAlt, FaCalendarAlt, 
         FaSearch, FaMapMarkerAlt, FaWalking, FaBus, FaCarSide, FaBicycle } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default marker icons in Leaflet with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for start, end, and transit points
const startIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const endIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const transitIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: iconShadow,
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -34]
});

// Component to recenter map when locations change
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

function App() {
  // State for map and transportation data
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Default: NYC
  const [mapZoom, setMapZoom] = useState(13);
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [transportOptions, setTransportOptions] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeFilter, setRouteFilter] = useState({
    eco: false,
    budget: false,
    fastest: true,
    safety: false
  });
  
  // State for route visualization
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  
  // State for impact tracking
  const [userImpact, setUserImpact] = useState({
    carbonSaved: 156,
    moneySaved: 275,
    tripsCompleted: 18
  });
  
  // State for chatbot
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Hi there! Need help finding eco-friendly routes in your area?' }
  ]);
  const [userMessage, setUserMessage] = useState('');

  // Mock geocoding function - in a real app, this would call a geocoding API
  const geocodeLocation = (address) => {
    return new Promise((resolve, reject) => {
      // Simulate API call delay
      setTimeout(() => {
        // Mock geocoding results
        let result;
        if (address.toLowerCase().includes('times square')) {
          result = { lat: 40.7580, lng: -73.9855 };
        } else if (address.toLowerCase().includes('central park')) {
          result = { lat: 40.7812, lng: -73.9665 };
        } else if (address.toLowerCase().includes('brooklyn')) {
          result = { lat: 40.6782, lng: -73.9442 };
        } else if (address.toLowerCase().includes('queens')) {
          result = { lat: 40.7282, lng: -73.7949 };
        } else {
          // Generate random location near NYC for demo purposes
          result = { 
            lat: 40.7128 + (Math.random() - 0.5) * 0.05, 
            lng: -74.0060 + (Math.random() - 0.5) * 0.05 
          };
        }
        resolve(result);
      }, 300);
    });
  };
  
  // Mock function to generate path between two points
  const generatePath = (start, end, routeType) => {
    // In a real app, this would call a routing API like MapBox Directions, Google Directions, etc.
    
    // Create a slightly curved route between points
    const numPoints = 10;
    const path = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;
      
      // Create a curved path by adding some randomness
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;
      
      // Add some curvature (more for bus/transit routes, less for direct routes)
      const curveFactor = routeType === 'shared-ride' ? 0.005 : 0.015;
      const curve = Math.sin(ratio * Math.PI) * curveFactor;
      
      // Push point with curvature
      path.push([
        lat + curve * (start.lng - end.lng),
        lng + curve * (end.lat - start.lat)
      ]);
    }
    
    return path;
  };
  
  // Generate transit points along a route
  const generateTransitPoints = (path, segments) => {
    if (!segments) return [];
    
    const points = [];
    let cumulative = 0;
    
    segments.forEach((segment, index) => {
      if (index === 0) return; // Skip first segment marker (covered by start)
      
      // Calculate position along path based on cumulative duration
      cumulative += segments[index - 1].duration;
      const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
      const ratio = Math.min(cumulative / totalDuration, 1);
      
      // Find closest point on path
      const pointIndex = Math.floor(ratio * (path.length - 1));
      points.push({
        position: path[pointIndex],
        type: segment.mode,
        details: segment
      });
    });
    
    return points;
  };
  
  // Mock function to search for routes
  const searchRoutes = async () => {
    if (!startLocation || !endLocation) return;
    
    try {
      // Geocode the locations
      const startCoords = await geocodeLocation(startLocation);
      const endCoords = await geocodeLocation(endLocation);
      
      // Update map center to be between start and end
      const newCenter = {
        lat: (startCoords.lat + endCoords.lat) / 2,
        lng: (startCoords.lng + endCoords.lng) / 2
      };
      setMapCenter(newCenter);
      
      // Calculate appropriate zoom level based on distance
      const distance = Math.sqrt(
        Math.pow(startCoords.lat - endCoords.lat, 2) + 
        Math.pow(startCoords.lng - endCoords.lng, 2)
      );
      const newZoom = distance > 0.05 ? 12 : 13;
      setMapZoom(newZoom);
      
      // In a real implementation, this would call your Flask API
      // Simulate API delay
      setTimeout(() => {
        // Mock data for demonstration
        const mockRoutes = [
          {
            id: 1,
            type: 'multimodal',
            description: 'Walk → Bus Route 42 → Walk',
            duration: 28,
            cost: 2.75,
            carbonFootprint: 0.8,
            safetyRating: 4.7,
            departureTime: '12:05 PM',
            arrivalTime: '12:33 PM',
            segments: [
              { mode: 'walking', duration: 5, distance: 0.3 },
              { mode: 'bus', duration: 18, distance: 3.2, line: '42' },
              { mode: 'walking', duration: 5, distance: 0.4 }
            ],
            startCoords: startCoords,
            endCoords: endCoords
          },
          {
            id: 2,
            type: 'shared-ride',
            description: 'CarPool Service (3 passengers)',
            duration: 18,
            cost: 8.50,
            carbonFootprint: 1.2,
            safetyRating: 4.5,
            departureTime: '12:10 PM',
            arrivalTime: '12:28 PM',
            provider: 'GreenRide',
            verifiedDriver: true,
            startCoords: startCoords,
            endCoords: endCoords
          },
          {
            id: 3,
            type: 'bike-share',
            description: 'City Bike Share',
            duration: 25,
            cost: 3.50,
            carbonFootprint: 0.0,
            safetyRating: 3.9,
            departureTime: 'Depart now',
            arrivalTime: '12:35 PM',
            startCoords: startCoords,
            endCoords: endCoords
          },
          {
            id: 4,
            type: 'public-transit',
            description: 'Subway Line A → Walk',
            duration: 22,
            cost: 2.75,
            carbonFootprint: 0.5,
            safetyRating: 4.2,
            departureTime: '12:08 PM',
            arrivalTime: '12:30 PM',
            segments: [
              { mode: 'subway', duration: 15, distance: 4.1, line: 'A' },
              { mode: 'walking', duration: 7, distance: 0.6 }
            ],
            startCoords: startCoords,
            endCoords: endCoords
          }
        ];
        
        setTransportOptions(mockRoutes);
        
        // Select first route and generate its path
        const firstRoute = mockRoutes[0];
        setSelectedRoute(firstRoute);
        
        // Generate path for visualization
        const path = generatePath(startCoords, endCoords, firstRoute.type);
        setRouteCoordinates(path);
        
        // Generate transit points if route has segments
        if (firstRoute.segments) {
          const points = generateTransitPoints(path, firstRoute.segments);
          setRoutePoints(points);
        } else {
          setRoutePoints([]);
        }
      }, 1000);
    } catch (error) {
      console.error("Error searching for routes:", error);
    }
  };
  
  // Handle chat submissions
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!userMessage.trim()) return;
    
    // Add user message
    setChatMessages([...chatMessages, { sender: 'user', text: userMessage }]);
    
    // Simulate bot response based on user input
    setTimeout(() => {
      let botResponse = "I'm sorry, I don't have information about that yet.";
      
      if (userMessage.toLowerCase().includes('carbon') || userMessage.toLowerCase().includes('eco')) {
        botResponse = "Taking the bus route I suggested will save 2.3kg of CO2 compared to driving alone!";
      } else if (userMessage.toLowerCase().includes('save') || userMessage.toLowerCase().includes('money')) {
        botResponse = "The current bus route is $5.75 cheaper than a taxi for this journey.";
      } else if (userMessage.toLowerCase().includes('safe') || userMessage.toLowerCase().includes('security')) {
        botResponse = "The subway option has a 4.2/5 safety rating based on 458 verified user reviews.";
      } else if (userMessage.toLowerCase().includes('time') || userMessage.toLowerCase().includes('fast')) {
        botResponse = "The shared ride option is fastest at 18 minutes, but the subway is only 4 minutes longer and more eco-friendly!";
      }
      
      setChatMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 1000);
    
    setUserMessage('');
  };
  
  // Update route visualization when a new route is selected
  useEffect(() => {
    if (selectedRoute) {
      const path = generatePath(
        selectedRoute.startCoords, 
        selectedRoute.endCoords, 
        selectedRoute.type
      );
      setRouteCoordinates(path);
      
      if (selectedRoute.segments) {
        const points = generateTransitPoints(path, selectedRoute.segments);
        setRoutePoints(points);
      } else {
        setRoutePoints([]);
      }
    }
  }, [selectedRoute]);
  
  // Filter routes based on preferences
  const applyRouteFilters = () => {
    // This would filter the actual data from your API
    console.log("Applied filters:", routeFilter);
  };
  
  // Effect to apply filters when they change
  useEffect(() => {
    if (transportOptions.length > 0) {
      applyRouteFilters();
    }
  }, [routeFilter]);
  
  // Helper function to get icon for transport type
  const getTransportIcon = (type) => {
    switch(type) {
      case 'walking': return <FaWalking />;
      case 'bus': case 'public-transit': return <FaBus />;
      case 'shared-ride': return <FaCarSide />;
      case 'bike-share': return <FaBicycle />;
      default: return <FaRoute />;
    }
  };
  
  return (
    <div className="app">
      <header>
        <nav>
          <div className="logo">
            <span className="logo-text">Last Mile</span>
          </div>
          <ul className="nav-links">
            <li><a href="#about">About</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#impact">Impact</a></li>
          </ul>
        </nav>
      </header>
      
      <main className="map-interface">
        <div className="sidebar">
          <div className="search-panel">
            <h2>Plan Your Journey</h2>
            <div className="location-inputs">
              <div className="input-group">
                <FaMapMarkerAlt className="input-icon start" />
                <input 
                  type="text" 
                  placeholder="Starting point (e.g. Times Square)" 
                  value={startLocation} 
                  onChange={(e) => setStartLocation(e.target.value)} 
                />
              </div>
              <div className="input-group">
                <FaMapMarkerAlt className="input-icon end" />
                <input 
                  type="text" 
                  placeholder="Destination (e.g. Central Park)" 
                  value={endLocation} 
                  onChange={(e) => setEndLocation(e.target.value)} 
                />
              </div>
              <button className="search-btn" onClick={searchRoutes}>
                <FaSearch /> Find Routes
              </button>
            </div>
            
            <div className="filter-options">
              <h3>Optimize for:</h3>
              <div className="filter-toggles">
                <button 
                  className={`filter-btn ${routeFilter.eco ? 'active' : ''}`}
                  onClick={() => setRouteFilter({...routeFilter, eco: !routeFilter.eco})}
                >
                  <FaLeaf /> Eco-Friendly
                </button>
                <button 
                  className={`filter-btn ${routeFilter.budget ? 'active' : ''}`}
                  onClick={() => setRouteFilter({...routeFilter, budget: !routeFilter.budget})}
                >
                  <span>$</span> Budget
                </button>
                <button 
                  className={`filter-btn ${routeFilter.fastest ? 'active' : ''}`}
                  onClick={() => setRouteFilter({...routeFilter, fastest: !routeFilter.fastest})}
                >
                  <span>⏱</span> Fastest
                </button>
                <button 
                  className={`filter-btn ${routeFilter.safety ? 'active' : ''}`}
                  onClick={() => setRouteFilter({...routeFilter, safety: !routeFilter.safety})}
                >
                  <FaShieldAlt /> Safety
                </button>
              </div>
            </div>
          </div>
          
          <div className="results-panel">
            <h3>Available Routes</h3>
            {transportOptions.length > 0 ? (
              <div className="route-options">
                {transportOptions.map(route => (
                  <div 
                    key={route.id} 
                    className={`route-card ${selectedRoute && selectedRoute.id === route.id ? 'selected' : ''}`}
                    onClick={() => setSelectedRoute(route)}
                  >
                    <div className="route-icon">
                      {getTransportIcon(route.type)}
                    </div>
                    <div className="route-details">
                      <h4>{route.description}</h4>
                      <div className="route-stats">
                        <span><span>⏱</span> {route.duration} min</span>
                        <span><span>$</span> ${route.cost.toFixed(2)}</span>
                        <span><FaLeaf /> {route.carbonFootprint} kg CO2</span>
                      </div>
                      <div className="route-times">
                        <span>{route.departureTime}</span> → <span>{route.arrivalTime}</span>
                      </div>
                    </div>
                    <div className="route-rating">
                      <div className="safety-rating">
                        <FaShieldAlt />
                        <span>{route.safetyRating}</span>
                      </div>
                      <div className="reviews-link">
                        <FaStar />
                        <span>Reviews</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              startLocation && endLocation ? (
                <div className="searching-message">Searching for routes...</div>
              ) : (
                <div className="empty-message">Enter your starting point and destination to find routes</div>
              )
            )}
          </div>
          
          <div className="user-impact">
            <h3>Your Impact</h3>
            <div className="impact-metrics">
              <div className="impact-metric">
                <FaLeaf className="impact-icon" />
                <div className="impact-data">
                  <span className="impact-value">{userImpact.carbonSaved} kg</span>
                  <span className="impact-label">CO2 Saved</span>
                </div>
              </div>
              <div className="impact-metric">
                <span className="impact-icon">$</span>
                <div className="impact-data">
                  <span className="impact-value">${userImpact.moneySaved}</span>
                  <span className="impact-label">Money Saved</span>
                </div>
              </div>
              <div className="impact-metric">
                <FaRoute className="impact-icon" />
                <div className="impact-data">
                  <span className="impact-value">{userImpact.tripsCompleted}</span>
                  <span className="impact-label">Eco Trips</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="map-container">
          {/* Real map implementation using Leaflet */}
          <MapContainer 
            center={[mapCenter.lat, mapCenter.lng]} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Map Controller to update map center */}
            <MapController center={[mapCenter.lat, mapCenter.lng]} zoom={mapZoom} />
            
            {/* Route visualization */}
            {routeCoordinates.length > 0 && (
              <Polyline 
                positions={routeCoordinates}
                color={selectedRoute?.type === 'bike-share' ? '#e67e22' : 
                      selectedRoute?.type === 'shared-ride' ? '#e74c3c' : '#3498db'}
                weight={5}
                opacity={0.7}
              />
            )}
            
            {/* Start marker */}
            {selectedRoute && (
              <Marker 
                position={[selectedRoute.startCoords.lat, selectedRoute.startCoords.lng]}
                icon={startIcon}
              >
                <Popup>
                  <b>Start:</b> {startLocation}
                </Popup>
              </Marker>
            )}
            
            {/* End marker */}
            {selectedRoute && (
              <Marker 
                position={[selectedRoute.endCoords.lat, selectedRoute.endCoords.lng]}
                icon={endIcon}
              >
                <Popup>
                  <b>Destination:</b> {endLocation}
                </Popup>
              </Marker>
            )}
            
            {/* Transit points */}
            {routePoints.map((point, idx) => (
              <Marker 
                key={idx} 
                position={point.position}
                icon={transitIcon}
              >
                <Popup>
                  <b>{point.type.charAt(0).toUpperCase() + point.type.slice(1)}</b>
                  {point.details.line && <div>Line: {point.details.line}</div>}
                  <div>{point.details.duration} min · {point.details.distance} miles</div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          {selectedRoute && (
            <div className="selected-route-details">
              <h3>Route Details</h3>
              <div className="route-overview">
                <div className="route-title">
                  {getTransportIcon(selectedRoute.type)}
                  <span>{selectedRoute.description}</span>
                </div>
                <div className="route-main-stats">
                  <div>
                    <strong>Duration:</strong> {selectedRoute.duration} minutes
                  </div>
                  <div>
                    <strong>Cost:</strong> ${selectedRoute.cost.toFixed(2)}
                  </div>
                  <div>
                    <strong>Carbon:</strong> {selectedRoute.carbonFootprint} kg CO2
                  </div>
                </div>
                {selectedRoute.segments && (
                  <div className="route-segments">
                    <h4>Journey Segments:</h4>
                    <ul>
                      {selectedRoute.segments.map((segment, idx) => (
                        <li key={idx} className="segment">
                          <div className="segment-icon">
                            {getTransportIcon(segment.mode)}
                          </div>
                          <div className="segment-details">
                            <strong>{segment.mode.charAt(0).toUpperCase() + segment.mode.slice(1)}</strong>
                            {segment.line && <span> (Line {segment.line})</span>}
                            <div>
                              {segment.duration} min · {segment.distance} miles
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button className="book-btn">Book This Route</button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <div className={`eco-chatbot ${chatOpen ? 'open' : ''}`}>
        <div className="chat-header" onClick={() => setChatOpen(!chatOpen)}>
          <h3>Eco Travel Assistant</h3>
          <span className="toggle-chat">{chatOpen ? '−' : '+'}</span>
        </div>
        {chatOpen && (
          <div className="chat-body">
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="chat-form">
              <input
                type="text"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                placeholder="Ask about eco-travel options..."
              />
              <button type="submit">Send</button>
            </form>
          </div>
        )}
      </div>
      
      <section id="features" className="features">
        <h2>Key Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon"><FaExchangeAlt /></div>
            <h3>Transport Aggregation</h3>
            <p>Compare real-time prices and schedules across platforms to find the most efficient option for your journey.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaRoute /></div>
            <h3>Journey Planning</h3>
            <p>Plan flexible multi-stop trips or simple point-to-point travel with our intuitive interface.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaStar /></div>
            <h3>Verified Reviews</h3>
            <p>Build trust through authentic reviews verified by booking confirmations and user authentication.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaLeaf /></div>
            <h3>Eco-Friendly Travel</h3>
            <p>Track your personal carbon footprint reduction and make environmentally conscious travel choices.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaShieldAlt /></div>
            <h3>Enhanced Safety</h3>
            <p>Prioritizing secure transport alternatives with verified drivers and emergency assistance features.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaCalendarAlt /></div>
            <h3>Regular Travel Plans</h3>
            <p>Set up recurring journeys for your daily commute and receive notifications about better alternatives.</p>
          </div>
        </div>
      </section>
      
      <section id="impact" className="impact">
        <h2>Our Impact</h2>
        <div className="impact-stats">
          <div className="stat-card">
            <h3>24,560</h3>
            <p>kg of CO2 Emissions Saved</p>
          </div>
          <div className="stat-card">
            <h3>$85,430</h3>
            <p>Total User Savings</p>
          </div>
          <div className="stat-card">
            <h3>142,800</h3>
            <p>Eco-Friendly Trips Completed</p>
          </div>
        </div>
      </section>
      
      <section id="about" className="about">
        <h2>About Last Mile</h2>
        <div className="about-content">
          <div className="about-text">
            <p>Last Mile was born from a simple observation: urban commuters needed better, safer, and more eco-friendly options for their daily travel. Traditional carpooling platforms face significant challenges in safety and reliability.</p>
            <p>Our mission is to transform urban commuting by aggregating transport options to provide secure, budget-conscious, and environmentally friendly travel solutions.</p>
            <p>As an open-source project, we're committed to transparency and community collaboration. Join us in making urban transportation better for everyone.</p>
          </div>
          <div className="about-image">
            <img src="/api/placeholder/400/300" alt="Last Mile Team" />
          </div>
        </div>
      </section>
      
      <footer>
        <div className="footer-content">
          <div className="footer-section">
            <h3>Last Mile</h3>
            <p>Smart. Green. Safe.</p>
          </div>
          <div className="footer-section">
            <h3>Links</h3>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#impact">Impact</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Contact</h3>
            <p>info@lastmileapp.com</p>
            <p>123 Green Street, Tech City</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Last Mile. All rights reserved. Open-source under MIT License.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;