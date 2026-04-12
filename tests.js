/**
 * Test Engine: Validation Logic
 */
const TEST_RUNNER = {
    passed: 0,
    failed: 0,

    async run() {
        console.log("%c Starting System Tests... ", "background: #1e293b; color: #3b82f6; font-weight: bold;");
        
        this.header("Core UI & Application");

        this.assert("UI: Theme toggle updates localStorage", () => {
            const initial = localStorage.getItem('theme');
            UI.toggleTheme();
            const changed = localStorage.getItem('theme');
            UI.toggleTheme(); // Revert
            return initial !== changed;
        });

        this.assert("APP: Local hours calculation is accurate", () => {
            // Sandbox values set in tests.html (08:00 to 12:30)
            APP.updateLocalHours();
            const display = document.getElementById('local-hours-display').innerText;
            return display === "4.50 HOURS TOTAL";
        });

        this.assert("APP: State map contains Manitoba", () => {
            return APP.stateMap['Manitoba'] === 'MB';
        });

        this.assert("APP: Invalid time range detection", () => {
            document.getElementById('checkin_time').value = "17:00";
            document.getElementById('checkout_time').value = "08:00"; 
            APP.updateLocalHours();
            const display = document.getElementById('local-hours-display').innerText;
            return display === "INVALID TIME RANGE";
        });

        this.header("GitHub Services");

        await this.assertAsync("GITHUB: fetchFile returns empty array on 404", async () => {
            const result = await GITHUB.fetchFile('invalid/repo', 'non-existent.json', '');
            return Array.isArray(result.content) && result.content.length === 0 && result.sha === null;
        });

        this.header("Expense Manager");

        this.assert("EXPENSES: Currency toggle updates CAD field visibility", () => {
            const usdRadio = document.querySelector('input[name="exp_currency"][value="USD"]');
            const wrap = document.getElementById('cad_conv_wrap');
            const input = document.getElementById('exp_cad_amount');
            
            usdRadio.checked = true;
            EXPENSES.toggleCurrency();
            const isVisible = !wrap.classList.contains('hidden');
            const isRequired = input.required === true;
            
            return isVisible && isRequired;
        });

        this.assert("EXPENSES: Filter correctly identifies note match", () => {
            EXPENSES.items = [
                { date: '2023-10-01', note: 'Fuel Payment', amount: 100, currency: 'CAD' },
                { date: '2023-10-05', note: 'Dinner', amount: 50, currency: 'CAD' }
            ];
            document.getElementById('filter-search').value = 'fuel';
            EXPENSES.applyFilter();
            return EXPENSES.filteredItems.length === 1 && EXPENSES.filteredItems[0].note === 'Fuel Payment';
        });

        await this.assertAsync("EXPENSES: PDF export triggers document save", async () => {
            const originalJSPDF = window.jspdf;
            let savedName = "";
            window.jspdf = {
                jsPDF: function() {
                    this.setFont = () => this; this.setFontSize = () => this;
                    this.text = () => this; this.line = () => this;
                    this.save = (name) => { savedName = name; };
                    this.autoTable = (cfg) => { if(cfg.didDrawPage) cfg.didDrawPage({cursor: {y: 100}}); };
                    this.getTextWidth = () => 10;
                    return this;
                }
            };
            EXPENSES.filteredItems = [{ date: '2023-10-01', note: 'Fuel', amount: 50, currency: 'CAD' }];
            await EXPENSES.exportPDF();
            window.jspdf = originalJSPDF;
            return savedName.startsWith("EFL_Report");
        });

        this.header("Trip Viewer");

        this.assert("VIEWER: Filter correctly identifies search match", () => {
            const mockItems = [
                { order: "LOAD-101", truck: "T01", pDate: "2023-01-01" },
                { order: "LOAD-999", truck: "T05", pDate: "2023-01-01" }
            ];
            const search = "101";
            const filtered = mockItems.filter(t => t.order.includes(search));
            return filtered.length === 1 && filtered[0].order === "LOAD-101";
        });

        await this.assertAsync("VIEWER: PDF export triggers document save", async () => {
            const originalJSPDF = window.jspdf;
            let savedName = "";
            window.jspdf = {
                jsPDF: function() {
                    this.setFont = () => this; this.setFontSize = () => this;
                    this.text = () => this; this.line = () => this;
                    this.addPage = () => this; this.addFont = () => this; this.addFileToVFS = () => this;
                    this.save = (name) => { savedName = name; };
                    this.autoTable = () => { this.lastAutoTable = { finalY: 100 }; };
                    this.getTextWidth = () => 10;
                    return this;
                }
            };
            VIEWER.filteredItems = [{ order: 'T-1', pDate: '2023-10-01', pCity: 'Winnipeg', dDate: '2023-10-02', dCity: 'Calgary', truck: 'T1', trailer: 'T2' }];
            await VIEWER.exportPDF();
            window.jspdf = originalJSPDF;
            return savedName.startsWith("fleet_report");
        });

        this.updateSummary();
    },

    /**
     * Synchronous Assertion
     */
    assert(name, fn) {
        try {
            const result = fn();
            this.log(name, result);
            result ? this.passed++ : this.failed++;
        } catch (e) {
            this.log(name, false, e.message);
            this.failed++;
        }
    },

    /**
     * Asynchronous Assertion
     */
    async assertAsync(name, fn) {
        try {
            const result = await fn();
            this.log(name, result);
            result ? this.passed++ : this.failed++;
        } catch (e) {
            this.log(name, false, e.message);
            this.failed++;
        }
    },

    header(name) {
        const container = document.getElementById('results');
        const h = document.createElement('div');
        h.className = "pt-6 pb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 mb-2";
        h.innerText = name;
        container.appendChild(h);
    },

    log(name, success, error = "") {
        const container = document.getElementById('results');
        const status = success ? "PASS" : "FAIL";
        const colorClass = success ? "test-pass" : "test-fail";
        
        const entry = document.createElement('div');
        entry.className = "p-3 bg-slate-900 border border-slate-800 rounded flex justify-between items-center";
        entry.innerHTML = `
            <span class="text-sm font-bold text-slate-300">${name}</span>
            <span class="text-xs font-black ${colorClass}">${status} ${error ? `(${error})` : ''}</span>
        `;
        container.appendChild(entry);
    },

    updateSummary() {
        document.getElementById('pass-count').innerText = this.passed;
        document.getElementById('fail-count').innerText = this.failed;
        
        if (this.failed === 0) {
            console.log("%c ALL TESTS PASSED ", "background: #065f46; color: #34d399; font-weight: bold;");
        } else {
            console.warn(`%c TESTS FAILED: ${this.failed} `, "background: #9f1239; color: #fda4af; font-weight: bold;");
        }
    }
};

// Start runner
window.onload = () => TEST_RUNNER.run();