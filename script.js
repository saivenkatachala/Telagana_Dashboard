// LCC Projection from TS_DISTRICTS_TOTAL.json
const lccProj = "+proj=lcc +lat_1=12.472944 +lat_2=35.172806 +lat_0=24 +lon_0=80 +x_0=4000000 +y_0=4000000 +datum=WGS84 +units=m +no_defs";
const wgs84Proj = "EPSG:4326";

const map = L.map('map').setView([17.8, 79.1], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let districtLayer;
let allPhcData = [];
let telanganaDistricts;

// Load the JSON district data
fetch('TS_DISTRICTS_TOTAL.json')
    .then(res => res.json())
    .then(data => {
        // Convert LCC coordinates to WGS84 for Leaflet
        data.features.forEach(feature => {
            feature.geometry.rings = feature.geometry.rings.map(ring => 
                ring.map(coord => proj4(lccProj, wgs84Proj, coord))
            );
        });
        telanganaDistricts = data;
        populateDistrictFilter(data);
        renderMap(data);
    });

function populateDistrictFilter(data) {
    const select = document.getElementById('districtSelect');
    const districts = [...new Set(data.features.map(f => f.attributes.DISTRICT))].sort();
    districts.forEach(dist => {
        const opt = document.createElement('option');
        opt.value = dist;
        opt.textContent = dist;
        select.appendChild(opt);
    });
}

function renderMap(geoData) {
    if (districtLayer) map.removeLayer(districtLayer);
    
    districtLayer = L.geoJSON(convertEsriToGeoJSON(geoData), {
        style: function(feature) {
            return { color: "#2c3e50", weight: 2, fillOpacity: 0.2, fillColor: "#3498db" };
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                showDistrictDetails(feature.properties.DISTRICT);
            });
            layer.bindTooltip(feature.properties.DISTRICT);
        }
    }).addTo(map);
}

// Convert provided JSON structure to standard GeoJSON
function convertEsriToGeoJSON(esriData) {
    return {
        type: "FeatureCollection",
        features: esriData.features.map(f => ({
            type: "Feature",
            geometry: { type: "Polygon", coordinates: f.geometry.rings },
            properties: f.attributes
        }))
    };
}

// CSV Parsing
document.getElementById('csvFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            allPhcData = results.data;
            alert("PHC Data Loaded successfully.");
        }
    });
});

function showDistrictDetails(districtName) {
    // Normalize names for matching
    const targetName = districtName.trim().toUpperCase();
    const districtPhcs = allPhcData.filter(p => 
        p.District && p.District.trim().toUpperCase() === targetName
    );

    const tableBody = document.getElementById('phcTableBody');
    const container = document.getElementById('phcTableContainer');
    
    tableBody.innerHTML = '';
    
    if (districtPhcs.length > 0) {
        districtPhcs.forEach(phc => {
            const row = `<tr><td>${phc.Mandal}</td><td>${phc.PHC}</td></tr>`;
            tableBody.innerHTML += row;
        });
        document.getElementById('dragHandle').textContent = `${districtName} PHCs (${districtPhcs.length})`;
    } else {
        tableBody.innerHTML = '<tr><td colspan="2">No PHC data found for this district.</td></tr>';
        document.getElementById('dragHandle').textContent = districtName;
    }

    container.style.display = 'block';
}

// Filter Dropdown logic
document.getElementById('districtSelect').addEventListener('change', function() {
    const selected = Array.from(this.selectedOptions).map(opt => opt.value);
    
    if (selected.includes('all')) {
        renderMap(telanganaDistricts);
    } else {
        const filteredJson = {
            ...telanganaDistricts,
            features: telanganaDistricts.features.filter(f => selected.includes(f.attributes.DISTRICT))
        };
        renderMap(filteredJson);
    }
});

// Dragging Logic for the Table
const dragElement = document.getElementById("phcTableContainer");
const handle = document.getElementById("dragHandle");
let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

handle.onmousedown = dragMouseDown;

function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
}

function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    dragElement.style.top = (dragElement.offsetTop - pos2) + "px";
    dragElement.style.left = (dragElement.offsetLeft - pos1) + "px";
    dragElement.style.bottom = "auto";
    dragElement.style.right = "auto";
}

function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
}