import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

// Fix for Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import userLocationIcon from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let UserLocationIcon = L.icon({
  iconUrl: userLocationIcon,
  shadowUrl: iconShadow,
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [0, -45]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Sample data for demonstration
const uberPriceData = {
  'UberX': {
    basePrice: 2.55,
    perMile: 1.75,
    perMinute: 0.35,
    minFare: 8.00
  },
  'UberXL': {
    basePrice: 3.85,
    perMile: 2.85,
    perMinute: 0.50,
    minFare: 10.50
  },
  'UberBlack': {
    basePrice: 7.00,
    perMile: 3.75,
    perMinute: 0.65,
    minFare: 15.00
  },
  'UberPool': {
    basePrice: 2.00,
    perMile: 1.35,
    perMinute: 0.30,
    minFare: 6.50
  }
};

// Public transport data
const publicTransportData = {
  'Bus': {
    basePrice: 2.75,
    perMile: 0,
    maxPrice: 2.75
  },
  'Subway': {
    basePrice: 2.75,
    perMile: 0,
    maxPrice: 2.75
  },
  'Train': {
    basePrice: 3.00,
    perMile: 0.10,
    maxPrice: 10.00
  }
};

// CO2 emissions in g/km
const emissionRates = {
  'UberX': 170,
  'UberXL': 210,
  'UberBlack': 230,
  'UberPool': 100,
  'Bus': 80,
  'Subway': 40,
  'Train': 60,
  'Walking': 0,
  'Cycling': 0
};

// Helper functions
const calculateUberPrices = (distance, duration) => {
  const distanceMiles = distance / 1609.34; // Convert meters to miles
  const durationMinutes = duration / 60; // Convert seconds to minutes
  
  const prices = {};
  
  Object.entries(uberPriceData).forEach(([type, rates]) => {
    let price = rates.basePrice + (distanceMiles * rates.perMile) + (durationMinutes * rates.perMinute);
    price = Math.max(price, rates.minFare);
    prices[type] = price.toFixed(2);
  });
  
  return prices;
};

const calculatePublicTransportPrices = (distance) => {
  const distanceMiles = distance / 1609.34;
  
  const prices = {};
  
  Object.entries(publicTransportData).forEach(([type, rates]) => {
    let price = rates.basePrice + (distanceMiles * rates.perMile);
    price = Math.min(price, rates.maxPrice);
    prices[type] = price.toFixed(2);
  });
  
  return prices;
};

const estimateCO2 = (type, distance) => {
  const distanceKm = distance / 1000;
  return ((emissionRates[type] || 170) * distanceKm).toFixed(0);
};

