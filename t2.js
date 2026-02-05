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

const formSchema = {
    "Geographical Area": ["Revenue Villages", "Revenue Mandals", "Revenue Divisions", "Gram Panchayats"],
    "Population Data": ["Total Pop", "Males", "Females", "Rural", "Urban"],
    "Literacy Rate": ["Total Lit", "Male Lit", "Female Lit"],
    "Working Population": ["Total Work", "Male Work", "Female Work"],
    "Occupation": ["Cultivators", "Agri Labourers", "Household Ind", "Other Workers", "Non Working"],
    "Health Infrastructure": ["Sub Centers", "PHC", "Area Hospitals", "Dist Hospitals", "Teaching Hospitals"],
    "Education Sector": ["Primary Schools", "Upper Primary", "High Schools", "Total Schools", "Model Schools", "KGBV", "Junior Colleges", "Degree Colleges", "Eng Colleges", "MBA Colleges"],
    "Aasara Pensions": ["Old Age", "Disabled", "Widow", "Weavers", "Toddy Tappers"],
    "Road Infrastructure": ["State Highways", "Major Dist Roads", "Rural Roads", "Total Roads"],
    "Transport": ["TransportType"]
};

// --- GLOBAL VARIABLES ---
let map, geoLayer;
let currentMapData = [];
let currentGeoJSON = null;
const districtsList = ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Hanamkonda", "Yadadri Bhuvanagiri"];

// --- INITIALIZATION ---
window.onload = function() {
    // 1. Populate Dropdowns
    const entrySel = document.getElementById('entryCategory');
    const mapSel = document.getElementById('mapCategory');
    
    categories.forEach(c => {
        entrySel.add(new Option(c, c));
        mapSel.add(new Option(c, c));
    });

    // 2. Initialize Draggable Table
    dragElement(document.getElementById("floating-table"));
};

// --- MODE SWITCHING ---
function switchMode(mode) {
    const entryScreen = document.getElementById('entry-screen');
    const mapScreen = document.getElementById('map-screen');
    const entryControls = document.getElementById('entry-controls');
    const mapControls = document.getElementById('map-controls');

    if(mode === 'entry') {
        entryScreen.style.display = 'block';
        mapScreen.style.display = 'none';
        entryControls.style.display = 'block';
        mapControls.style.display = 'none';
    } else {
        entryScreen.style.display = 'none';
        mapScreen.style.display = 'block';
        entryControls.style.display = 'none';
        mapControls.style.display = 'block';
        
        // Initialize map only when needed to save resources/rendering issues
        if(!map) initMap();
        else setTimeout(() => map.invalidateSize(), 200);
    }

    // Update Buttons
    document.querySelectorAll('.mode-switch button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// --- MAP LOGIC (FIXED PROJECTION & RENDERING) ---
function initMap() {
    map = L.map('map').setView([17.8, 79.1], 7); // Center of Telangana
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB'
    }).addTo(map);

    fetch('TS_DISTRICTS_TOTAL.json')
        .then(res => res.json())
        .then(data => {
            // FIX: Convert ESRI JSON "rings" + LCC Projection -> Standard GeoJSON "Polygon" + WGS84
            const geoJsonData = convertEsriToGeoJSON(data);
            
            currentGeoJSON = geoJsonData;
            renderGeoJSON();
        })
        .catch(err => console.error("Map Data Error:", err));
}

function convertEsriToGeoJSON(esriData) {
    // Projection String from your Metadata
    const lccProj = "+proj=lcc +lat_1=12.472944 +lat_2=35.172806 +lat_0=24 +lon_0=80 +x_0=4000000 +y_0=4000000 +datum=WGS84 +units=m +no_defs";
    const wgs84Proj = "EPSG:4326";

    const features = esriData.features.map(f => {
        // Convert Rings (Projected) to Coordinates (Lat/Lng)
        // Note: Proj4 returns [lng, lat], which is what GeoJSON wants.
        const polygons = f.geometry.rings.map(ring => {
            return ring.map(coord => proj4(lccProj, wgs84Proj, coord));
        });

        return {
            type: "Feature",
            properties: f.attributes, // Pass attributes (DISTRICT, etc.)
            geometry: {
                type: "Polygon",
                coordinates: polygons
            }
        };
    });

    return { type: "FeatureCollection", features: features };
}

function renderGeoJSON() {
    if(geoLayer) map.removeLayer(geoLayer);
    
    geoLayer = L.geoJSON(currentGeoJSON, {
        style: { color: "#34495e", weight: 1, fillOpacity: 0.2, fillColor: "#3498db" },
        onEachFeature: (feature, layer) => {
            // Tooltip on Hover
            layer.bindTooltip(feature.properties.DISTRICT, { sticky: true });
            
            // Click Handler
            layer.on('click', (e) => {
                // Highlight
                geoLayer.resetStyle();
                e.target.setStyle({ weight: 3, color: '#e74c3c', fillOpacity: 0.5 });
                
                // Show Data
                showDistrictData(feature.properties.DISTRICT);
            });
        }
    }).addTo(map);
}

// --- DATA ENTRY LOGIC ---
function initEntryForm() {
    const cat = document.getElementById('entryCategory').value;
    const formDiv = document.getElementById('form-fields');
    formDiv.innerHTML = getFormHTML(cat);
    
    document.getElementById('hiddenCategory').value = cat;
    document.getElementById('form-card').style.display = 'block';
    
    loadEntryTable(cat); // Refresh list
}

