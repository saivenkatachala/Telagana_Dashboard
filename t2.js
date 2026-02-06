// ==========================================
// 🔴 PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLP625gegCWrhWvcDATHbFgbZkBHpaeCAD0jfBBbf9pJ_hzO7l9d3ZU9xfMlIpia4KTA/exec";
// ==========================================

// --- CONFIGURATION ---
const categories = [
    "Geographical Area", "Population Data", "Literacy Rate", "Working Population",
    "Occupation", "Health Infrastructure", "Education Sector", "Aasara Pensions",
    "Road Infrastructure", "Transport"
];

// --- ICONS ---
const categoryIcons = {
    "Geographical Area": "landscape", "Population Data": "groups",
    "Literacy Rate": "auto_stories", "Working Population": "engineering",
    "Occupation": "work", "Health Infrastructure": "local_hospital",
    "Education Sector": "school", "Aasara Pensions": "elderly",
    "Road Infrastructure": "add_road", "Transport": "directions_bus"
};

// Helper to guess icon for specific fields
function getFieldIcon(key) {
    const k = key.toLowerCase();
    if(k.includes('male') && !k.includes('fe')) return 'man';
    if(k.includes('female')) return 'woman';
    if(k.includes('total')) return 'functions';
    if(k.includes('rural')) return 'agriculture';
    if(k.includes('urban')) return 'apartment';
    if(k.includes('school') || k.includes('college')) return 'school';
    if(k.includes('hospital') || k.includes('bed')) return 'local_hospital';
    if(k.includes('road')) return 'edit_road';
    if(k.includes('area') || k.includes('villages')) return 'grid_on';
    if(k.includes('mandals')) return 'map';
    return 'label_important'; // Default
}

// --- GLOBAL VARIABLES ---
let map, geoLayer, singleLayer;
let currentMapData = [];
let currentGeoJSON = null;
let currentActiveDistrict = null; // Tracks which district is currently open
const initialView = { center: [17.8, 79.1], zoom: 7 };

// --- INITIALIZATION ---
window.onload = function() {
    const mapSel = document.getElementById('mapCategory');
    categories.forEach(c => mapSel.add(new Option(c, c)));

    dragElement(document.getElementById("floating-table"));
    initMap();
};

// --- MAP LOGIC ---
function initMap() {
    map = L.map('map').setView(initialView.center, initialView.zoom);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB'
    }).addTo(map);

    fetch('TS_DISTRICTS_TOTAL.json')
        .then(res => res.json())
        .then(data => {
            const geoJsonData = convertEsriToGeoJSON(data);
            currentGeoJSON = geoJsonData;
            renderFullMap(); 
        })
        .catch(err => console.error("Map Data Error:", err));
}

function convertEsriToGeoJSON(esriData) {
    const lccProj = "+proj=lcc +lat_1=12.472944 +lat_2=35.172806 +lat_0=24 +lon_0=80 +x_0=4000000 +y_0=4000000 +datum=WGS84 +units=m +no_defs";
    const wgs84Proj = "EPSG:4326";

    const features = esriData.features.map(f => {
        const polygons = f.geometry.rings.map(ring => {
            return ring.map(coord => proj4(lccProj, wgs84Proj, coord));
        });

        return {
            type: "Feature",
            properties: f.attributes,
            geometry: { type: "Polygon", coordinates: polygons }
        };
    });

    return { type: "FeatureCollection", features: features };
}

function renderFullMap() {
    if(singleLayer) map.removeLayer(singleLayer);
    if(geoLayer) map.removeLayer(geoLayer);

    geoLayer = L.geoJSON(currentGeoJSON, {
        style: { color: "#34495e", weight: 1, fillOpacity: 0.2, fillColor: "#3498db" },
        onEachFeature: (feature, layer) => {
            layer.bindTooltip(feature.properties.DISTRICT, { sticky: true });
            layer.on('click', (e) => {
                handleDistrictClick(feature, layer);
            });
        }
    }).addTo(map);
}

function handleDistrictClick(feature, layer) {
    const distName = feature.properties.DISTRICT;
    currentActiveDistrict = distName; // Store active district

    map.fitBounds(layer.getBounds());

    if(geoLayer) map.removeLayer(geoLayer);
    if(singleLayer) map.removeLayer(singleLayer);

    singleLayer = L.geoJSON(feature, {
        style: { color: "#e74c3c", weight: 3, fillOpacity: 0.6, fillColor: "#c0392b" },
        onEachFeature: (feature, newLayer) => {
            newLayer.on('click', () => showDistrictPopup(newLayer, distName));
        }
    }).addTo(map);

    showDistrictData(distName);

    // Trigger Popup
    const leafLayer = singleLayer.getLayers()[0];
    showDistrictPopup(leafLayer, distName);
}