// Improved geocoding function
const geocodeAddress = async (address) => {
  try {
    // Try LocationIQ first
    const apiKey = 'pk.412dacf6f9361497e8049c3ff6d8e3e0';
    const locationIQResponse = await fetch(
      `https://us1.locationiq.com/v1/search.php?key=${apiKey}&q=${encodeURIComponent(address)}&format=json`
    );

    if (!locationIQResponse.ok) {
      throw new Error(`LocationIQ error! Status: ${locationIQResponse.status}`);
    }

    const locationIQData = await locationIQResponse.json();

    if (locationIQData && locationIQData.length > 0) {
      return [parseFloat(locationIQData[0].lat), parseFloat(locationIQData[0].lon)];
    }

    // Fallback to Nominatim if LocationIQ fails
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      {
        headers: {
          'User-Agent': 'YourAppName/1.0 (your@email.com)' // Required for Nominatim
        }
      }
    );

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim error! Status: ${nominatimResponse.status}`);
    }

    const nominatimData = await nominatimResponse.json();

    if (nominatimData && nominatimData.length > 0) {
      return [parseFloat(nominatimData[0].lat), parseFloat(nominatimData[0].lon)];
    }

    throw new Error("Location not found");
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error("Failed to fetch location. Please try again.");
  }
};

// Map update component
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  
  return null;
};

// Component to handle routing logic with improved display
const RoutingMachine = ({ waypoints, onRoutesFound }) => {
  const map = useMap();
  const routingControlRef = useRef(null);
  const routeLineRef = useRef(null);
  
  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return;
    
    // Remove previous routing control if it exists
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }
    
    // Remove previous custom route line if exists
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    
    // Use OSRM (Open Source Routing Machine) for routing
    const fetchRoute = async () => {
      try {
        const startPoint = waypoints[0];
        const endPoint = waypoints[1];
        
        const url = `https://router.project-osrm.org/route/v1/driving/${startPoint[1]},${startPoint[0]};${endPoint[1]},${endPoint[0]}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          
          // Create a polyline from the route coordinates
          const routeLine = L.polyline(coordinates, {
            color: '#0073FF',
            weight: 6,
            opacity: 0.8
          }).addTo(map);
          
          routeLineRef.current = routeLine;
          
          // Zoom to fit the route with proper padding
          const bounds = routeLine.getBounds();
          map.fitBounds(bounds, {
            padding: [50, 50], // Add padding for better visibility
            maxZoom: 15        // Limit maximum zoom level
          });
          
          // Call the callback with route data
          if (onRoutesFound) {
            onRoutesFound({
              distance: route.distance,
              duration: route.duration,
              coordinates: coordinates
            });
          }
        } else {
          // Fallback to direct calculation if no path returned
          createFallbackRoute();
        }
      } catch (error) {
        console.error("Route calculation error:", error);
        // Fallback to direct calculation on error
        createFallbackRoute();
      }
    };
    
    // Function to create a fallback route using OpenStreetMap Nominatim for geocoding
    const createFallbackRoute = async () => {
      try {
        const startPoint = waypoints[0];
        const endPoint = waypoints[1];
        
        // Create a more realistic path by adding intermediate points
        const wayPoints = [
          [startPoint[0], startPoint[1]],
          [startPoint[0] + (endPoint[0] - startPoint[0]) * 0.33, 
           startPoint[1] + (endPoint[1] - startPoint[1]) * 0.33],
          [startPoint[0] + (endPoint[0] - startPoint[0]) * 0.66, 
           startPoint[1] + (endPoint[1] - startPoint[1]) * 0.66],
          [endPoint[0], endPoint[1]]
        ];
        
        // Create a polyline with the calculated waypoints
        const routeLine = L.polyline(wayPoints, {
          color: '#0073FF',
          weight: 6,
          opacity: 0.8
        }).addTo(map);
        
        routeLineRef.current = routeLine;
        
        // Calculate distance in meters
        let totalDistance = 0;
        for (let i = 0; i < wayPoints.length - 1; i++) {
          const point1 = L.latLng(wayPoints[i]);
          const point2 = L.latLng(wayPoints[i + 1]);
          totalDistance += point1.distanceTo(point2);
        }
        
        // Estimate duration (assuming 40 km/h average speed in urban areas)
        const duration = (totalDistance / (40 * 1000 / 3600)); // seconds
        
        // Zoom to fit the route with proper padding
        const bounds = routeLine.getBounds();
        map.fitBounds(bounds, {
          padding: [150, 150], // Add more padding for better visibility
          maxZoom: 13          // Limit maximum zoom to see context
        });
        
        // Call the callback with estimated data
        if (onRoutesFound) {
          onRoutesFound({
            distance: totalDistance,
            duration: duration,
            coordinates: wayPoints
          });
        }
      } catch (error) {
        console.error("Fallback route calculation error:", error);
        createSimpleDirectRoute();
      }
    };
    
    // Simplest fallback - direct line
    const createSimpleDirectRoute = () => {
      const start = L.latLng(waypoints[0]);
      const end = L.latLng(waypoints[1]);
      
      // Create a straight line
      const routeLine = L.polyline([start, end], {
        color: '#0073FF',
        weight: 6,
        opacity: 0.8
      }).addTo(map);
      
      routeLineRef.current = routeLine;
      
      // Calculate straight-line distance in meters
      const distance = start.distanceTo(end);
      
      // Estimate duration (assuming 40 km/h average speed)
      const duration = (distance / (40 * 1000 / 3600)); // seconds
      
      // Zoom out to show both points with padding
      const bounds = routeLine.getBounds();
      map.fitBounds(bounds, {
        padding: [150, 150], // Add generous padding
        maxZoom: 1          // Limit maximum zoom to see more context
      });
      
      // Call the callback with estimated data
      if (onRoutesFound) {
        onRoutesFound({
          distance: distance,
          duration: duration,
          coordinates: [
            [start.lat, start.lng],
            [end.lat, end.lng]
          ]
        });
      }
    };
    
    // Start the routing process
    fetchRoute();
    
    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
      }
    };
  }, [map, waypoints, onRoutesFound]);
  
  return null;
};

