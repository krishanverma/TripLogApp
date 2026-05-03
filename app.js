/**
 * APP: Entry Terminal Logic
 * Main controller for the trip logging interface, handling data entry, location geocoding, and distance calculation.
 */
const APP = {
    config: { token: '', repo: '' },
    isLocalWork: false,
    dbFile: 'trips.json',
    milesFile: 'miles.json',
    pickupCoords: null,
    deliveryCoords: null,
    isPickupDone: false, // UI Toggle state
    isDeliveryDone: false,
    /** Mapping for Geocoding API state names to postal abbreviations */
    stateMap: {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
        'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC', 'Québec': 'QC', 'Saskatchewan': 'SK', 'Northwest Territories': 'NT', 'Nunavut': 'NU', 'Yukon': 'YT'
    },
    
    /**
     * Boots the application, loads user settings, and verifies the database link.
     */
    init() {
        this.loadSettings();
        UI.applyTheme();
        if (this.config.token && this.config.repo) {
            this.verifyConnection(true);
        } else {
            UI.updateStatus('offline', 'Setup Required');
            document.getElementById('config-panel').open = true;
        }
    },

    /**
     * Retrieves GitHub credentials from browser localStorage.
     */
    loadSettings() {
        this.config.token = localStorage.getItem('tlp_token') || '';
        this.config.repo = localStorage.getItem('tlp_repo') || '';
        document.getElementById('cfg-token').value = this.config.token;
        document.getElementById('cfg-repo').value = this.config.repo;
    },

    /**
     * Persists user configuration to localStorage and re-verifies the connection.
     */
    saveConfig() {
        const token = document.getElementById('cfg-token').value.trim();
        const repo = document.getElementById('cfg-repo').value.trim();
        localStorage.setItem('tlp_token', token);
        localStorage.setItem('tlp_repo', repo);
        this.config.token = token;
        this.config.repo = repo;
        this.verifyConnection();
    },

    /**
     * Checks if the GitHub token and repo path are valid by attempting a fetch.
     * @param {boolean} silent - If true, doesn't close the config panel automatically.
     */
    async verifyConnection(silent = false) {
        UI.updateStatus('testing', 'Verifying...');
        try {
            await GITHUB.fetchFile(this.config.repo, this.dbFile, this.config.token);
            UI.updateStatus('online', 'Database Active');
            if (!silent) document.getElementById('config-panel').open = false;
        } catch (e) { UI.updateStatus('error', 'Link Error'); }
    },

    // --- Location Autocomplete ---

    debounceTimer: null, // Timer to prevent excessive API calls while typing

    /**
     * Fetches city suggestions using the Photon (OpenStreetMap) API.
     * Fired on input events for pickup/delivery city fields.
     */
    fetchSuggestions(inputId, listId) {
        clearTimeout(this.debounceTimer);
        const query = document.getElementById(inputId).value;

        // Clear coords and hide display if user is typing
        if (inputId === 'pickup_city') this.pickupCoords = null;
        if (inputId === 'delivery_city') this.deliveryCoords = null;
        document.getElementById('miles-estimate-container').classList.add('hidden');

        const list = document.getElementById(listId);
        
        if (query.length < 3) { 
            list.classList.add('hidden'); 
            return; 
        }

        this.debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`);
                const data = await res.json();
                const filtered = data.features.filter(f => (f.properties.type === 'city' || f.properties.type === 'town') && (f.properties.countrycode === 'US' || f.properties.countrycode === 'CA')).slice(0, 6);
                if (filtered.length > 0) {
                    list.innerHTML = filtered.map(item => {
                        const p = item.properties;
                        const sAbbr = APP.stateMap[p.state] || p.state;
                        const display = [p.name, sAbbr].filter(Boolean).join(", ");
                        const [lon, lat] = item.geometry.coordinates;
                        return `<div onclick="APP.selectSuggestion('${inputId}', '${listId}', '${display.replace(/'/g, "\\'")}', ${lon}, ${lat})" class="p-3 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 last:border-0 font-medium">${display}</div>`;
                    }).join('');
                    list.classList.remove('hidden');
                } else { list.classList.add('hidden'); }
            } catch (e) { console.error(e); }
        }, 400);
    },

    selectSuggestion(inputId, listId, value, lon, lat) {
        document.getElementById(inputId).value = value;
        document.getElementById(listId).classList.add('hidden');

        if (inputId === 'pickup_city') this.pickupCoords = [lon, lat];
        if (inputId === 'delivery_city') this.deliveryCoords = [lon, lat];

        this.updateDistance();
    },

    clearSuggestions(listId) {
        document.getElementById(listId).classList.add('hidden');
    },

    async updateDistance() {
        if (!this.pickupCoords || !this.deliveryCoords) return;

        const display = document.getElementById('estimated-miles');
        const container = document.getElementById('miles-estimate-container');

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${this.pickupCoords[0]},${this.pickupCoords[1]};${this.deliveryCoords[0]},${this.deliveryCoords[1]}?overview=false`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.code === 'Ok' && data.routes.length > 0) {
                const miles = (data.routes[0].distance * 0.000621371).toFixed(0);
                display.innerText = `${miles} MILES`;
                container.classList.remove('hidden');
            }
        } catch (e) { console.error("Distance error:", e); }
    },

    // --- Status Toggles ---

    /**
     * Toggles the pickup confirmation state.
     * Updates both the internal boolean and the button UI.
     */
    togglePickupStatus() {
        this.isPickupDone = !this.isPickupDone;
        const btn = document.getElementById('pickup-done-btn');
        btn.innerText = `Pickup? = ${this.isPickupDone ? 'YES' : 'NO'}`;
        btn.classList.toggle('bg-emerald-600', this.isPickupDone);
        btn.classList.toggle('text-white', this.isPickupDone);
        btn.classList.toggle('text-emerald-600', !this.isPickupDone);
    },

    /**
     * Toggles the delivery confirmation state.
     * Updates both the internal boolean and the button UI.
     */
    toggleDeliveryStatus() {
        this.isDeliveryDone = !this.isDeliveryDone;
        const btn = document.getElementById('delivery-done-btn');
        btn.innerText = `Delivery? = ${this.isDeliveryDone ? 'YES' : 'NO'}`;
        btn.classList.toggle('bg-rose-600', this.isDeliveryDone);
        btn.classList.toggle('text-white', this.isDeliveryDone);
        btn.classList.toggle('text-rose-600', !this.isDeliveryDone);
    },

    // --- Local Work vs Standard Trip Toggle ---

    /**
     * Switches the form between Long-Haul Trip and Local Work (Hourly) mode.
     */
    toggleLocalWork() {
        this.isLocalWork = !this.isLocalWork;
        const orderInput = document.getElementById('order_number');
        const btn = document.getElementById('local-work-btn');
        const standardFields = document.getElementById('standard-trip-fields');
        const localFields = document.getElementById('local-work-fields');
        const truckField = document.getElementById('truck');
        const trailerField = document.getElementById('trailer');
        const distanceContainer = document.getElementById('miles-estimate-container');
        
        if(this.isLocalWork) {
            orderInput.value = "LOCAL WORK"; orderInput.readOnly = true;
            btn.classList.add('bg-blue-600', 'text-white');
            standardFields.classList.add('hidden'); localFields.classList.remove('hidden');
            ['pickup_city', 'delivery_city', 'pickup_date', 'delivery_date'].forEach(id => document.getElementById(id).required = false);
            ['checkin_date', 'checkin_time', 'checkout_date', 'checkout_time'].forEach(id => document.getElementById(id).required = true);
            truckField.required = false; trailerField.required = false;
            distanceContainer.classList.add('hidden');
        } else {
            orderInput.value = ""; orderInput.readOnly = false;
            btn.classList.remove('bg-blue-600', 'text-white');
            standardFields.classList.remove('hidden'); localFields.classList.add('hidden');
            ['pickup_city', 'delivery_city', 'pickup_date', 'delivery_date'].forEach(id => document.getElementById(id).required = true);
            ['checkin_date', 'checkin_time', 'checkout_date', 'checkout_time'].forEach(id => document.getElementById(id).required = false);
            truckField.required = true; trailerField.required = true;
            const display = document.getElementById('local-hours-display');
            if(display) { display.innerText = "WAITING FOR TIME DATA..."; display.className = "text-center text-[10px] font-black uppercase tracking-[0.2em] py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400"; }
            if (this.pickupCoords && this.deliveryCoords) distanceContainer.classList.remove('hidden');
        }
    },

    /**
     * Calculates the duration between check-in and check-out for local work.
     * Updates the hours display UI in real-time.
     */
    updateLocalHours() {
        const inDate = document.getElementById('checkin_date').value;
        const inTime = document.getElementById('checkin_time').value;
        const outDate = document.getElementById('checkout_date').value;
        const outTime = document.getElementById('checkout_time').value;
        const display = document.getElementById('local-hours-display');
        if (inDate && inTime && outDate && outTime && display) {
            const start = new Date(`${inDate}T${inTime}`);
            const end = new Date(`${outDate}T${outTime}`);
            const diffMs = end - start;
            if (diffMs >= 0) {
                const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
                display.innerText = `${diffHrs} HOURS TOTAL`;
                display.className = "text-center text-[10px] font-black uppercase tracking-[0.2em] py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-600";
            } else {
                display.innerText = "INVALID TIME RANGE";
                display.className = "text-center text-[10px] font-black uppercase tracking-[0.2em] py-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600";
            }
        }
    },

    /**
     * Orchestrates the final submission of the trip log.
     * Saves data to trips.json and distance data to miles.json simultaneously.
     * @param {Event} e - Form submit event.
     */
    async submit(e) {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "UPLOADING...";
        try {
            // Fetch both trips and miles data
            const { content: trips, sha } = await GITHUB.fetchFile(this.config.repo, this.dbFile, this.config.token);
            let { content: milesMap, sha: milesSha } = await GITHUB.fetchFile(this.config.repo, this.milesFile, this.config.token);

            let newEntry = {
                id: crypto.randomUUID(), created_at: new Date().toISOString(),
                tripMode: this.isLocalWork ? 'local-work' : 'long-haul',
                truck: document.getElementById('truck').value.toUpperCase(),
                trailer: document.getElementById('trailer').value.toUpperCase(),
                tarp: document.querySelector('input[name="tarp_type"]:checked').value,
                codriver: document.getElementById('co_driver').value || "N/A",
                isPickupDone: this.isPickupDone,
                isDeliveryDone: this.isDeliveryDone
            };

            if (this.isLocalWork) {
                const inDate = document.getElementById('checkin_date').value, inTime = document.getElementById('checkin_time').value;
                const outDate = document.getElementById('checkout_date').value, outTime = document.getElementById('checkout_time').value;
                const start = new Date(`${inDate}T${inTime}`), end = new Date(`${outDate}T${outTime}`);
                if (end <= start) { alert("INVALID TIME RANGE: Check-Out must be after Check-In."); btn.disabled = false; btn.innerText = "Submit Log to Cloud"; return; }
                const diffHrs = ((end - start) / (1000 * 60 * 60)).toFixed(2);
                newEntry.order = "LOCAL WORK"; newEntry.pDate = inDate; newEntry.dDate = outDate; newEntry.pCity = `${inTime} - ${outTime}, ${diffHrs} hrs`; newEntry.dCity = "LOCAL";
            } else {
                newEntry.order = document.getElementById('order_number').value.toUpperCase();
                newEntry.pDate = document.getElementById('pickup_date').value; newEntry.pCity = document.getElementById('pickup_city').value;
                newEntry.dDate = document.getElementById('delivery_date').value; newEntry.dCity = document.getElementById('delivery_city').value;

                // Handle estimated miles logging to separate file
                const estMilesText = document.getElementById('estimated-miles').innerText;
                if (estMilesText && estMilesText !== "0 MILES") {
                    if (Array.isArray(milesMap)) milesMap = {}; // Initialize if new file
                    milesMap[newEntry.id] = estMilesText.replace(' MILES', '');
                }
            }

            // Save primary trip data and optional miles sidecar data
            trips.push(newEntry);
            if (!this.isLocalWork && Object.keys(milesMap).length > 0) {
                await GITHUB.saveFile(this.config.repo, this.milesFile, this.config.token, milesMap, `Miles for: ${newEntry.order}`, milesSha);
            }
            
            await GITHUB.saveFile(this.config.repo, this.dbFile, this.config.token, trips, `Log: ${newEntry.order}`, sha);
            
            alert("ENTRY LOGGED"); 
            if (this.isLocalWork) this.toggleLocalWork(); 
            document.getElementById('log-form').reset();
            this.pickupCoords = null;
            this.deliveryCoords = null;
            document.getElementById('miles-estimate-container').classList.add('hidden');
            
            // Reset custom toggles
            if (this.isPickupDone) this.togglePickupStatus();
            if (this.isDeliveryDone) this.toggleDeliveryStatus();
            
        } catch (e) { alert("ERROR SAVING"); } finally { btn.disabled = false; btn.innerText = "Submit Log to Cloud"; }
    }
};
document.getElementById('log-form').addEventListener('submit', (e) => APP.submit(e));
APP.init();