function resetMap() {
    currentActiveDistrict = null; // Clear active district
    map.setView(initialView.center, initialView.zoom);
    map.closePopup();
    
    renderFullMap();
    
    const cat = document.getElementById('mapCategory').value;
    if(cat) {
        document.getElementById('table-title').innerText = `Telangana ${cat} Data`;
        renderTable(currentMapData);
        document.getElementById('floating-table').style.display = 'block';
    } else {
        closeTable();
    }
}

// --- DATA & POPUP LOGIC ---

function loadMapData() {
    const cat = document.getElementById('mapCategory').value;
    if(!cat) return;
    
    toggleLoader(true);
    fetch(`${SCRIPT_URL}?action=read&category=${cat}`)
    .then(r => r.json())
    .then(data => {
        toggleLoader(false);
        currentMapData = data;
        
        const subSel = document.getElementById('mapSubCategory');
        subSel.innerHTML = '<option value="all">View Complete Data</option>';
        if(data.length > 0) {
            Object.keys(data[0])
                .filter(k => k !== 'rowId' && k !== 'District')
                .forEach(k => subSel.add(new Option(k, k)));
        }
        
        document.getElementById('table-title').innerText = `Telangana ${cat} Data`;
        showTable(); 
    });
}

function showDistrictPopup(layer, districtName) {
    if(currentMapData.length === 0) return;

    const cat = document.getElementById('mapCategory').value;
    const subCat = document.getElementById('mapSubCategory').value; 
    const catIcon = categoryIcons[cat] || "info"; 
    
    const searchName = districtName.toUpperCase().trim();
    const row = currentMapData.find(r => r.District && r.District.toUpperCase().trim() === searchName);

    if(!row) return;

    let dataRowsHTML = '';
    let hasData = false;

    Object.keys(row).forEach(key => {
        if(key === 'District' || key === 'rowId') return;
        
        // Filter Logic
        if(subCat !== 'all' && key !== subCat) return;

        hasData = true;
        const fieldIcon = getFieldIcon(key);

        dataRowsHTML += `
            <div class="popup-data-row">
                <div class="row-left">
                    <span class="material-icons row-icon">${fieldIcon}</span>
                    <span class="p-label">${key}:</span>
                </div>
                <span class="p-value">${row[key]}</span>
            </div>
        `;
    });

    if(!hasData) dataRowsHTML = '<div class="popup-data-row">No data for selected filter.</div>';

    const popupHTML = `
        <div class="custom-popup">
            <div class="popup-header">
                <span class="material-icons popup-icon">${catIcon}</span>
                <h3>${districtName}</h3>
            </div>
            <div class="popup-body">
                ${dataRowsHTML}
            </div>
        </div>
    `;

    // Opens popup and updates content if already open
    layer.bindPopup(popupHTML, {
        maxWidth: 300,
        className: 'animated-popup'
    }).openPopup();
}

// --- UPDATED FILTER FUNCTION ---
function filterTableData() { 
    // 1. Update Table
    renderTable(currentMapData); 

    // 2. Update Popup (Only if a district is currently active and isolated)
    if(currentActiveDistrict && singleLayer) {
        // Get the specific Leaflet layer object from the GeoJSON group
        const leafLayer = singleLayer.getLayers()[0];
        if(leafLayer) {
            showDistrictPopup(leafLayer, currentActiveDistrict);
        }
    }
}

function showDistrictData(districtName) {
    if(currentMapData.length === 0) {
        alert("Please select a Data Category first.");
        return;
    }
    
    const searchName = districtName.toUpperCase().trim();
    const districtRows = currentMapData.filter(row => 
        row.District && row.District.toUpperCase().trim() === searchName
    );

    if(districtRows.length === 0) {
        alert(`No data found for ${districtName}.`);
        return;
    }
    
    const cat = document.getElementById('mapCategory').value;
    document.getElementById('table-title').innerText = `${districtName} ${cat} Data`;
    document.getElementById('floating-table').style.display = 'block';
    renderTable(districtRows);
}

function showTable() {
    const cat = document.getElementById('mapCategory').value || "State";
    document.getElementById('table-title').innerText = `Telangana ${cat} Data`;
    document.getElementById('floating-table').style.display = 'block';
    renderTable(currentMapData);
}

function renderTable(data) {
    const subCat = document.getElementById('mapSubCategory').value;
    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');
    
    if(!data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='2' style='text-align:center'>No Data Available</td></tr>";
        return;
    }

    let columns = ['District'];
    if(subCat === 'all') {
        const keys = Object.keys(data[0]).filter(k => k !== 'rowId' && k !== 'District');
        columns = columns.concat(keys);
    } else {
        columns.push(subCat);
    }

    thead.innerHTML = columns.map(c => `<th>${c}</th>`).join('');
    tbody.innerHTML = data.map(row => {
        return `<tr>${columns.map(col => `<td>${row[col] || '-'}</td>`).join('')}</tr>`;
    }).join('');
}

function closeTable() { document.getElementById('floating-table').style.display = 'none'; }
function toggleLoader(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; }

// --- DRAG LOGIC ---
function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById("drag-handle")) {
    document.getElementById("drag-handle").onmousedown = dragMouseDown;
  }
  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}
