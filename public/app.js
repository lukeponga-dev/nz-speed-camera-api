// ==========================================================================
// NZ Speed Camera Radar - Client Application Logic
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // --------------------------------------------------
  // Global State
  // --------------------------------------------------
  let allCameras = [];
  let filteredCameras = [];
  let uniqueRegions = [];
  
  let map = null;
  let markersGroup = null;
  let selectedMarker = null;
  
  // Nearby search state
  let nearbyCenter = null;
  let nearbyCenterMarker = null;
  let nearbyCircle = null;
  let isNearbyModeActive = false;

  // Chart instances
  let typeChart = null;
  let regionChart = null;

  // ---- Mobile Bottom Sheet + Tab Bar System ----
  const sidebar = document.getElementById('sidebar');
  const mobileTabBar = document.getElementById('mobile-tab-bar');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobTabs = document.querySelectorAll('.mob-tab');

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function openSheet(tabId) {
    sidebar.classList.add('sheet-open');
    mobileBackdrop.classList.add('visible');

    // Activate the correct tab content (reuse desktop tab system)
    tabContents.forEach(c => c.classList.remove('active'));
    const targetPanel = document.getElementById(`tab-${tabId}`);
    if (targetPanel) targetPanel.classList.add('active');

    // Sync desktop tabs state too
    tabs.forEach(t => t.classList.remove('active'));
    tabs.forEach(t => { if (t.dataset.tab === tabId) t.classList.add('active'); });

    // Handle nearby mode
    if (tabId === 'nearby') {
      isNearbyModeActive = true;
      if (map) map.getContainer().style.cursor = 'crosshair';
      if (nearbyCenter) showNearbyCircleAndMarker();
    } else {
      isNearbyModeActive = false;
      if (map) map.getContainer().style.cursor = '';
      hideNearbyCircleAndMarker();
    }

    // Invalidate map size after transition
    setTimeout(() => { if (map) map.invalidateSize(); }, 400);
  }

  function closeSheet() {
    sidebar.classList.remove('sheet-open');
    mobileBackdrop.classList.remove('visible');
    setTimeout(() => { if (map) map.invalidateSize(); }, 400);
  }

  // Bottom tab bar click handling
  mobTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab highlight
      mobTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabId = tab.dataset.mobTab;
      if (tabId === 'map') {
        // "Map" tab → close sheet, show map only
        closeSheet();
        isNearbyModeActive = false;
        if (map) map.getContainer().style.cursor = '';
      } else {
        openSheet(tabId);
      }
    });
  });

  // Backdrop tap to close
  if (mobileBackdrop) {
    mobileBackdrop.addEventListener('click', () => {
      closeSheet();
      // Reset to map tab
      mobTabs.forEach(t => t.classList.remove('active'));
      const mapTab = document.getElementById('mob-tab-map');
      if (mapTab) mapTab.classList.add('active');
    });
  }

  // Elements
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  
  // Stats
  const statTotal = document.getElementById("stat-total-val");
  const statSpeed = document.getElementById("stat-speed-val");
  const statRedlight = document.getElementById("stat-redlight-val");
  const statAvgSpeed = document.getElementById("stat-avg-speed-val");
  
  const statSpeedPercent = document.getElementById("stat-speed-percentage");
  const statRedlightPercent = document.getElementById("stat-redlight-percentage");
  const statAvgPercent = document.getElementById("stat-avg-percentage");

  // Filters
  const searchInput = document.getElementById("camera-search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const regionSelect = document.getElementById("filter-region-select");
  const typeSelect = document.getElementById("filter-type-select");
  const resultsCountLabel = document.getElementById("results-count");
  const cameraListContainer = document.getElementById("camera-list-container");

  // Geolocation & Nearby
  const useLocationBtn = document.getElementById("use-location-btn");
  const radiusSlider = document.getElementById("nearby-radius-slider");
  const radiusLabel = document.getElementById("radius-value-label");
  const selectedPointCard = document.getElementById("selected-point-card");
  const selectedCoordsVal = document.getElementById("selected-coords-val");
  const clearNearbyBtn = document.getElementById("clear-nearby-btn");
  const nearbyResultsSection = document.getElementById("nearby-results-section");
  const nearbyCountLabel = document.getElementById("nearby-count");
  const nearbyListContainer = document.getElementById("nearby-list-container");

  // Detail panel overlay
  const detailOverlay = document.getElementById("detail-overlay");
  const closeDetailBtn = document.getElementById("close-detail-btn");
  const detailContentArea = document.getElementById("detail-content-area");

  // --------------------------------------------------
  // Tab Navigation
  // --------------------------------------------------
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      
      tab.classList.add("active");
      const targetId = `tab-${tab.dataset.tab}`;
      document.getElementById(targetId).classList.add("active");
      
      // Handle mode shifts
      if (tab.dataset.tab === "nearby") {
        isNearbyModeActive = true;
        // Prompt user on map
        map.getContainer().style.cursor = "crosshair";
        if (nearbyCenter) {
          showNearbyCircleAndMarker();
        }
      } else {
        isNearbyModeActive = false;
        map.getContainer().style.cursor = "";
        hideNearbyCircleAndMarker();
      }
    });
  });

  // --------------------------------------------------
  // Map Initialization
  // --------------------------------------------------
  function initMap() {
    // Center of New Zealand
    const nzCenter = [-40.9006, 174.8860];
    map = L.map("map", {
      zoomControl: false // Styled / positioned zoom control later
    }).setView(nzCenter, 6);

    // CartoDB Dark Matter tiles for premium dark style
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    // Custom zoom control in bottom right
    L.control.zoom({
      position: "bottomright"
    }).addTo(map);

    markersGroup = L.layerGroup().addTo(map);

    // Map Click Handler for Nearby search
    map.on("click", (e) => {
      if (isNearbyModeActive) {
        setNearbyCenter(e.latlng);
      }
    });
  }

  // SVGs for custom neon map markers
  const SVG_ICONS = {
    "Speed Camera": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
    "Red Light Camera": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="16" x="9" y="2" rx="2"/><circle cx="12" cy="6" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>`,
    "Average Speed Camera": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="12" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>`
  };

  function getCameraTypeClass(type) {
    if (type.includes("Red Light")) return "type-redlight";
    if (type.includes("Average Speed")) return "type-avg";
    return "type-speed";
  }

  function getCameraTypeShort(type) {
    if (type.includes("Red Light")) return "Red Light";
    if (type.includes("Average Speed")) return "Avg Speed";
    return "Speed Cam";
  }

  // Create DivIcon markers
  function createMarkerIcon(cameraType, isSelected = false) {
    const typeClass = getCameraTypeClass(cameraType);
    const svg = SVG_ICONS[cameraType] || SVG_ICONS["Speed Camera"];
    
    return L.divIcon({
      className: `custom-marker ${typeClass} ${isSelected ? 'selected' : ''}`,
      html: `
        <div class="marker-pin">
          <div class="marker-inner">
            ${svg}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    });
  }

  // --------------------------------------------------
  // Data Loading & Setup
  // --------------------------------------------------
  async function loadData() {
    try {
      const response = await fetch("/cameras");
      if (!response.ok) throw new Error("Failed to fetch camera database");
      
      const geojson = await response.json();
      allCameras = geojson.features || [];
      filteredCameras = [...allCameras];

      // Extract unique regions for filters
      const regionsSet = new Set();
      allCameras.forEach(f => {
        if (f.properties.region) {
          regionsSet.add(f.properties.region.trim());
        }
      });
      uniqueRegions = Array.from(regionsSet).sort();
      
      populateRegionDropdown();
      updateDashboardStats();
      renderCharts();
      renderMapMarkers(filteredCameras);
      renderCameraList(filteredCameras);

    } catch (err) {
      console.error(err);
      cameraListContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="alert-triangle"></i>
          <h3>Data Fetch Error</h3>
          <p>Unable to communicate with the safety camera database. Verify server is running on port 3000.</p>
        </div>
      `;
      lucide.createIcons();
    }
  }

  function populateRegionDropdown() {
    uniqueRegions.forEach(region => {
      const opt = document.createElement("option");
      opt.value = region;
      opt.textContent = region;
      regionSelect.appendChild(opt);
    });
  }

  // --------------------------------------------------
  // Dashboard Analytics & Charts
  // --------------------------------------------------
  function updateDashboardStats() {
    const total = allCameras.length;
    statTotal.textContent = total;

    // Count camera types
    let speed = 0, redlight = 0, avg = 0;
    allCameras.forEach(f => {
      const type = f.properties.cameraType;
      if (type.includes("Red Light")) redlight++;
      else if (type.includes("Average Speed")) avg++;
      else speed++;
    });

    statSpeed.textContent = speed;
    statRedlight.textContent = redlight;
    statAvgSpeed.textContent = avg;

    statSpeedPercent.textContent = total > 0 ? `${Math.round((speed / total) * 100)}% of total` : "0%";
    statRedlightPercent.textContent = total > 0 ? `${Math.round((redlight / total) * 100)}% of total` : "0%";
    statAvgPercent.textContent = total > 0 ? `${Math.round((avg / total) * 100)}% of total` : "0%";
  }

  function renderCharts() {
    // 1. Camera Types Donut Chart
    const typesData = {
      labels: ['Speed Camera', 'Red Light Camera', 'Average Speed Zone'],
      datasets: [{
        data: [
          allCameras.filter(f => getCameraTypeClass(f.properties.cameraType) === 'type-speed').length,
          allCameras.filter(f => getCameraTypeClass(f.properties.cameraType) === 'type-redlight').length,
          allCameras.filter(f => getCameraTypeClass(f.properties.cameraType) === 'type-avg').length
        ],
        backgroundColor: ['#10b981', '#f43f5e', '#06b6d4'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };

    const typeCtx = document.getElementById("typeChart").getContext("2d");
    typeChart = new Chart(typeCtx, {
      type: 'doughnut',
      data: typesData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { family: 'Outfit', size: 11 }
            }
          }
        },
        cutout: '65%'
      }
    });

    // 2. Regions Horizontal Bar Chart
    const regionCounts = {};
    allCameras.forEach(f => {
      const r = f.properties.region || "Unknown";
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    });

    const sortedRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7); // Show top 7

    const regionCtx = document.getElementById("regionChart").getContext("2d");
    regionChart = new Chart(regionCtx, {
      type: 'bar',
      data: {
        labels: sortedRegions.map(r => r[0]),
        datasets: [{
          label: 'Cameras Count',
          data: sortedRegions.map(r => r[1]),
          backgroundColor: '#6366f1',
          borderRadius: 6,
          barThickness: 12
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // --------------------------------------------------
  // Rendering Markers & Map Interactions
  // --------------------------------------------------
  function renderMapMarkers(camerasList) {
    markersGroup.clearLayers();

    camerasList.forEach(camera => {
      const [lon, lat] = camera.geometry.coordinates;
      const type = camera.properties.cameraType;
      const name = camera.properties.cameraName;
      const id = camera.properties.id;

      const marker = L.marker([lat, lon], {
        icon: createMarkerIcon(type)
      });

      // Bind elegant modern popup content
      const typeClass = getCameraTypeClass(type);
      const typeText = getCameraTypeShort(type);
      const popupHTML = `
        <div class="popup-container">
          <span class="popup-type-badge ${typeClass}">${typeText}</span>
          <div class="popup-title">${name}</div>
          <div class="popup-meta">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${camera.properties.suburb}, ${camera.properties.region}</span>
          </div>
          <a href="#" class="popup-action" data-id="${id}">
            <span>Inspect Camera Details</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        </div>
      `;

      marker.bindPopup(popupHTML);
      
      // Hook up specific marker instance references
      camera.markerInstance = marker;
      markersGroup.addLayer(marker);
    });

    // Delegate click inside the popup link
    map.on("popupopen", () => {
      const inspectBtn = document.querySelector(".popup-action");
      if (inspectBtn) {
        inspectBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const camId = inspectBtn.dataset.id;
          const cam = allCameras.find(c => c.properties.id === camId);
          if (cam) showCameraDetail(cam);
        });
      }
    });
  }

  // --------------------------------------------------
  // Camera Search Filters & Listing
  // --------------------------------------------------
  async function performFilter() {
    const textQuery = searchInput.value.toLowerCase().trim();
    const regionVal = regionSelect.value;
    const typeVal = typeSelect.value;

    // Show/hide clear button
    clearSearchBtn.style.display = textQuery ? "flex" : "none";

    // Query backend search API
    try {
      const url = new URL("/cameras/search", window.location.origin);
      if (regionVal) url.searchParams.append("region", regionVal);
      if (typeVal) url.searchParams.append("type", typeVal);

      const response = await fetch(url);
      if (!response.ok) throw new Error("Search query failed");
      
      const data = await response.json();
      let results = data.features || [];

      // Apply client-side text filtering for road primary/secondary and suburb names
      if (textQuery) {
        results = results.filter(f => {
          const props = f.properties;
          const name = (props.cameraName || "").toLowerCase();
          const sub = (props.suburb || "").toLowerCase();
          const road1 = (props.roadPrimary || "").toLowerCase();
          const road2 = (props.roadSecondary || "").toLowerCase();
          return name.includes(textQuery) || sub.includes(textQuery) || road1.includes(textQuery) || road2.includes(textQuery);
        });
      }

      filteredCameras = results;
      resultsCountLabel.textContent = `Showing ${filteredCameras.length} safety zones`;
      
      renderMapMarkers(filteredCameras);
      renderCameraList(filteredCameras);

      // Adjust map view to fit bounds of filtered markers
      if (filteredCameras.length > 0) {
        const bounds = L.latLngBounds(filteredCameras.map(c => [c.geometry.coordinates[1], c.geometry.coordinates[0]]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }

    } catch (err) {
      console.error("Filtering error:", err);
    }
  }

  function renderCameraList(cameras) {
    cameraListContainer.innerHTML = "";

    if (cameras.length === 0) {
      cameraListContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="compass"></i>
          <h3>No Cameras Found</h3>
          <p>Try clearing filters or searching for another location.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    cameras.forEach(cam => {
      const props = cam.properties;
      const typeClass = getCameraTypeClass(props.cameraType);
      const typeText = getCameraTypeShort(props.cameraType);
      
      const card = document.createElement("div");
      card.className = `camera-card ${typeClass}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="card-title">${props.cameraName}</div>
          <span class="card-badge ${typeClass}">${typeText}</span>
        </div>
        <div class="card-body">
          <div class="card-meta-item">
            <i data-lucide="map-pin"></i>
            <span>${props.suburb}, ${props.region}</span>
          </div>
          ${props.roadPrimary ? `
            <div class="card-meta-item">
              <i data-lucide="milestone"></i>
              <span>${props.roadPrimary} ${props.roadSecondary ? `&amp; ${props.roadSecondary}` : ''}</span>
            </div>
          ` : ''}
        </div>
        <div class="card-footer">
          <span>Ref ID: ${props.id.slice(0, 18)}...</span>
        </div>
      `;

      card.addEventListener("click", () => {
        highlightCamera(cam);
        showCameraDetail(cam);
      });

      cameraListContainer.appendChild(card);
    });

    lucide.createIcons();
  }

  function highlightCamera(camera) {
    const [lon, lat] = camera.geometry.coordinates;
    
    // Zoom and pan
    map.setView([lat, lon], 16);
    
    // Open marker popup
    if (camera.markerInstance) {
      camera.markerInstance.openPopup();
      
      // Update selected icon state
      if (selectedMarker && selectedMarker !== camera.markerInstance) {
        // Reset previous selected marker icon style
        const prevCam = allCameras.find(c => c.markerInstance === selectedMarker);
        if (prevCam) {
          selectedMarker.setIcon(createMarkerIcon(prevCam.properties.cameraType, false));
        }
      }
      
      selectedMarker = camera.markerInstance;
      selectedMarker.setIcon(createMarkerIcon(camera.properties.cameraType, true));
    }
  }

  // Hook up filter search input and dropdown listeners
  let filterTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(performFilter, 300);
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    performFilter();
  });

  regionSelect.addEventListener("change", performFilter);
  typeSelect.addEventListener("change", performFilter);

  // --------------------------------------------------
  // Camera Details Inspect View
  // --------------------------------------------------
  function showCameraDetail(camera) {
    const props = camera.properties;
    const [lon, lat] = camera.geometry.coordinates;
    const typeClass = getCameraTypeClass(props.cameraType);
    
    const detailsHTML = `
      <div class="detail-header-card ${typeClass}">
        <span class="detail-type-badge ${typeClass}">${props.cameraType}</span>
        <h2 class="detail-name">${props.cameraName}</h2>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <i data-lucide="map"></i>
          <div>
            <div class="detail-label">Region</div>
            <div class="detail-val">${props.region}</div>
          </div>
        </div>

        <div class="detail-item">
          <i data-lucide="navigation-2"></i>
          <div>
            <div class="detail-label">Suburb / Area</div>
            <div class="detail-val">${props.suburb}</div>
          </div>
        </div>

        <div class="detail-item">
          <i data-lucide="milestone"></i>
          <div>
            <div class="detail-label">Location Setup</div>
            <div class="detail-val">
              Primary: ${props.roadPrimary || "N/A"}<br>
              ${props.roadSecondary ? `Intersecting: ${props.roadSecondary}` : 'Single Road Monitoring'}
            </div>
          </div>
        </div>

        <div class="detail-item">
          <i data-lucide="compass"></i>
          <div>
            <div class="detail-label">Coordinates</div>
            <div class="detail-val coordinates">${lat.toFixed(6)}, ${lon.toFixed(6)}</div>
          </div>
        </div>
      </div>

      <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" 
         target="_blank" 
         class="action-btn primary-btn" 
         style="justify-content: center; text-decoration: none;">
        <i data-lucide="external-link"></i>
        <span>Get Google Maps Directions</span>
      </a>

      <div class="source-disclaimer">
        <strong>Data Source Disclaimer:</strong><br>
        ${props.source || "Data sourced from NZ Transport Agency (NZTA). Licensed under Creative Commons Attribution 4.0 International license."}
      </div>
    `;

    detailContentArea.innerHTML = detailsHTML;
    detailOverlay.classList.add("active");
    lucide.createIcons();
  }

  closeDetailBtn.addEventListener("click", () => {
    detailOverlay.classList.remove("active");
  });

  // --------------------------------------------------
  // Nearby Camera Location Radar
  // --------------------------------------------------
  function setNearbyCenter(latlng) {
    nearbyCenter = latlng;
    selectedCoordsVal.textContent = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    selectedPointCard.style.display = "flex";
    nearbyResultsSection.style.display = "block";
    
    showNearbyCircleAndMarker();
    fetchNearbyCameras();
  }

  function showNearbyCircleAndMarker() {
    if (!nearbyCenter || !map) return;

    // Draw center point marker
    if (nearbyCenterMarker) {
      nearbyCenterMarker.setLatLng(nearbyCenter);
    } else {
      nearbyCenterMarker = L.marker(nearbyCenter, {
        icon: L.divIcon({
          className: "nearby-center-marker",
          html: `<div class="nearby-center-pin"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(map);
    }

    // Draw radius boundary circle
    const radiusMeters = parseInt(radiusSlider.value) * 1000;
    if (nearbyCircle) {
      nearbyCircle.setLatLng(nearbyCenter);
      nearbyCircle.setRadius(radiusMeters);
    } else {
      nearbyCircle = L.circle(nearbyCenter, {
        radius: radiusMeters,
        color: "#6366f1",
        fillColor: "#6366f1",
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: "4, 6"
      }).addTo(map);
    }

    // Zoom map slightly to fit search circle
    map.fitBounds(nearbyCircle.getBounds(), { padding: [20, 20] });
  }

  function hideNearbyCircleAndMarker() {
    if (nearbyCenterMarker && map) {
      map.removeLayer(nearbyCenterMarker);
      nearbyCenterMarker = null;
    }
    if (nearbyCircle && map) {
      map.removeLayer(nearbyCircle);
      nearbyCircle = null;
    }
  }

  async function fetchNearbyCameras() {
    if (!nearbyCenter) return;
    
    const lat = nearbyCenter.lat;
    const lng = nearbyCenter.lng;
    const radius = radiusSlider.value;

    nearbyListContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Scanning zone area...</p>
      </div>
    `;

    try {
      const response = await fetch(`/cameras/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
      if (!response.ok) throw new Error("Nearby radar failed");

      const geojson = await response.json();
      const nearbyCams = geojson.features || [];

      // Calculate exact distance to sort them client-side
      nearbyCams.forEach(cam => {
        const [lon, lat2] = cam.geometry.coordinates;
        cam.distanceKm = calculateDistance(lat, lng, lat2, lon);
      });

      // Sort by closest distance
      nearbyCams.sort((a, b) => a.distanceKm - b.distanceKm);
      
      nearbyCountLabel.textContent = nearbyCams.length;
      renderNearbyList(nearbyCams);

      // Re-render markers map to highlight only these nearby cameras
      renderMapMarkers(nearbyCams);

    } catch (err) {
      console.error(err);
      nearbyListContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="alert-circle"></i>
          <span>Nearby Search Failed</span>
        </div>
      `;
      lucide.createIcons();
    }
  }

  function renderNearbyList(cameras) {
    nearbyListContainer.innerHTML = "";

    if (cameras.length === 0) {
      nearbyListContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="shield-alert"></i>
          <h3>No Cameras Detected</h3>
          <p>No safety enforcement zones found in this range.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    cameras.forEach(cam => {
      const props = cam.properties;
      const typeClass = getCameraTypeClass(props.cameraType);
      const typeText = getCameraTypeShort(props.cameraType);
      
      const card = document.createElement("div");
      card.className = `camera-card compact-card ${typeClass}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="card-title">${props.cameraName}</div>
          <span class="distance-tag">${cam.distanceKm.toFixed(2)} km</span>
        </div>
        <div class="card-body">
          <div class="card-meta-item">
            <i data-lucide="map-pin"></i>
            <span>${props.suburb}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        highlightCamera(cam);
        showCameraDetail(cam);
      });

      nearbyListContainer.appendChild(card);
    });

    lucide.createIcons();
  }

  // Helper distance function
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // Earth km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // Radius range slider change
  radiusSlider.addEventListener("input", (e) => {
    radiusLabel.textContent = `${e.target.value} km`;
  });

  radiusSlider.addEventListener("change", () => {
    if (nearbyCenter) {
      showNearbyCircleAndMarker();
      fetchNearbyCameras();
    }
  });

  // HTML5 Geolocate me
  useLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    useLocationBtn.disabled = true;
    const btnText = useLocationBtn.querySelector("span");
    const originalText = btnText.textContent;
    btnText.textContent = "Acquiring GPS Signal...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
        setNearbyCenter(latlng);
        useLocationBtn.disabled = false;
        btnText.textContent = originalText;
      },
      (error) => {
        console.error(error);
        alert(`Geolocation failed: ${error.message}`);
        useLocationBtn.disabled = false;
        btnText.textContent = originalText;
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // Reset/Clear nearby search
  clearNearbyBtn.addEventListener("click", () => {
    hideNearbyCircleAndMarker();
    nearbyCenter = null;
    selectedPointCard.style.display = "none";
    nearbyResultsSection.style.display = "none";
    nearbyListContainer.innerHTML = "";
    
    // Restore general markers map view
    renderMapMarkers(allCameras);
  });

  // --------------------------------------------------
  // Bootstrapping
  // --------------------------------------------------
  initMap();
  loadData();
});
