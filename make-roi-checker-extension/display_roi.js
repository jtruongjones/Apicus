// display_roi.js
document.addEventListener('DOMContentLoaded', function () {
    const dataContainer = document.getElementById('roi-data-container');
    const errorMessageDiv = document.getElementById('error-message');

    chrome.storage.local.get(['tempRoiData'], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error retrieving tempRoiData:', chrome.runtime.lastError);
            errorMessageDiv.textContent = 'Error retrieving ROI data. Check console.';
            errorMessageDiv.style.display = 'block';
            dataContainer.style.display = 'none';
            return;
        }

        const roiData = result.tempRoiData;

        if (roiData) {
            console.log("ROI Data received in display_roi.js:", roiData);
            try {
                document.getElementById('automation_title_value').textContent = roiData.automation_title || 'N/A';
                document.getElementById('industry_value').textContent = roiData.industry || 'N/A';

                // Helper to format numbers or return 'N/A'
                const formatNumber = (num, decimals = 0) => (typeof num === 'number' ? num.toFixed(decimals) : 'N/A');
                const formatCurrency = (num) => (typeof num === 'number' ? `$${num.toFixed(2)}` : 'N/A');

                document.getElementById('estimated_runs_per_month_value').textContent = formatNumber(roiData.estimated_runs_per_month);
                document.getElementById('estimated_time_saved_minutes_value').textContent = formatNumber(roiData.estimated_time_saved_minutes);
                document.getElementById('task_value_multiplier_value').textContent = formatNumber(roiData.task_value_multiplier, 2); // Assuming V* can have decimals

                document.getElementById('estimated_risk_value_usd_value').textContent = formatCurrency(roiData.estimated_risk_value_usd);
                document.getElementById('estimated_revenue_uplift_usd_value').textContent = formatCurrency(roiData.estimated_revenue_uplift_usd);
                document.getElementById('estimated_monthly_cost_usd_value').textContent = formatCurrency(roiData.estimated_monthly_cost_usd);
                document.getElementById('calculated_roi_value').textContent = formatCurrency(roiData.calculated_roi);

                document.getElementById('notes_value').textContent = roiData.notes || 'No notes provided.';

                const flagsContainer = document.getElementById('flags_value_container');
                flagsContainer.innerHTML = ''; // Clear any existing
                if (Array.isArray(roiData.flags) && roiData.flags.length > 0) {
                    roiData.flags.forEach(flagText => {
                        const flagElement = document.createElement('span');
                        flagElement.className = 'flag';
                        flagElement.textContent = flagText;
                        flagsContainer.appendChild(flagElement);
                    });
                } else {
                    flagsContainer.textContent = 'N/A';
                }

                errorMessageDiv.style.display = 'none';
                dataContainer.style.display = 'block';

            } catch (e) {
                console.error("Error populating ROI data:", e);
                errorMessageDiv.textContent = 'Error displaying ROI data. Data might be malformed. Check console.';
                errorMessageDiv.style.display = 'block';
                dataContainer.style.display = 'none';
            } finally {
                // Clear the data from storage once used
                chrome.storage.local.remove('tempRoiData', function () {
                    if (chrome.runtime.lastError) {
                        console.error('Error removing tempRoiData:', chrome.runtime.lastError);
                    } else {
                        console.log('tempRoiData removed from storage.');
                    }
                });
            }
        } else {
            console.log('No tempRoiData found in storage.');
            errorMessageDiv.textContent = 'No ROI data found. This tab might have been opened directly or the data was already cleared.';
            errorMessageDiv.style.display = 'block';
            dataContainer.style.display = 'none';
        }
    });
});