// Trip option card component
const TripOption = ({ type, price, time, co2, isEcoFriendly }) => {
  return (
    <div className={`mb-3 p-3 border-l-4 ${isEcoFriendly ? 'border-green-500' : 'border-gray-800'} bg-white rounded shadow`}>
      <div className="font-bold">{type}</div>
      <div className={`text-xl font-bold ${isEcoFriendly ? 'text-green-600' : 'text-gray-800'}`}>${price}</div>
      <div>Approx. {time} min</div>
      <div className={isEcoFriendly ? 'text-green-600' : 'text-gray-600'}>CO2: ~{co2} g</div>
    </div>
  );
};

// Location tracking component
const LocationTracker = ({ onLocationUpdate }) => {
  const map = useMap();
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    
    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = [latitude, longitude];
        onLocationUpdate(location);
        map.setView(location, 15);
      },
      (err) => {
        setError(`Error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
    
    // Clean up
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [map, onLocationUpdate]);
  
  return error ? <div className="text-red-500">{error}</div> : null;
};

// Main App Component
const App = () => {
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to NYC
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [selectedTransportType, setSelectedTransportType] = useState("all");
  
  // Request location permission on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
          setLocationPermissionGranted(true);
        },
        (err) => {
          setError(`Location permission denied: ${err.message}`);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser");
    }
  }, []);
  
  // Update user location
  const handleLocationUpdate = (location) => {
    setCurrentLocation(location);
  };
  
  // Add destination to the list
  const addDestination = async () => {
    if (!toAddress) {
      setError("Please enter a destination");
      return;
    }
    
    setError("");
    setLoading(true);
    
    try {
      const coords = await geocodeAddress(toAddress);
      const newDestination = {
        address: toAddress,
        coords: coords
      };
      
      setDestinations(prev => [...prev, newDestination]);
      setToAddress("");
    } catch (err) {
      setError("Failed to geocode address. Please try a different location.");
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate route to selected destination
  const calculateRoute = (destination) => {
    if (!currentLocation) {
      setError("Your current location is not available yet");
      return;
    }
    
    setWaypoints([currentLocation, destination.coords]);
  };
  
  // Remove destination from the list
  const removeDestination = (index) => {
    setDestinations(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleRoutesFound = ({ distance, duration, coordinates }) => {
    setRouteInfo({ distance, duration });
    setRouteCoordinates(coordinates);
  };
  
  // Calculate prices and times once we have route information
  const uberPrices = routeInfo ? calculateUberPrices(routeInfo.distance, routeInfo.duration) : {};
  const publicPrices = routeInfo ? calculatePublicTransportPrices(routeInfo.distance) : {};
  
  // Calculate walking and cycling times
  const walkingSpeed = 5; // km/h
  const cyclingSpeed = 15; // km/h
  
  const walkingTime = routeInfo ? Math.round((routeInfo.distance / 1000) / walkingSpeed * 60) : 0; // minutes
  const cyclingTime = routeInfo ? Math.round((routeInfo.distance / 1000) / cyclingSpeed * 60) : 0; // minutes
  
  // Calculate budget tip
  const budgetSavingPercentage = routeInfo && uberPrices.UberX && publicPrices.Bus
    ? Math.round((1 - (parseFloat(publicPrices.Bus) / parseFloat(uberPrices.UberX))) * 100)
    : 0;
    
  // Find most eco-friendly option
  const findMostEcoFriendly = () => {
    if (!routeInfo) return null;
    
    const options = [
      { type: 'Walking', emissions: 0 },
      { type: 'Cycling', emissions: 0 },
      { type: 'Subway', emissions: estimateCO2('Subway', routeInfo.distance) },
      { type: 'Bus', emissions: estimateCO2('Bus', routeInfo.distance) },
      { type: 'Train', emissions: estimateCO2('Train', routeInfo.distance) },
      { type: 'UberPool', emissions: estimateCO2('UberPool', routeInfo.distance) },
      { type: 'UberX', emissions: estimateCO2('UberX', routeInfo.distance) },
      { type: 'UberXL', emissions: estimateCO2('UberXL', routeInfo.distance) },
      { type: 'UberBlack', emissions: estimateCO2('UberBlack', routeInfo.distance) }
    ];
    
    // Sort by emissions (ascending)
    return options.sort((a, b) => a.emissions - b.emissions)[0].type;
  };
  
  const mostEcoFriendly = findMostEcoFriendly();
  
  // Copy coordinates to clipboard
  const copyCoordinates = () => {
    navigator.clipboard.writeText(JSON.stringify(routeCoordinates));
  };
  
  // Toggle showing full coordinates
  const toggleCoordinates = () => {
    setShowCoordinates(!showCoordinates);
  };
  
  // Filter transport options
  const filterTransportOptions = (type) => {
    setSelectedTransportType(type);
  };
  
  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Map Section */}
      <div className="flex-grow h-1/2 md:h-full">
        <MapContainer
          center={mapCenter}
          zoom={14}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapUpdater center={mapCenter} zoom={14} />
          
          {locationPermissionGranted && (
            <LocationTracker onLocationUpdate={handleLocationUpdate} />
          )}
          
          {/* Current location marker */}
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={UserLocationIcon}
            >
              <Popup>
                Your current location
              </Popup>
            </Marker>
          )}
          
          {/* Destination markers */}
          {destinations.map((dest, index) => (
            <Marker
              key={`dest-${index}`}
              position={dest.coords}
            >
              <Popup>
                <div>
                  <p>{dest.address}</p>
                  <button 
                    onClick={() => calculateRoute(dest)}
                    className="bg-blue-500 text-white px-2 py-1 rounded text-sm mt-2"
                  >
                    Navigate Here
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Route display */}
          {waypoints.length === 2 && (
            <RoutingMachine 
              waypoints={waypoints} 
              onRoutesFound={handleRoutesFound} 
            />
          )}
        </MapContainer>
      </div>
      
      {/* Sidebar */}
      <div className="w-full md:w-96 bg-gray-50 p-5 overflow-y-auto h-1/2 md:h-full">
        <h2 className="text-2xl font-bold mb-4">Travel Cost Comparison</h2>
        
        {/* Location status */}
        <div className="mb-4">
          {currentLocation ? (
            <div className="bg-green-100 p-2 rounded">
              <p className="text-green-700">✓ Live location active</p>
            </div>
          ) : (
            <div className="bg-yellow-100 p-2 rounded">
              <p className="text-yellow-700">Waiting for location permission...</p>
            </div>
          )}
        </div>
        
        {/* Destination Input */}
        <div className="mb-4">
          <label htmlFor="to" className="block font-semibold mb-1">Add Destination:</label>
          <div className="flex">
            <input
              type="text"
              id="to"
              className="flex-grow p-2 border rounded-l"
              placeholder="Enter destination"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-r"
              onClick={addDestination}
              disabled={loading}
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
          
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
        
        {/* Destinations List */}
        {destinations.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-bold mb-2">Your Destinations</h3>
            <div className="bg-white rounded-lg shadow-sm p-2">
              {destinations.map((dest, index) => (
                <div key={`dest-list-${index}`} className="flex justify-between items-center p-2 hover:bg-gray-50 border-b last:border-b-0">
                  <div className="flex-grow">
                    <p className="font-medium">{dest.address}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => calculateRoute(dest)}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Navigate
                    </button>
                    <button
                      onClick={() => removeDestination(index)}
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Route Results */}
        {routeInfo && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-xl font-bold mb-2">Route Details</h3>
            <p>Distance: {(routeInfo.distance / 1000).toFixed(2)} km</p>
            <p>Estimated driving time: {Math.round(routeInfo.duration / 60)} minutes</p>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Route Coordinates:</h4>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p>Start: {currentLocation[0].toFixed(5)}, {currentLocation[1].toFixed(5)}</p>
                <p>End: {destinations[0]?.coords[0].toFixed(5)}, {destinations[0]?.coords[1].toFixed(5)}</p>
                <p className="mt-2">Path coordinates ({routeCoordinates.length} points):</p>
                <div className="flex space-x-2 mt-1">
                  <button 
                    onClick={copyCoordinates}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Copy coordinates to clipboard
                  </button>
                  <button 
                    onClick={toggleCoordinates}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {showCoordinates ? "Hide details" : "Show details"}
                  </button>
                </div>
                
                {showCoordinates && (
                  <div className="max-h-40 overflow-auto mt-2">
                    <pre className="text-xs">
                      {JSON.stringify(routeCoordinates.slice(0, 10), null, 2)}
                      {routeCoordinates.length > 10 && "..."}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            
            {/* Transport filter */}
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Transport Options:</h4>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => filterTransportOptions('all')}
                  className={`px-2 py-1 text-sm rounded ${selectedTransportType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => filterTransportOptions('ride')}
                  className={`px-2 py-1 text-sm rounded ${selectedTransportType === 'ride' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Ride-hailing
                </button>
                <button 
                  onClick={() => filterTransportOptions('public')}
                  className={`px-2 py-1 text-sm rounded ${selectedTransportType === 'public' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Public Transit
                </button>
                <button 
                  onClick={() => filterTransportOptions('eco')}
                  className={`px-2 py-1 text-sm rounded ${selectedTransportType === 'eco' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Eco-friendly
                </button>
              </div>
            </div>
            
            {/* Pricing comparison */}
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Cost Comparison:</h4>
              
              {/* Ridesharing options */}
              {(selectedTransportType === 'all' || selectedTransportType === 'ride') && (
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-gray-600">Ride-hailing Options</h5>
                  {Object.entries(uberPrices).map(([type, price]) => (
                    <TripOption 
                      key={type}
                      type={type}
                      price={price}
                      time={Math.round(routeInfo.duration / 60)}
                      co2={estimateCO2(type, routeInfo.distance)}
                      isEcoFriendly={type === 'UberPool' && mostEcoFriendly === 'UberPool'}
                    />
                  ))}
                </div>
              )}
              
              {/* Public transit options */}
              {(selectedTransportType === 'all' || selectedTransportType === 'public' || selectedTransportType === 'eco') && (
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-gray-600">Public Transit Options</h5>
                  {Object.entries(publicPrices).map(([type, price]) => {
                    // Adjust time for different public transit options
                    let transitTime = Math.round(routeInfo.duration / 60);
                    if (type === 'Bus') transitTime = Math.round(transitTime * 1.3); // Buses are slower
                    if (type === 'Subway') transitTime = Math.round(transitTime * 0.8); // Subways might be faster
                    
                    return (
                      <TripOption 
                        key={type}
                        type={type}
                        price={price}
                        time={transitTime}
                        co2={estimateCO2(type, routeInfo.distance)}
                        isEcoFriendly={['Subway', 'Bus', 'Train'].includes(type) && mostEcoFriendly === type}
                      />
                    );
                  })}
                </div>
              )}
              
              {/* Eco-friendly options */}
              {(selectedTransportType === 'all' || selectedTransportType === 'eco') && (
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-gray-600">Eco-friendly Options</h5>
                  <TripOption 
                    type="Walking"
                    price="0.00"
                    time={walkingTime}
                    co2="0"
                    isEcoFriendly={true}
                  />
                  <TripOption 
                    type="Cycling"
                    price="0.00"
                    time={cyclingTime}
                    co2="0"
                    isEcoFriendly={true}
                  />
                </div>
              )}
              
              {/* Budget tip */}
              {budgetSavingPercentage > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-blue-800 font-medium">
                    💰 Budget Tip: Taking public transit instead of UberX can save you approximately {budgetSavingPercentage}% on this trip!
                  </p>
                </div>
              )}
              
              {/* Eco tip */}
              {mostEcoFriendly && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-green-800 font-medium">
                    🌱 Eco Tip: {mostEcoFriendly} is the most eco-friendly option for this trip.
                  </p>
                  {mostEcoFriendly !== 'Walking' && mostEcoFriendly !== 'Cycling' && (
                    <p className="text-green-700 text-sm mt-1">
                      You can save approximately {estimateCO2('UberX', routeInfo.distance) - estimateCO2(mostEcoFriendly, routeInfo.distance)}g of CO2 compared to taking UberX.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Footer with app info */}
        <div className="mt-auto pt-4 text-center text-gray-500 text-sm">
          <p>Travel Cost Comparison App</p>
          <p>© {new Date().getFullYear()} - Eco-friendly travel planning</p>
        </div>
      </div>
    </div>
  );
};

export default App;