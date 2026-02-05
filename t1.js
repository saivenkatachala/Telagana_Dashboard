// ==========================================
// 🔴 UPDATE THIS URL FROM YOUR DEPLOYMENT
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
    "Occupation": ["Cultivators", "Agri Labourers", "Household Ind", "Other Workers", "Non Working"], // Special Handling
    "Health Infrastructure": ["Sub Centers", "PHC", "Area Hospitals", "Dist Hospitals", "Teaching Hospitals"],
    "Education Sector": ["Primary Schools", "Upper Primary", "High Schools", "Total Schools", "Model Schools", "KGBV", "Junior Colleges", "Degree Colleges", "Eng Colleges", "MBA Colleges"],
    "Aasara Pensions": ["Old Age", "Disabled", "Widow", "Weavers", "Toddy Tappers"],
    "Road Infrastructure": ["State Highways", "Major Dist Roads", "Rural Roads", "Total Roads"],
    "Transport": ["TransportType"] // Special Handling
};

const districtsList = ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Hanamkonda", "Yadadri Bhuvanagiri"];

// --- STATE MANAGEMENT ---
let currentMapData = []; // Data from Sheets
let currentGeoJSON = null; // Map shapes
let map = null;
let geoLayer = null;

// --- INITIALIZATION ---
window.onload = function() {
    // Populate Dropdowns
    const entrySel = document.getElementById('entryCategory');
    const mapSel = document.getElementById('mapCategory');
    
    categories.forEach(c => {
        entrySel.add(new Option(c, c));
        mapSel.add(new Option(c, c));
    });
    
    // Init Map
    initMap();
    
    // Setup Draggable
    dragElement(document.getElementById("floating-table"));
};

function switchMode(mode) {
    document.getElementById('entry-screen').style.display = mode === 'entry' ? 'block' : 'none';
    document.getElementById('map-screen').style.display = mode === 'map' ? 'block' : 'none';
    document.getElementById('entry-controls').style.display = mode === 'entry' ? 'block' : 'none';
    document.getElementById('map-controls').style.display = mode === 'map' ? 'block' : 'none';
    
    document.querySelectorAll('.mode-switch button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if(mode === 'map') {
        setTimeout(() => { map.invalidateSize(); }, 200);
    }
}

// --- MAP & GEOJSON LOGIC ---
function initMap() {
    // Using standard Leaflet WGS84
    map = L.map('map').setView([17.8, 79.1], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Fetch Local GeoJSON
    fetch('TS_DISTRICTS_TOTAL.json')
        .then(res => res.json())
        .then(data => {
            // CONVERT LCC to WGS84 (Based on your previous snippet)
            const lccProj = "+proj=lcc +lat_1=12.472944 +lat_2=35.172806 +lat_0=24 +lon_0=80 +x_0=4000000 +y_0=4000000 +datum=WGS84 +units=m +no_defs";
            const wgs84Proj = "EPSG:4326";
            
            data.features.forEach(feature => {
                if(feature.geometry.rings) {
                    feature.geometry.rings = feature.geometry.rings.map(ring => 
                        ring.map(coord => proj4(lccProj, wgs84Proj, coord))
                    );
                }
            });
            currentGeoJSON = data;
            renderGeoJSON(); // Render empty initially
        })
        .catch(err => console.error("Error loading JSON:", err));
}

function renderGeoJSON() {
    if(geoLayer) map.removeLayer(geoLayer);
    
    geoLayer = L.geoJSON(currentGeoJSON, {
        style: { color: "#333", weight: 1, fillOpacity: 0.1 },
        onEachFeature: onEachDistrict
    }).addTo(map);
}

function onEachDistrict(feature, layer) {
    layer.on({
        click: (e) => {
            const districtName = feature.attributes.DISTRICT; // Ensure this matches JSON key
            showDistrictData(districtName);
            // Highlight
            geoLayer.resetStyle();
            e.target.setStyle({ weight: 3, color: '#e74c3c', fillOpacity: 0.3 });
        }
    });
}

// --- DATA ENTRY LOGIC ---
function initEntryForm() {
    const cat = document.getElementById('entryCategory').value;
    const formDiv = document.getElementById('form-fields');
    formDiv.innerHTML = getFormHTML(cat);
    document.getElementById('hiddenCategory').value = cat;
    
    // Load existing data for table
    loadEntryTable(cat);
}

function showEntryForm() {
    document.getElementById('dataForm').style.display = 'block';
    document.getElementById('dataForm').reset();
    document.getElementById('hiddenRowId').value = "";
}
function hideEntryForm() { document.getElementById('dataForm').style.display = 'none'; }

function getFormHTML(cat) {
    let html = `<div class="form-group"><label>District</label><select name="District" required><option value="">Select</option>${districtsList.map(d=>`<option>${d}</option>`).join('')}</select></div>`;
    
    if(cat === "Occupation") {
        formSchema[cat].forEach(type => {
            html += `<div style="grid-column:1/-1; color:blue; border-bottom:1px solid #eee; margin-top:10px;">${type}</div>`;
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
function createInput(l) { return `<div class="form-group"><label>${l}</label><input type="number" name="${l.replace(/ /g,'')}"></div>`; }

// --- SAVE DATA ---
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
    toggleLoader(true);
    fetch(`${SCRIPT_URL}?action=read&category=${cat}`)
    .then(r => r.json()).then(data => {
        toggleLoader(false);
        const wrapper = document.getElementById('entry-table-wrapper');
        document.getElementById('entry-list').style.display = 'block';
        if(data.length === 0) { wrapper.innerHTML = "No records."; return; }
        
        // Simple View for Entry Mode
        let html = `<table><thead><tr><th>District</th><th>Action</th></tr></thead><tbody>`;
        data.forEach(row => {
            html += `<tr><td>${row.District}</td><td><button onclick="deleteRow('${cat}', '${row.rowId}')">Delete</button></td></tr>`;
        });
        wrapper.innerHTML = html + "</tbody></table>";
    });
}

function deleteRow(cat, id) {
    if(!confirm("Delete?")) return;
    fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "delete", category: cat, rowId: id }) })
    .then(r=>r.json()).then(() => loadEntryTable(cat));
}


