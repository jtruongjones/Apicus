// options.js
const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');

// Load saved API key when options page opens
function loadApiKey() {
    chrome.storage.local.get(['openaiApiKey'], function(result) {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
            statusDiv.textContent = 'API Key loaded.';
             setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        } else {
            statusDiv.textContent = 'No API Key saved yet.';
             setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        }
    });
}

// Save API key
function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        chrome.storage.local.set({ 'openaiApiKey': apiKey }, function() {
            statusDiv.textContent = 'API Key saved successfully!';
            console.log('OpenAI API Key saved.');
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        });
    } else {
        statusDiv.textContent = 'API Key cannot be empty.';
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    }
}

saveButton.addEventListener('click', saveApiKey);
document.addEventListener('DOMContentLoaded', loadApiKey);
