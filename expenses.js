/**
 * EXPENSES: Expense Manager Logic
 * Provides specialized tools for tracking CAD/USD expenses and generating accounting-ready PDF reports.
 */
const EXPENSES = {
    user: null,
    db: firebase.firestore(),
    items: [],
    filteredItems: [],
    currentLimit: 10,

    /**
     * Boots the expense module and attempts to sync with the database.
     */
    init() {
        UI.applyTheme();
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.user = user;
                this.refresh();
            } else {
                window.location.href = 'index.html';
            }
        });
    },

    /**
     * Synchronizes current expense data from the cloud.
     */
    async refresh() {
        UI.updateStatus('testing', 'Syncing...', 'bg-emerald-500');
        try {
            const snapshot = await this.db.collection('expenses')
                .where('userId', '==', this.user.uid)
                .get();

            this.items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.created_at || "").localeCompare(a.created_at || ""));
            this.filteredItems = [...this.items];
            this.render(this.filteredItems, this.currentLimit);
            UI.updateStatus('online', 'Database Active', 'bg-emerald-500');
        } catch (e) { 
            UI.updateStatus('error', 'Storage Error', 'bg-emerald-500'); 
        }
    },

    /**
     * Logic to save a new expense entry.
     * Handles conditional CAD conversion logic for USD transactions.
     */
    async submit(e) {
        e.preventDefault();
        if (!this.user) return alert("Please login first");
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "SAVING...";
        
        try {
            const newEntry = {
                userId: this.user.uid,
                created_at: new Date().toISOString(),
                date: document.getElementById('exp_date').value,
                amount: parseFloat(document.getElementById('exp_amount').value),
                currency: document.querySelector('input[name="exp_currency"]:checked').value,
                cadAmount: document.querySelector('input[name="exp_currency"]:checked').value === 'USD' ? parseFloat(document.getElementById('exp_cad_amount').value) : null,
                note: document.getElementById('exp_note').value || "No notes"
            };

            await this.db.collection('expenses').add(newEntry);
            
            document.getElementById('expense-form').reset();
            this.toggleCurrency();
            this.refresh();
        } catch (e) { alert("ERROR SAVING"); } finally { btn.disabled = false; btn.innerText = "Save Expense"; }
    },

    /**
     * Removes an expense entry from the database.
     */
    async deleteEntry(id) {
        if (!confirm("Are you sure you want to delete this expense?")) return;
        
        UI.updateStatus('testing', 'Deleting...', 'bg-emerald-500');
        try {
            await this.db.collection('expenses').doc(id).delete();
            
            alert("Expense Deleted Successfully");
            this.refresh();
        } catch (e) {
            UI.updateStatus('error', 'Delete Failed', 'bg-emerald-500');
            alert("Failed to delete expense.");
        }
    },

    /**
     * Shows CAD conversion field only if USD is selected.
     */
    toggleCurrency() {
        const isUSD = document.querySelector('input[name="exp_currency"]:checked').value === 'USD';
        const wrap = document.getElementById('cad_conv_wrap');
        const input = document.getElementById('exp_cad_amount');
        wrap.classList.toggle('hidden', !isUSD);
        input.required = isUSD;
    },

    /**
     * Filters the expense view based on date and description notes.
     */
    applyFilter() {
        const start = document.getElementById('filter-start').value;
        const end = document.getElementById('filter-end').value;
        const search = document.getElementById('filter-search').value.toLowerCase().trim();

        this.filteredItems = this.items.filter(t => {
            if (start && t.date < start) return false;
            if (end && t.date > end) return false;
            if (search && !t.note.toLowerCase().includes(search)) return false;
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
     * Generates the accounting PDF.
     * Logic separates CAD and USD expenses into distinct pages for easier bookkeeping.
     */
    async exportPDF() {
        if (this.filteredItems.length === 0) return alert("No data to export! Filter some entries first.");
        const btn = document.querySelector('button[onclick="EXPENSES.exportPDF()"]');
        const originalText = btn.innerText;
        btn.innerText = "...";
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const formatPrettyDate = (dateStr) => {
                if (!dateStr) return "";
                const date = new Date(dateStr + 'T00:00:00');
                return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            };
            const start = document.getElementById('filter-start').value;
            const end = document.getElementById('filter-end').value;
            let dateRangeDisplay = (start || end) ? `${formatPrettyDate(start)} to ${formatPrettyDate(end)}` : formatPrettyDate(new Date().toISOString().split('T')[0]);
            const chronoItems = [...this.filteredItems].reverse();
            const usdItems = chronoItems.filter(i => i.currency === 'USD');
            const cadItems = chronoItems.filter(i => i.currency === 'CAD' || !i.currency);
            let currentY = 15;

            const addSection = (items, currencyType) => {
                if (items.length === 0) return;
                if (currentY > 15) { doc.addPage(); currentY = 15; }
                currentY = 40;
                doc.setFont('helvetica', 'bold').setFontSize(10);
                doc.text('EFL TRANSPORT INC.', 14, currentY);
                doc.text('TEL: 204-416-7460', 14, currentY + 5);
                doc.text('accounting@eflfreight.com', 14, currentY + 10);
                doc.setFontSize(18).text(`EXPENSE SHEET ${currencyType}`, 105, currentY + 25, { align: 'center' });
                
                const midLineY = currentY + 35;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold').text("Name- ", 14, midLineY);
                doc.setFont('helvetica', 'normal').text("Krishan Verma", 28, midLineY); // TODO: Pull from user profile
                doc.line(28, midLineY + 1, 60, midLineY + 1);

                doc.setFont('helvetica', 'bold').text("Truck- ", 75, midLineY);
                doc.setFont('helvetica', 'normal').text("__________", 90, midLineY);

                doc.setFont('helvetica', 'bold').text("Date- ", 135, midLineY);
                doc.setFont('helvetica', 'normal').text(dateRangeDisplay, 148, midLineY);
                doc.line(148, midLineY + 1, 148 + doc.getTextWidth(dateRangeDisplay), midLineY + 1);
                
                let tableColumn = currencyType === 'USD' ? ["DATE", "EXPENSE TYPE", "TOTAL USD AMOUNT", "TOTAL CAD AMOUNT"] : ["DATE", "EXPENSE TYPE", "GST", "TOTAL"];
                let tableRows = items.map(t => currencyType === 'USD' ? [formatPrettyDate(t.date), t.note, `$${t.amount.toFixed(2)}`, t.cadAmount ? `$${t.cadAmount.toFixed(2)}` : '-'] : [formatPrettyDate(t.date), t.note, "-", `$${t.amount.toFixed(2)}`]);

                doc.autoTable({
                    head: [tableColumn], body: tableRows, startY: currentY + 50, theme: 'grid', styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1 },
                    didDrawPage: (data) => { currentY = data.cursor.y + 10; }
                });
            };
            addSection(usdItems, 'USD'); addSection(cadItems, 'CAD');
            doc.save(`EFL_Report_${dateRangeDisplay.replace(/ /g, '_').replace(/,/g, '')}.pdf`);
        } catch (err) { console.error("Export Error:", err); alert("Failed to generate PDF"); } finally { btn.innerText = originalText; }
    },

    // --- UI Rendering ---

    render(items = this.items, limit = this.currentLimit) {
        const list = document.getElementById('expense-list');
        document.getElementById('total-expenses-count').innerText = items.length;
        
        const displayItems = items.slice(0, limit);
        if (displayItems.length === 0) {
            list.innerHTML = `<div class="text-center py-10 opacity-30 text-xs font-black uppercase tracking-widest">No Expenses Found</div>`;
            return;
        }
        list.innerHTML = displayItems.map(t => `
        <div class="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div class="flex items-center gap-4">
                <button onclick="EXPENSES.deleteEntry('${t.id}')" class="text-rose-400 hover:text-rose-600 transition-colors p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${UI.escapeHTML(t.date)}</span>
                    <span class="font-bold text-sm">${UI.escapeHTML(t.note)}</span>
                    <span class="text-[10px] font-bold text-emerald-500 uppercase">${UI.escapeHTML(t.currency ? t.currency : '')}</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-lg font-black text-emerald-600">$${t.amount.toFixed(2)}</div>
                ${t.cadAmount ? `<div class="text-[10px] font-bold text-amber-600 italic">→ $${t.cadAmount.toFixed(2)} CAD</div>` : ''}
            </div>
        </div>`).join('');
        if (limit < items.length) {
            list.innerHTML += `<div class="text-center pt-6"><button onclick="EXPENSES.loadMore()" class="bg-emerald-600 py-3 px-6 rounded-xl text-white font-black uppercase text-sm tracking-widest shadow-lg hover:bg-emerald-500 active:scale-[0.98] transition-all">Load More Entries</button></div>`;
        }
    },

    loadMore() { this.currentLimit += 10; this.render(this.filteredItems, this.currentLimit); }
};
document.getElementById('expense-form').addEventListener('submit', (e) => EXPENSES.submit(e));
EXPENSES.init();