// --- MAP DATA VISUALIZATION LOGIC ---

function loadMapData() {
    const cat = document.getElementById('mapCategory').value;
    toggleLoader(true);
    
    // 1. Fetch Sheet Data
    fetch(`${SCRIPT_URL}?action=read&category=${cat}`)
    .then(r => r.json())
    .then(data => {
        toggleLoader(false);
        currentMapData = data; // Store globally
        
        // 2. Populate Sub-Dropdown
        const subSel = document.getElementById('mapSubCategory');
        subSel.innerHTML = '<option value="all">View Complete Data</option>';
        if(data.length > 0) {
            // Get keys excluding internal ones
            Object.keys(data[0]).filter(k => k !== 'rowId' && k !== 'District').forEach(k => {
                subSel.add(new Option(k, k));
            });
        }
        
        showTable(); // Show table immediately
    });
}

// Triggered by Sub-dropdown or Map Click
function filterTableData() {
    renderTable(currentMapData);
}

function showDistrictData(districtName) {
    // Filter data for this district
    const districtData = currentMapData.filter(row => row.District === districtName);
    
    if(districtData.length === 0) {
        alert("No data found for " + districtName + " in this category.");
        return;
    }
    
    // Force show table and render just this row
    document.getElementById('floating-table').style.display = 'block';
    renderTable(districtData);
}

function showTable() {
    document.getElementById('floating-table').style.display = 'block';
    renderTable(currentMapData);
}

function renderTable(dataToRender) {
    const subCat = document.getElementById('mapSubCategory').value;
    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');
    
    if(!dataToRender || dataToRender.length === 0) {
        tbody.innerHTML = "<tr><td>No Data Available</td></tr>";
        return;
    }

    // Determine Columns
    let columns = ['District'];
    if(subCat === 'all') {
        columns = Object.keys(dataToRender[0]).filter(k => k !== 'rowId' && k !== 'District');
        columns.unshift('District');
    } else {
        columns.push(subCat);
    }

    // Build Header
    thead.innerHTML = columns.map(c => `<th>${c}</th>`).join('');

    // Build Body
    tbody.innerHTML = dataToRender.map(row => {
        return `<tr>${columns.map(col => `<td>${row[col] || '-'}</td>`).join('')}</tr>`;
    }).join('');
}

function closeTable() { document.getElementById('floating-table').style.display = 'none'; }
function toggleLoader(show) { document.getElementById('loader').style.display = show ? 'block' : 'none'; }

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