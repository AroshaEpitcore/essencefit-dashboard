"use client";

import { useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import { MapPin, Search, Trash2, Navigation, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 6.9271,
  lng: 80.0,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
  fullscreenControl: true,
  mapTypeControl: true,
  styles: [
    {
      featureType: "all",
      elementType: "labels.text.fill",
      stylers: [{ color: "#555555" }],
    },
  ],
};

type MapMarker = {
  id: string;
  position: { lat: number; lng: number };
  label: string;
};

export default function MapPage() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(8);
  const [labelInput, setLabelInput] = useState("");
  const [pendingPosition, setPendingPosition] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onSearchBoxLoad = useCallback((ref: google.maps.places.SearchBox) => {
    searchBoxRef.current = ref;
  }, []);

  const onPlacesChanged = useCallback(() => {
    if (!searchBoxRef.current) return;
    const places = searchBoxRef.current.getPlaces();
    if (!places || places.length === 0) return;

    const place = places[0];
    if (!place.geometry?.location) return;

    const newCenter = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    setMapCenter(newCenter);
    setMapZoom(14);
    mapRef.current?.panTo(newCenter);
  }, []);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    setPendingPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    setLabelInput("");
    setSelectedMarker(null);
  }, []);

  const confirmAddMarker = useCallback(() => {
    if (!pendingPosition) return;
    const newMarker: MapMarker = {
      id: Date.now().toString(),
      position: pendingPosition,
      label: labelInput.trim() || `Pin ${markers.length + 1}`,
    };
    setMarkers((prev) => [...prev, newMarker]);
    setPendingPosition(null);
    setLabelInput("");
    toast.success("Pin added!");
  }, [pendingPosition, labelInput, markers.length]);

  const deleteMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    if (selectedMarker?.id === id) setSelectedMarker(null);
    toast.success("Pin removed");
  }, [selectedMarker]);

  const goToCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(loc);
        setMapZoom(15);
        mapRef.current?.panTo(loc);
        toast.success("Moved to your location");
      },
      () => toast.error("Could not get location")
    );
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 max-w-lg text-center shadow">
          <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Google Maps API Key Required</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Add your Google Maps API key to the environment to enable this feature.
          </p>
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-left text-sm font-mono text-gray-700 dark:text-gray-300">
            <p className="mb-1 text-gray-500"># .env.local</p>
            <p>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Failed to load Google Maps. Check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Map</h1>
            <p className="text-xs text-gray-500">Click on the map to drop pins</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{markers.length} pin{markers.length !== 1 ? "s" : ""}</span>
          <button
            onClick={goToCurrentLocation}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            <Navigation className="w-4 h-4" />
            My Location
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Panel */}
        <div className="w-64 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Search Location</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <StandaloneSearchBox onLoad={onSearchBoxLoad} onPlacesChanged={onPlacesChanged}>
                <input
                  type="text"
                  placeholder="Search places..."
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </StandaloneSearchBox>
            </div>
          </div>

          {/* Pending pin label */}
          {pendingPosition && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-2">New Pin</p>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAddMarker()}
                placeholder="Label (optional)"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={confirmAddMarker}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-sm transition"
                >
                  Add Pin
                </button>
                <button
                  onClick={() => setPendingPosition(null)}
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Pins List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saved Pins</p>
              {markers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  Click on the map to drop a pin
                </p>
              ) : (
                <ul className="space-y-1">
                  {markers.map((marker) => (
                    <li
                      key={marker.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition ${
                        selectedMarker?.id === marker.id
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => {
                        setSelectedMarker(marker);
                        mapRef.current?.panTo(marker.position);
                        setMapZoom(15);
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-red-500" />
                        <span className="truncate">{marker.label}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMarker(marker.id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={mapZoom}
            options={mapOptions}
            onLoad={onMapLoad}
            onClick={onMapClick}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.position}
                onClick={() => setSelectedMarker(marker)}
              />
            ))}

            {selectedMarker && (
              <InfoWindow
                position={selectedMarker.position}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div className="text-gray-900 min-w-[120px]">
                  <p className="font-semibold text-sm">{selectedMarker.label}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedMarker.position.lat.toFixed(5)}, {selectedMarker.position.lng.toFixed(5)}
                  </p>
                  <button
                    onClick={() => deleteMarker(selectedMarker.id)}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remove pin
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}
