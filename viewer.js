/**
 * VIEWER: Trip History Logic
 * Handles viewing, filtering, and PDF generation of historical trip logs.
 */
const VIEWER = {
    token: '',
    repo: '',
    items: [],
    filteredItems: [],
    milesData: {},
    dbFile: 'trips.json',
    milesFile: 'miles.json',
    currentLimit: 10,

    init() {
        this.loadSettings();
        UI.applyTheme();
        this.refresh();
        window.addEventListener('storage', (e) => {
            if(e.key === 'tlp_token' || e.key === 'tlp_repo') {
                this.loadSettings();
                this.refresh();
            }
        });
    },

    loadSettings() {
        this.token = localStorage.getItem('tlp_token') || '';
        this.repo = localStorage.getItem('tlp_repo') || '';
        document.getElementById('cfg-token').value = this.token;
        document.getElementById('cfg-repo').value = this.repo;
    },

    saveConfig() {
        this.token = document.getElementById('cfg-token').value.trim();
        this.repo = document.getElementById('cfg-repo').value.trim();
        localStorage.setItem('tlp_token', this.token);
        localStorage.setItem('tlp_repo', this.repo);
        this.refresh();
        document.getElementById('config-panel').open = false;
    },

    async refresh() {
        if(!this.token || !this.repo) {
            UI.updateStatus('offline', 'Setup Required');
            document.getElementById('config-panel').open = true;
            return;
        }
        UI.updateStatus('testing', 'Verifying...');

        try {
            // Fetch trips and miles sidecar file simultaneously
            const [tripsRes, milesRes] = await Promise.all([
                GITHUB.fetchFile(this.repo, this.dbFile, this.token),
                GITHUB.fetchFile(this.repo, this.milesFile, this.token)
            ]);
            
            this.items = tripsRes.content.reverse();
            this.milesData = Array.isArray(milesRes.content) ? {} : milesRes.content;
            
            document.getElementById('total-loads-count').innerText = this.items.length;
            this.filteredItems = [...this.items];
            this.render(this.filteredItems, this.currentLimit);
            
            UI.updateStatus('online', 'Database Active');
            document.getElementById('config-panel').open = false;
        } catch (e) {
            UI.updateStatus('error', 'Link Error');
        }
    },

    applyFilter() {
        const start = document.getElementById('filter-start').value;
        const end = document.getElementById('filter-end').value;
        const search = document.getElementById('filter-search').value.toUpperCase().trim();
        
        this.filteredItems = this.items.filter(t => {
            if(start && t.pDate < start) return false;
            if(end && t.pDate > end) return false;
            
            if(search) {
                const matchOrder = t.order.toUpperCase().includes(search);
                const matchTruck = t.truck.toUpperCase().includes(search);
                if(!matchOrder && !matchTruck) return false;
            }
            return true;
        });
        
        this.currentLimit = 10;
        this.render(this.filteredItems, this.currentLimit);
    },

    clearFilter() {
        document.getElementById('filter-start').value = '';
        document.getElementById('filter-end').value = '';
        document.getElementById('filter-search').value = '';
        this.filteredItems = [...this.items];
        this.currentLimit = 10;
        this.render(this.filteredItems, this.currentLimit);
    },

    /**
     * Removes an entry from the database.
     */
    async deleteEntry(id) {
        if (!confirm("Are you sure you want to delete this trip log?")) return;
        
        UI.updateStatus('testing', 'Deleting...');
        try {
            // Fetch both files to get latest data and SHAs for the update
            const [tripsRes, milesRes] = await Promise.all([
                GITHUB.fetchFile(this.repo, this.dbFile, this.token),
                GITHUB.fetchFile(this.repo, this.milesFile, this.token)
            ]);

            const updatedTrips = tripsRes.content.filter(t => t.id !== id);
            await GITHUB.saveFile(this.repo, this.dbFile, this.token, updatedTrips, `Delete Log: ${id}`, tripsRes.sha);

            // Clean up the miles sidecar file if the ID exists there
            const milesMap = milesRes.content;
            if (milesMap && typeof milesMap === 'object' && !Array.isArray(milesMap) && milesMap[id]) {
                delete milesMap[id];
                await GITHUB.saveFile(this.repo, this.milesFile, this.token, milesMap, `Delete Miles: ${id}`, milesRes.sha);
            }
            
            alert("Entry Deleted Successfully");
            this.refresh();
        } catch (e) {
            UI.updateStatus('error', 'Delete Failed');
            alert("Failed to delete entry.");
        }
    },

    // --- PDF Generation Logic ---

    async exportPDF() {
        if (this.filteredItems.length === 0) return alert("No data to export");
        
        const btn = document.querySelector('button[onclick="VIEWER.exportPDF()"]');
        const originalText = btn.innerText;
        btn.innerText = "...";
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            
            // Load custom handwriting font for a "filled out form" look
            let hasFont = false;
            try {
                const res = await fetch('https://fonts.gstatic.com/s/caveat/v18/WnzW6H6EYW2D7XB6mAt9pDSX_V7_p-8m6ySGHmS_5Gj_m_U.ttf');
                if (!res.ok) throw new Error("Font fetch failed");
                const blob = await res.blob();
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(blob);
                });
                doc.addFileToVFS('Handwriting.ttf', base64);
                doc.addFont('Handwriting.ttf', 'Handwriting', 'normal');
                hasFont = true;
            } catch (e) {
                console.error("Handwriting font failed to load:", e);
            }

            // Header Information
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('EFL TRANSPORT INC  TEL: 204-416-7460  accounting@eflfreight.com', 30, 15);

            doc.text('Driver: ', 14, 25);
            const dName = 'Krishan Verma';
            const dLabelW = doc.getTextWidth('Driver: ');
            doc.setFont('helvetica', 'normal');
            doc.text(dName, 14 + dLabelW, 25);
            doc.line(14 + dLabelW, 26, 14 + dLabelW + doc.getTextWidth(dName), 26);

            // Date Helper
            const formatDate = (dateStr) => {
                if (!dateStr) return "";
                const date = new Date(dateStr + 'T00:00:00');
                if (isNaN(date.getTime())) return dateStr;
                const day = String(date.getDate()).padStart(2, '0');
                const month = date.toLocaleString('en-US', { month: 'short' });
                const year = date.getFullYear();
                return `${day}-${month}-${year}`;
            };

            // Date Range Section
            doc.setFont('helvetica', 'bold');
            const start = document.getElementById('filter-start').value;
            const end = document.getElementById('filter-end').value;
            let dateRange = "__________________________";
            const sStr = formatDate(start);
            const eStr = formatDate(end);
            if(sStr && eStr) dateRange = `${sStr} to ${eStr}`;
            else if(sStr || eStr) dateRange = sStr || eStr;
            
            doc.text('From: ', 150, 25);
            const fLabelW = doc.getTextWidth('From: ');
            doc.setFont('helvetica', 'normal');
            doc.text(dateRange, 150 + fLabelW, 25);
            if (dateRange !== "__________________________") {
                doc.line(150 + fLabelW, 26, 150 + fLabelW + doc.getTextWidth(dateRange), 26);
            }

            // Main Data Table
            const tableColumn = ["Order#", "Date", "Pick Up City", "Date", "Deliver City", "Truck", "Trailer", "Tarp", "Co-Driver"];
            const tableRows = [...this.filteredItems].reverse().map(t => [
                t.order,
                formatDate(t.pDate),
                t.pCity,
                formatDate(t.dDate),
                t.dCity,
                t.truck,
                t.trailer,
                t.tarp,
                t.codriver || 'N/A'
            ]);

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                theme: 'grid',
                styles: { 
                    font: hasFont ? 'Handwriting' : 'helvetica',
                    fontSize: hasFont ? 12 : 9, 
                    cellPadding: 2,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0]
                },
                headStyles: { 
                    fillColor: [255, 255, 255], 
                    fontStyle: 'bold', 
                    font: 'helvetica', 
                    fontSize: 9,
                    textColor: [0, 0, 0]
                },
                alternateRowStyles: { fillColor: [255, 255, 255] }
            });

            // "Office Use Only" Bottom Section
            let finalY = doc.lastAutoTable.finalY + 15;
            if (finalY > 140) { doc.addPage(); finalY = 20; }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('For Office Use Only', 14, finalY);

            const officeTableData = [
                ["Total Loaded Miles", ""], ["Total Empty Miles", ""], ["Total Team Miles", ""],
                ["Total Dry van miles", ""], ["Total Pick", ""], ["Total Drop", ""],
                ["Total Tarp", ""], ["Waiting (Must be approved by dispatcher)", ""], ["Total City hours", ""]
            ];

            doc.autoTable({
                body: officeTableData,
                startY: finalY + 2,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40 } },
                margin: { left: 14 }
            });

            const payTableData = [["Total Pay:", ""], ["Total Pay with Tax:", ""]];
            doc.autoTable({
                head: [["", "Amount"]],
                body: payTableData,
                startY: finalY + 2,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30 } },
                margin: { left: 180 }
            });

            doc.save(`fleet_report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error("PDF Export Error:", err);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            btn.innerText = originalText;
        }
    },

    // --- UI Rendering ---

    render(items, limit = items.length) {
        const list = document.getElementById('history-list');
        const displayItems = items.slice(0, limit);
        
        if(!displayItems || displayItems.length === 0) {
            list.innerHTML = `<div class="text-center py-20 opacity-30 font-black uppercase text-sm">No Loads Found</div>`;
            return;
        }

        list.innerHTML = `
        <div class="overflow-x-auto">
        <table class="w-full table-auto border-collapse bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <thead>
                <tr class="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th class="p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Order #</th>
                    <th class="p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Pickup</th>
                    <th class="p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Delivery</th>
                    <th class="hidden sm:table-cell p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Truck</th>
                    <th class="hidden md:table-cell p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Trailer #</th>
                    <th class="hidden md:table-cell p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Tarp</th>
                    <th class="hidden lg:table-cell p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Miles</th>
                    <th class="hidden lg:table-cell p-2 sm:p-3 text-left text-sm font-bold text-slate-700 dark:text-slate-300">Co-Driver</th>
                    <th class="p-3 text-right text-sm font-bold text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${displayItems.map(t => {
                    const tarpStyle = t.tarp === 'Steel' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40' : 
                                    t.tarp === 'Lumber' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40' : 
                                    'bg-slate-100 dark:bg-slate-800 text-slate-500';
                    const miles = this.milesData[t.id] ? `${this.milesData[t.id]} mi` : '-';
                    return `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td class="p-2 sm:p-3 text-sm font-bold text-blue-600">${t.order}</td>
                    <td class="p-2 sm:p-3 text-sm">
                        <div class="font-bold">${t.pDate}</div>
                        <div class="text-[10px] text-slate-600 dark:text-slate-400">${t.pCity}</div>
                    </td>
                    <td class="p-2 sm:p-3 text-sm">
                        <div class="font-bold text-rose-600">${t.dDate}</div>
                        <div class="text-[10px] text-slate-600 dark:text-slate-400">${t.dCity}</div>
                    </td>
                    <td class="hidden sm:table-cell p-2 sm:p-3 text-sm font-mono font-bold">${t.truck}</td>
                    <td class="hidden md:table-cell p-2 sm:p-3 text-sm font-mono opacity-60">${t.trailer}</td>
                    <td class="hidden md:table-cell p-2 sm:p-3 text-sm">
                        <span class="px-2 py-1 rounded text-xs font-bold uppercase ${tarpStyle}">${t.tarp}</span>
                    </td>
                    <td class="hidden lg:table-cell p-2 sm:p-3 text-sm font-bold text-blue-500/80">${miles}</td>
                    <td class="hidden lg:table-cell p-2 sm:p-3 text-sm">${t.codriver || 'N/A'}</td>
                    <td class="p-3 text-right">
                        <button onclick="VIEWER.deleteEntry('${t.id}')" class="text-rose-500 hover:text-rose-700 p-1 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                </tr>`;
                }).join('')}
            </tbody>
        </table>
        </div>`;

        if (limit < items.length) {
            list.innerHTML += `
            <div class="text-center pt-6">
                <button onclick="VIEWER.loadMore()" class="bg-blue-600 py-3 px-6 rounded-xl text-white font-black uppercase text-sm tracking-widest shadow-lg hover:bg-blue-500 active:scale-[0.98] transition-all">Load More Entries</button>
            </div>`;
        }
    },

    loadMore() {
        this.currentLimit += 10;
        this.render(this.filteredItems, this.currentLimit);
    }
};
VIEWER.init();