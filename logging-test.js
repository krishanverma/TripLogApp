/**
 * Integration Test: Entry Logging
 * Verifies that the logging process works correctly without affecting production files.
 */
const LOGGING_TEST = {
    async run() {
        console.log("%c Running Logging Integration Test... ", "background: #1e293b; color: #8b5cf6; font-weight: bold;");

        TEST_RUNNER.header("Cloud Integration");

        await TEST_RUNNER.assertAsync("INTEGRATION: Can log trip to 'test_trips.json'", async () => {
            // Pre-requisite: Check for credentials
            if (!APP.config.token || !APP.config.repo) {
                console.warn("Skipping real API test: No GitHub credentials found in localStorage.");
                return true; 
            }

            // Randomize inputs before submission
            const rand = () => Math.random().toString(36).substring(7).toUpperCase();
            const randomID = Math.floor(1000 + Math.random() * 9000);
            
            document.getElementById('order_number').value = `T-ORD-${randomID}`;
            document.getElementById('truck').value = `TRK-${randomID}`;
            document.getElementById('trailer').value = `TRL-${randomID}`;
            document.getElementById('pickup_city').value = `Test City A (${rand()})`;
            document.getElementById('delivery_city').value = `Test City B (${rand()})`;
            
            const tarps = ['None', 'Steel', 'Lumber'];
            document.querySelector(`input[name="tarp_type"][value="${tarps[randomID % 3]}"]`).checked = true;

            // Set temporary test filename to avoid affecting production data
            const originalFile = APP.dbFile;
            APP.dbFile = 'test_trips.json';

            // Mock alert to prevent blocking the test
            const originalAlert = window.alert;
            let alertMessage = "";
            window.alert = (msg) => { alertMessage = msg; };

            try {
                // Mock event object
                const mockEvent = { preventDefault: () => {} };
                
                // Execute the actual submission logic from app.js
                await APP.submit(mockEvent);

                // Verify results
                const success = alertMessage === "ENTRY LOGGED";
                
                // Cleanup
                APP.dbFile = originalFile;
                window.alert = originalAlert;
                
                return success;
            } catch (e) {
                APP.dbFile = originalFile;
                window.alert = originalAlert;
                throw e;
            }
        });
        
        TEST_RUNNER.updateSummary();
    }
};

setTimeout(() => LOGGING_TEST.run(), 1000);