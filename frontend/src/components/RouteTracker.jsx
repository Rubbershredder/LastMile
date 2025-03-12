import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

// Component to handle route tracking and shortest path calculation
const RouteTracker = ({ waypoints, onRoutesFound, highlightShortest = true }) => {
  const map = useMap();
  const routingControlRef = useRef(null);
  const routeLineRef = useRef(null);
  
  useEffect(() => {
    // Clear any existing routes
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }
    
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }
    
    // Exit if not enough waypoints
    if (!waypoints || waypoints.length < 2) return;
    
    // Create new routing control - will calculate multiple possible routes
    const routingControl = L.Routing.control({
      waypoints: waypoints.map(point => L.latLng(point)),
      routeWhileDragging: true,
      showAlternatives: true,
      fitSelectedRoutes: false, // We'll handle fitting ourselves for better UX
      lineOptions: {
        styles: [
          { color: '#777', opacity: 0.15, weight: 9 },
          { color: '#0073FF', opacity: 0.8, weight: 6 }
        ],
        missingRouteStyles: [
          { color: '#F00', opacity: 0.8, weight: 6, dashArray: '10,10' }
        ]
      },
      createMarker: () => null // We'll handle markers separately for more control
    }).addTo(map);
    
    routingControlRef.current = routingControl;
    
    // When routes are calculated, find the shortest one
    routingControl.on('routesfound', (e) => {
      const routes = e.routes;
      
      if (routes.length === 0) return;

      // Find the shortest route by distance
      const shortestRoute = routes.reduce((minRoute, currentRoute) => 
        currentRoute.summary.totalDistance < minRoute.summary.totalDistance 
          ? currentRoute 
          : minRoute,
        routes[0]
      );

      // If requested to highlight the shortest route, display it prominently
      if (highlightShortest && shortestRoute.coordinates) {
        // Remove previous highlight if it exists
        if (routeLineRef.current) {
          map.removeLayer(routeLineRef.current);
        }
        
        // Create a polyline for the shortest route with a distinctive style
        const shortestPolyline = L.polyline(shortestRoute.coordinates, {
          color: '#22c55e', // Green color for the shortest route
          weight: 6, 
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        
        routeLineRef.current = shortestPolyline;
        
        // Add animated dash effect to make it more noticeable
        const animateDash = () => {
          const dashArray = [10, 20];
          const dashOffset = (Date.now() / 100) % 30;
          shortestPolyline.getElement().style.strokeDasharray = dashArray.join(', ');
          shortestPolyline.getElement().style.strokeDashoffset = dashOffset;
          requestAnimationFrame(animateDash);
        };
        
        // Start animation once the polyline is added to the map
        shortestPolyline.on('add', () => {
          requestAnimationFrame(animateDash);
        });
      }

      // Fit the map to the route with some padding
      map.fitBounds(L.latLngBounds(shortestRoute.coordinates), {
        padding: [50, 50],
        maxZoom: 15
      });

      // Pass route information back to parent component
      if (onRoutesFound) {
        onRoutesFound({
          distance: shortestRoute.summary.totalDistance,
          duration: shortestRoute.summary.totalTime,
          coordinates: shortestRoute.coordinates.map(coord => [coord.lat, coord.lng]),
          shortestRoute: shortestRoute
        });
      }
    });
    
    // Error handling
    routingControl.on('routingerror', (e) => {
      console.error('Routing error:', e.error);
      // Could dispatch an error to parent component here
    });
    
    return () => {
      // Clean up on unmount
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }
      
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
      }
    };
  }, [map, waypoints, onRoutesFound, highlightShortest]);
  
  return null;
};

export default RouteTracker;