function showEntryForm() {
    document.getElementById('dataForm').reset();
    document.getElementById('hiddenRowId').value = "";
    document.getElementById('form-card').scrollIntoView({behavior: "smooth"});
}

function hideEntryForm() {
    document.getElementById('dataForm').reset();
    document.getElementById('form-card').style.display = 'none';
}

function getFormHTML(cat) {
    // District is always first
    let html = `
        <div class="form-group">
            <label>District Name</label>
            <select name="District" required>
                <option value="">-- Select District --</option>
                ${districtsList.map(d=>`<option>${d}</option>`).join('')}
            </select>
        </div>
    `;
    
    if(cat === "Occupation") {
        formSchema[cat].forEach(type => {
            html += `<div style="grid-column:1/-1; color:var(--accent); font-weight:600; margin-top:10px; border-bottom:1px solid #eee;">${type}</div>`;
            ['Total', 'Male', 'Female'].forEach(sub => html += createInput(`${type} ${sub}`));
        });
    } else if (cat === "Transport") {
        html += `<div class="form-group"><label>Type</label><select name="TransportType"><option>Road</option><option>Rail</option></select></div>
                 ${createInput("Bus Depots")}${createInput("Fleet")}${createInput("Daily Kms")}`;
    } else {
        formSchema[cat].forEach(f => html += createInput(f));
    }
    return html;
}

function createInput(l) { 
    // Remove spaces for name attribute
    const name = l.replace(/ /g,''); 
    return `<div class="form-group"><label>${l}</label><input type="number" step="any" name="${name}"></div>`; 
}

// --- API ACTIONS (SAVE / DELETE / READ) ---

function handleFormSubmit(e) {
    e.preventDefault();
    toggleLoader(true);
    const formData = {};
    new FormData(e.target).forEach((v,k) => formData[k] = v);

    fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "save", formData: formData })
    }).then(r => r.json()).then(res => {
        toggleLoader(false);
        alert(res.message);
        hideEntryForm();
        loadEntryTable(document.getElementById('entryCategory').value);
    });
}

function loadEntryTable(cat) {
    const wrapper = document.getElementById('entry-table-wrapper');
    wrapper.innerHTML = "<p class='placeholder-text'>Loading records...</p>";
    
    fetch(`${SCRIPT_URL}?action=read&category=${cat}`)
    .then(r => r.json()).then(data => {
        if(data.length === 0) { 
            wrapper.innerHTML = "<p class='placeholder-text'>No records found. Add one above.</p>"; 
            return; 
        }
        
        let html = `<table><thead><tr><th>District</th><th>Action</th></tr></thead><tbody>`;
        data.forEach(row => {
            html += `<tr>
                <td>${row.District}</td>
                <td><button onclick="deleteRow('${cat}', '${row.rowId}')" style="color:red; border:none; background:none; cursor:pointer;">Delete</button></td>
            </tr>`;
        });
        wrapper.innerHTML = html + "</tbody></table>";
    });
}

function deleteRow(cat, id) {
    if(!confirm("Are you sure you want to delete this record?")) return;
    toggleLoader(true);
    fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "delete", category: cat, rowId: id }) })
    .then(r=>r.json()).then(res => {
        toggleLoader(false);
        loadEntryTable(cat);
    });
}

// --- MAP INTERACTION & TABLE LOGIC ---

function loadMapData() {
    const cat = document.getElementById('mapCategory').value;
    if(!cat) return;
    
    toggleLoader(true);
    fetch(`${SCRIPT_URL}?action=read&category=${cat}`)
    .then(r => r.json())
    .then(data => {
        toggleLoader(false);
        currentMapData = data;
        
        // Populate Sub-Category Dropdown
        const subSel = document.getElementById('mapSubCategory');
        subSel.innerHTML = '<option value="all">View Complete Data</option>';
        if(data.length > 0) {
            // Get columns excluding 'rowId' and 'District'
            Object.keys(data[0])
                .filter(k => k !== 'rowId' && k !== 'District')
                .forEach(k => subSel.add(new Option(k, k)));
        }
        
        showTable(); // Show data immediately
    });
}

function filterTableData() {
    renderTable(currentMapData);
}

function showDistrictData(districtName) {
    if(currentMapData.length === 0) {
        alert("Please select a Data Category first using the sidebar.");
        return;
    }
    
    const districtRows = currentMapData.filter(row => row.District === districtName);
    if(districtRows.length === 0) {
        alert(`No data found for ${districtName} in the current category.`);
        return;
    }
    
    document.getElementById('floating-table').style.display = 'block';
    renderTable(districtRows);
}

function showTable() {
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

    // Determine Columns
    let columns = ['District'];
    if(subCat === 'all') {
        const keys = Object.keys(data[0]).filter(k => k !== 'rowId' && k !== 'District');
        columns = columns.concat(keys);
    } else {
        columns.push(subCat);
    }

    // Build Header
    thead.innerHTML = columns.map(c => `<th>${c}</th>`).join('');

    // Build Body
    tbody.innerHTML = data.map(row => {
        return `<tr>${columns.map(col => `<td>${row[col] || '-'}</td>`).join('')}</tr>`;
    }).join('');
}

function closeTable() { document.getElementById('floating-table').style.display = 'none'; }
function toggleLoader(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; }

// --- DRAG LOGIC (Standard W3C) ---
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