/**
 * PAY_MANAGER: Compensation Logic
 * Manages pay rates and calculates driver earnings based on trip details.
 */
class PayManager {
    constructor() {
        this.user = null;
        this.db = firebase.firestore();
        
        // Default rates as requested
        this.rates = {
            mileRate: 0.59,
            pickRate: 30.00,
            dropRate: 30.00,
            mbPickRate: 50.00,
            mbDropRate: 50.00,
            extraPickRate: 80.00,
            extraDropRate: 50.00,
            localRate: 24.00,
            tarpRates: {
                'None': 0,
                'Steel': 30.00,
                'Lumber': 60.00
            }
        };
    }

    /**
     * Initializes manager and attaches auth listener.
     */
    init() {
        firebase.auth().onAuthStateChanged(async user => {
            if (user) {
                this.user = user;
                await this.loadRates();
            }
        });
    }

    async loadRates() {
        try {
            const doc = await this.db.collection('settings').doc(this.user.uid).get();
            if (doc.exists && doc.data().payRates) {
                this.rates = { ...this.rates, ...doc.data().payRates };
            }
        } catch (e) {
            console.error("Error loading pay rates:", e);
        }
    }

    async saveRates(newRates) {
        if (!this.user) return;
        try {
            await this.db.collection('settings').doc(this.user.uid).set({
                payRates: newRates,
                updated_at: new Date().toISOString()
            }, { merge: true });
            this.rates = newRates;
        } catch (e) {
            console.error("Error saving pay rates:", e);
        }
    }

    calculateTripPay(trip) {
        if (!trip) return 0;

        // CASE 1: Local Work (Hourly)
        // If the trip is local, we return immediately to ensure long-haul rates aren't applied.
        if (trip.tripMode === 'local-work' || (trip.order && trip.order.toUpperCase() === 'LOCAL WORK')) {
            const match = String(trip.pCity || "").match(/([\d.]+)\s*hrs/i);
            const hours = match ? parseFloat(match[1]) : 0;
            return hours * (this.rates.localRate || 0);
        }

        // CASE 2: Long-Haul (Mileage + Stops + Tarping)
        let total = 0;

        // 1. Pay per mile
        total += (Number(trip.miles) || 0) * (this.rates.mileRate || 0);

        // 2. Pickup Logic (Standard, Manitoba, or Additional/Extra)
        if (trip.isPickupDone === 'yes' || trip.isPickupDone === true) {
            const isMB = String(trip.pCity || "").toUpperCase().includes('MB');
            total += isMB ? this.rates.mbPickRate : this.rates.pickRate;
        } else if (trip.isPickupDone === 'extra') {
            total += this.rates.extraPickRate;
        }

        // 3. Delivery Logic (Standard, Manitoba, or Additional/Extra)
        if (trip.isDeliveryDone === 'yes' || trip.isDeliveryDone === true) {
            const isMB = String(trip.dCity || "").toUpperCase().includes('MB');
            total += isMB ? this.rates.mbDropRate : this.rates.dropRate;
        } else if (trip.isDeliveryDone === 'extra') {
            total += this.rates.extraDropRate;
        }

        // 4. Pay per Tarp Type
        if (trip.tarp && this.rates.tarpRates[trip.tarp]) {
            total += this.rates.tarpRates[trip.tarp];
        }

        return total;
    }

    /**
     * Generates a descriptive breakdown of how the total pay was calculated.
     * Useful for tooltips.
     */
    getPayBreakdown(trip) {
        if (!trip) return "";

        if (trip.tripMode === 'local-work' || (trip.order && trip.order.toUpperCase() === 'LOCAL WORK')) {
            const match = String(trip.pCity || "").match(/([\d.]+)\s*hrs/i);
            const hours = match ? parseFloat(match[1]) : 0;
            return `<div class="text-blue-400 font-black mb-1">LOCAL WORK</div>${hours} hrs @ $${this.rates.localRate}/hr<br>Total: <span class="text-white font-bold">$${(hours * this.rates.localRate).toFixed(2)}</span>`;
        }

        let lines = [];
        lines.push('<div class="text-emerald-400 font-black mb-1 border-b border-white/10 pb-1">PAY BREAKDOWN</div>');
        
        const miles = Number(trip.miles) || 0;
        lines.push(`• Miles (${miles}): <span class="text-slate-300">$${(miles * this.rates.mileRate).toFixed(2)}</span>`);

        if (trip.isPickupDone === 'yes' || trip.isPickupDone === true) {
            const isMB = String(trip.pCity || "").toUpperCase().includes('MB');
            const rate = isMB ? this.rates.mbPickRate : this.rates.pickRate;
            lines.push(`• Pickup (${isMB ? 'MB' : 'Std'}): <span class="text-slate-300">$${rate.toFixed(2)}</span>`);
        } else if (trip.isPickupDone === 'extra') {
            lines.push(`• Extra Pickup: <span class="text-slate-300">$${this.rates.extraPickRate.toFixed(2)}</span>`);
        }

        if (trip.isDeliveryDone === 'yes' || trip.isDeliveryDone === true) {
            const isMB = String(trip.dCity || "").toUpperCase().includes('MB');
            const rate = isMB ? this.rates.mbDropRate : this.rates.dropRate;
            lines.push(`• Delivery (${isMB ? 'MB' : 'Std'}): <span class="text-slate-300">$${rate.toFixed(2)}</span>`);
        } else if (trip.isDeliveryDone === 'extra') {
            lines.push(`• Extra Delivery: <span class="text-slate-300">$${this.rates.extraDropRate.toFixed(2)}</span>`);
        }

        if (trip.tarp && this.rates.tarpRates[trip.tarp]) {
            lines.push(`• Tarping (${trip.tarp}): <span class="text-slate-300">$${this.rates.tarpRates[trip.tarp].toFixed(2)}</span>`);
        }

        return lines.join('<div class="h-0.5"></div>');
    }
}

// Auto-init if running in browser
const PAY_MANAGER = new PayManager();
if (typeof firebase !== 'undefined') {
    PAY_MANAGER.init();
}