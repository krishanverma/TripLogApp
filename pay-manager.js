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
        // CASE 1: Local Work (Hourly)
        // If the trip is local, we return immediately to ensure long-haul rates aren't applied.
        if (trip.tripMode === 'local-work' || trip.order === 'LOCAL WORK') {
            const match = (trip.pCity || "").match(/([\d.]+)\s*hrs/i);
            const hours = match ? parseFloat(match[1]) : 0;
            return hours * this.rates.localRate;
        }

        // CASE 2: Long-Haul (Mileage + Stops + Tarping)
        let total = 0;

        // 1. Pay per mile
        total += (trip.miles || 0) * this.rates.mileRate;

        // 2. Pickup Logic (Standard, Manitoba, or Additional/Extra)
        if (trip.isPickupDone === 'yes' || trip.isPickupDone === true) {
            const isMB = (trip.pCity || "").toUpperCase().includes('MB');
            total += isMB ? this.rates.mbPickRate : this.rates.pickRate;
        } else if (trip.isPickupDone === 'extra') {
            total += this.rates.extraPickRate;
        }

        // 3. Delivery Logic (Standard, Manitoba, or Additional/Extra)
        if (trip.isDeliveryDone === 'yes' || trip.isDeliveryDone === true) {
            const isMB = (trip.dCity || "").toUpperCase().includes('MB');
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
}

// Auto-init if running in browser
const PAY_MANAGER = new PayManager();
if (typeof firebase !== 'undefined') {
    PAY_MANAGER.init();
}