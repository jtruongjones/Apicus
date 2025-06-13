// make-roi-checker-extension/interceptor.js
(function() {
    console.log('[Apicus ROI Interceptor] Script execution started (page context). Timestamp:', Date.now());
    console.log('[Apicus ROI Interceptor] Script injected and running.');

    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const method = args[0] instanceof Request ? args[0].method : (args[1] && args[1].method ? args[1].method : 'GET');

        // Log a sample of fetch calls
        if (url.includes('/api/v2/scenarios/') || url.includes('blueprint')) { // Log all scenario API calls
            console.log('[Apicus ROI Interceptor] Saw potentially relevant fetch call. URL:', url, 'Method:', method.toUpperCase());
        } else if (Math.random() < 0.05) { // Log 5% of other calls to see if fetch is generally intercepted
            console.log('[Apicus ROI Interceptor] Saw other fetch call (sampled). URL:', url, 'Method:', method.toUpperCase());
        }

        // Regex to match the blueprint URL and capture scenarioId
        const blueprintUrlPattern = /api\/v2\/scenarios\/(\d+)\/blueprint/;
        const match = url.match(blueprintUrlPattern);

        if (match && method.toUpperCase() === 'GET') {
            const scenarioId = match[1];
            console.log(`[Apicus ROI Interceptor] Intercepted GET request to blueprint API for scenarioId: ${scenarioId}, URL: ${url}`);

            try {
                // Proceed with the original fetch request
                const response = await originalFetch.apply(this, args);

                if (response.ok) {
                    // Clone the response to allow its body to be read multiple times
                    // (once by us, once by the original Make.com consumer)
                    const clonedResponse = response.clone();

                    clonedResponse.json().then(data => {
                        if (data && data.blueprint) {
                            console.log('[Apicus ROI Interceptor] Blueprint data found. Posting to content script.');
                            // data.blueprint could be an object or a string. Content script will handle parsing if it's a string.
                            window.postMessage({
                                type: "APICUS_ROI_BLUEPRINT_DATA",
                                blueprintData: data.blueprint, // This is the scenario object / string
                                scenarioId: scenarioId
                            }, window.location.origin);
                        } else {
                            console.warn('[Apicus ROI Interceptor] Intercepted blueprint response, but "blueprint" field was missing or null.', data);
                        }
                    }).catch(e => {
                        console.error('[Apicus ROI Interceptor] Error processing JSON from cloned response:', e);
                    });
                } else {
                    console.warn(`[Apicus ROI Interceptor] Intercepted blueprint request failed with status: ${response.status}`, response);
                }

                // Return the original response to the original caller
                return response;

            } catch (error) {
                console.error('[Apicus ROI Interceptor] Error during fetch interception:', error);
                // In case of an error in our interception logic, try to return the original fetch behavior
                return originalFetch.apply(this, args);
            }
        }

        // For any other request, just use the original fetch
        return originalFetch.apply(this, args);
    };

    console.log('[Apicus ROI Interceptor] window.fetch has been wrapped.');
})();
