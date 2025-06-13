// content.js

function injectButton() {
  // Check if the current URL is a Make.com scenario editor page.
  // We're looking for URLs that include '/scenarios/' followed by a number and then '/edit' or '/diagram'.
  // Example: https://eu1.make.com/0/scenarios/12345/edit
  // Example: https://eu1.make.com/0/scenarios/12345/diagram
  const scenarioPattern = /https?:\/\/[^/]+\/[^/]+\/scenarios\/\d+\/(edit|diagram)/;
  if (!scenarioPattern.test(window.location.href)) {
    console.log("Make.com ROI Checker: Not a scenario page. Button not injected.");
    return;
  }

  console.log("Make.com ROI Checker: Scenario page detected. Injecting button.");

  const button = document.createElement('button');
  button.id = 'make-roi-check-button';
  button.textContent = 'Apicus ROI Check';

  // Styles are now in style.css

  document.body.appendChild(button);

  button.addEventListener('click', initiateRoiAnalysis);

  console.log("Make.com ROI Checker: Button injected.");
}

// Run the injection function.
// Using a timeout to ensure the page is loaded, make.com can be a bit slow with its SPA nature.
// A more robust solution might use a MutationObserver or listen for specific Make.com events if available.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectButton, 2000));
} else {
    setTimeout(injectButton, 2000);
}

function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['openaiApiKey'], function(result) {
      if (chrome.runtime.lastError) {
        // Handle errors during storage access
        console.error('Error retrieving API key:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else if (result.openaiApiKey) {
        resolve(result.openaiApiKey);
      } else {
        // API key not found
        resolve(null); // Resolve with null if no key is found, let caller handle it
      }
    });
  });
}

async function fetchScenarioBlueprint(scenarioId) {
    const currentHost = window.location.host; // e.g., "us1.make.com"
    const apiUrl = `https://${currentHost}/api/v2/scenarios/${scenarioId}/blueprint`;

    console.log(`fetchScenarioBlueprint: Fetching from ${apiUrl}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json' // Standard header
                // Cookies should be sent automatically by the browser
            }
        });

        if (!response.ok) {
            console.error(`fetchScenarioBlueprint: API request failed with status ${response.status} - ${response.statusText}. URL: ${apiUrl}`);
            try {
                const errorData = await response.json();
                console.error("fetchScenarioBlueprint: API error response data:", errorData);
            } catch (e) {
                console.error("fetchScenarioBlueprint: Could not parse error response as JSON.");
            }
            return null;
        }

        const responseData = await response.json();
        console.log("fetchScenarioBlueprint: Received API response data:", responseData);

        if (!responseData || !responseData.blueprint) {
            console.error("fetchScenarioBlueprint: 'blueprint' field missing in API response.", responseData);
            return null;
        }

        let scenarioObject;
        if (typeof responseData.blueprint === 'string') {
            console.log("fetchScenarioBlueprint: Blueprint is a string, attempting to parse.");
            try {
                scenarioObject = JSON.parse(responseData.blueprint);
            } catch (e) {
                console.error("fetchScenarioBlueprint: Error parsing blueprint string as JSON:", e);
                console.error("Blueprint string that failed parsing:", responseData.blueprint);
                return null;
            }
        } else if (typeof responseData.blueprint === 'object' && responseData.blueprint !== null) {
            console.log("fetchScenarioBlueprint: Blueprint is already an object.");
            scenarioObject = responseData.blueprint;
        } else {
            console.error("fetchScenarioBlueprint: Blueprint field is not a string or a valid object.", responseData.blueprint);
            return null;
        }

        // At this point, scenarioObject should be the object that contains the 'flow' array,
        // e.g. { name: "Scenario Name", flow: [...], metadata: {...} }
        // We need to ensure it has the 'flow' array for downstream processing.
        if (!scenarioObject || !Array.isArray(scenarioObject.flow)) {
             console.error("fetchScenarioBlueprint: Parsed/obtained scenario object does not contain a 'flow' array.", scenarioObject);
             return null;
        }

        console.log("fetchScenarioBlueprint: Successfully fetched and processed blueprint:", scenarioObject);
        return scenarioObject; // This is the object like { name: "...", flow: [...] }

    } catch (error) {
        console.error(`fetchScenarioBlueprint: Network or other error during fetch: ${error.message}`, error);
        return null;
    }
}

async function getApicusRoiBenchmark(inputForOpenAI) {
  console.log("getApicusRoiBenchmark: Initiating call to OpenAI API...");

  let apiKey;
  try {
    apiKey = await getApiKey();
    if (!apiKey) {
      console.error("OpenAI API Key not found. Please set it in the extension options.");
      alert("OpenAI API Key not found. Please set it in the extension options (right-click the extension icon > Options).");
      return null;
    }
  } catch (error) {
    console.error("Error fetching API key for OpenAI:", error);
    alert("Error fetching API key. Check console for details.");
    return null;
  }

  const apiUrl = 'https://api.openai.com/v1/chat/completions';

  const hardcodedPrompt = `this is the hardcoded prompt -

You are an AI assistant trained on the Apicus ROI Framework (v0.1). You are generating synthetic ROI benchmarks for automation workflows.

Each input is a JSON object with:
- \`industry\`: the business context (e.g. "Marketing", "Legal")
- \`workflow\`: a JSON object that contains the automation title and nodes

You will output only a structured JSON object with ROI-relevant estimates.

---

APICUS ROI FORMULA:

ROI = ((T × H × V*) + R + U − C)

Where:
• T = Time saved per month (in hours)
• H = Hourly rate (always $30)
• V* = Task value multiplier
• R = Risk reduction value (USD)
• U = Revenue uplift (USD)
• C = Monthly cost of the automation

---

TASK VALUE MULTIPLIER (V*)

Step 1: Select a **Base V** from this table:

| Task Type               | Base V |
|------------------------|--------|
| Admin / Data Entry     | 1.0    |
| Internal Ops           | 1.2    |
| Compliance / Legal     | 1.4    |
| Customer Support       | 1.5    |
| Marketing              | 1.6    |
| Lead Generation        | 1.8    |
| Sales Enablement       | 2.0    |
| Strategic Revenue Ops  | 2.1+   |

Base V should be inferred from the workflow title, node types, and tools used.

Step 2: Add Business Stage Modifier
+0.1 (Always assume Small Team)

Step 3: Add Leverage Modifier based on reach per run:
- +0.0 = 1–2 people/systems
- +0.1 = 3–10
- +0.2 = 10+ or public-facing

→ Calculate V* = base + 0.1 + leverage
→ Cap at 2.0 **only if Revenue Uplift (U) is included**

---

REVENUE UPLIFT (U):
Include if the workflow supports monetization (e.g., outreach, booking, lead gen)
- Use 2% conversion rate
- $100 value per conversion
- Estimate monthly volume
→ U = volume × 0.02 × 100
→ If U is used, cap V* at 2.0

---

RISK VALUE (R):
Include only if automation prevents error, rework, or compliance issues.
Use:
→ R = risk level (1–5) × runs per month × $250

---

COST (C):
Estimate based on tools used (Zapier, Make, OpenAI, Slack, etc.)

---

FINAL CALCULATION:
Use all estimated values to compute:
**calculated_roi = ((T × H × V*) + R + U − C)**
→ Round to two decimal places

---

✅ OUTPUT FORMAT (STRICT, RAW JSON ONLY — NO MARKDOWN):

{
  "automation_title": "...",
  "industry": "...",
  "estimated_runs_per_month": ...,
  "estimated_time_saved_minutes": ...,
  "estimated_hourly_rate_usd": 30,
  "task_value_multiplier": ...,
  "estimated_risk_value_usd": ...,
  "estimated_revenue_uplift_usd": ...,
  "estimated_monthly_cost_usd": ...,
  "calculated_roi": ...,
  "notes": "...",
  "flags": ["synthetic", "benchmark", "v0.1"]
}

---

DO NOT include any explanation, headers, or formatting—only return one valid JSON object. do not include things like \`\`\`json

---

INPUT:
`; // Note: Input data will be appended here.

  const messages = [
    {
      role: "user",
      content: `${hardcodedPrompt}
${JSON.stringify(inputForOpenAI, null, 2)}`
    }
  ];

  const requestBody = {
    model: "gpt-4",
    messages: messages,
    // You can add other parameters like temperature, max_tokens if needed
    // temperature: 0.7,
    // max_tokens: 1000, // Increased max_tokens for potentially larger JSON output
  };

  console.log("getApicusRoiBenchmark: Sending request to OpenAI with body:", requestBody);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`OpenAI API Error: ${response.status} - ${errorData.message || errorData.error?.message}`, errorData);
      alert(`OpenAI API Error: ${response.status} - ${errorData.message || errorData.error?.message}. Check console for details.`);
      return null;
    }

    const responseData = await response.json();
    console.log("getApicusRoiBenchmark: Received response from OpenAI:", responseData);

    if (responseData.choices && responseData.choices.length > 0 && responseData.choices[0].message && responseData.choices[0].message.content) {
      const aiResponseString = responseData.choices[0].message.content.trim();

      let cleanedAiResponseString = aiResponseString;
      const firstBraceIndex = aiResponseString.indexOf('{');
      const lastBraceIndex = aiResponseString.lastIndexOf('}'); // Also find the last brace

      if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
        // Extract the substring from the first '{' to the last '}'
        cleanedAiResponseString = aiResponseString.substring(firstBraceIndex, lastBraceIndex + 1);
        if (cleanedAiResponseString !== aiResponseString) {
          console.log("getApicusRoiBenchmark: Cleaned AI response string. Original length:", aiResponseString.length, "Cleaned length:", cleanedAiResponseString.length);
          console.log("Original raw string snippet (first 50 chars):", aiResponseString.substring(0, 50));
          console.log("Cleaned string snippet (first 50 chars):", cleanedAiResponseString.substring(0, 50));
        }
      } else {
        // If no braces found, or they are in wrong order, the string is likely not the JSON we expect.
        // Log this, and the existing JSON.parse error handling will catch it.
        console.warn("getApicusRoiBenchmark: Could not find valid JSON structure (start/end braces) in AI's response. Attempting to parse original string anyway. Raw string:", aiResponseString);
      }

      // Now, use cleanedAiResponseString in the JSON.parse attempt:
      try {
          const parsedJsonResponse = JSON.parse(cleanedAiResponseString); // USE CLEANED STRING
          return parsedJsonResponse;
      } catch (parseError) {
          console.error("OpenAI API Error: Failed to parse AI's response as JSON.", parseError);
          // Log the string that failed to parse (it's now the cleaned one, or original if cleaning failed)
          console.error("AI's response string that failed parsing:", cleanedAiResponseString);
          alert("OpenAI API Error: Failed to parse the AI's response as JSON. Check console for details and the raw response.");
          return null;
      }
    } else {
      console.error("OpenAI API Error: Unexpected response structure.", responseData);
      alert("OpenAI API Error: Could not extract message content from the response. Check console for details.");
      return null;
    }

  } catch (error) {
    console.error("Error during OpenAI API call:", error);
    alert("An error occurred while communicating with the OpenAI API: " + error.message + ". Check console for details.");
    return null;
  }
}

async function initiateRoiAnalysis() {
  console.log("Apicus ROI Check: Analysis initiated.");

  // 1. Extract scenarioId from URL
  let scenarioId = null;
  const url = window.location.href;
  const scenarioMatch = url.match(/scenarios\/(\d+)\//); // Regex to find digits between "scenarios/" and "/"

  if (scenarioMatch && scenarioMatch[1]) {
      scenarioId = scenarioMatch[1];
      console.log("Found scenarioId:", scenarioId);
  } else {
      console.log("ScenarioId not found in URL:", url);
  }

  let scenarioObject = null;
  if (scenarioId) {
      alert("Attempting to fetch scenario data directly from Make.com API...");
      scenarioObject = await fetchScenarioBlueprint(scenarioId);
      if (scenarioObject) {
          console.log("Successfully fetched scenario blueprint via API.");
          // Alert that data was fetched and will be processed
          alert("Scenario data fetched successfully! Processing for ROI benchmark...");
      } else {
          console.warn("Failed to fetch scenario blueprint via API. Falling back to manual input.");
          alert("Could not fetch scenario data automatically. Please use the modal to provide the JSON.");
          // Fall through to showJsonInputModal below
      }
  } else {
      alert("Could not identify scenario ID from URL. Please use the modal to provide the JSON.");
      // Fall through to showJsonInputModal below
  }

  // 2. If scenarioObject was fetched, process it. Otherwise, show modal.
  if (scenarioObject) {
      // Pass the already parsed object to processScenarioJson
      await processScenarioJson(scenarioObject);
  } else {
      // Fallback to manual input if scenarioId not found OR if fetch failed
      console.log("Displaying JSON input modal for manual input.");
      showJsonInputModal(); // This function handles its own alerts internally for paste/upload
  }

  // Regarding tryScrapeAuxiliaryInfo():
  // This function was an attempt to get data from the side panel.
  // It can be removed or commented out if it's no longer deemed useful,
  // especially now that we have direct API access.
  // For now, let's remove it to simplify the flow.
  // const selectedModuleInfo = tryScrapeAuxiliaryInfo();
  // if (selectedModuleInfo) { /* ... */ }
}

// Scrapes auxiliary information from potential UI regions in the Make.com scenario editor.
// This is a broad-phase scrape; specific parsing of this text will come later if needed.
function tryScrapeAuxiliaryInfo() {
  console.log("Attempting to scrape auxiliary info from potential UI regions...");
  let foundTexts = [];

  // The main container for the scenario editor/inspector
  const diagramElement = document.getElementById('diagram');
  if (!diagramElement) {
    console.log("Diagram element (#diagram) not found.");
    return null;
  }

  // Define selectors for known high-level components and potential text containers
  // Based on user's HTML snippet and observations.
  const selectorsToSearch = [
    // Specific custom elements mentioned by user
    'imt-inspector-designer-cmp',
    'imt-inspector-scenario-queue-prompt',
    // General known wrapper components
    'imt-header',
    'imt-toolbar',
    // Generic text elements within #diagram that might be relevant
    // We can refine these later if specific panel selectors are identified
    '.i-inspector-designer [data-testid*="inspector"]', // Any inspector related test-ids
    '.c__scenarioHeader_1cq86_1', // Scenario header class from snippet
    // Add more selectors here if new areas are identified
  ];

  selectorsToSearch.forEach(selector => {
    const elements = diagramElement.querySelectorAll(selector);
    elements.forEach(el => {
      // Get text content, try to be a bit smart about hidden elements if possible,
      // but for now, primarily focus on textContent.
      // offsetParent check is a simple way to check for visibility.
      if (el.offsetParent !== null && el.textContent) {
        const text = el.textContent.trim();
        if (text) {
          foundTexts.push({
            selector: selector,
            text: text
          });
        }
      }
    });
  });

  if (foundTexts.length > 0) {
    console.log("Found potential texts in auxiliary UI regions:", foundTexts);
    // For now, return the array of found text objects.
    // Later, this might be processed to find specific module name, type, service.
    return foundTexts;
  } else {
    console.log("No text found in specified auxiliary UI regions.");
    return null;
  }
}

// Creates and displays a modal dialog for the user to paste their scenario JSON.
function showJsonInputModal() {
  console.log("Attempting to show JSON input modal...");

  // Prevent creating multiple modals
  if (document.getElementById('apicus-roi-json-modal')) {
    console.log("Modal already exists.");
    return;
  }

  let loadedJsonStringFromFile = null;

  // Modal container
  const modal = document.createElement('div');
  modal.id = 'apicus-roi-json-modal';
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.zIndex = '20000'; // Ensure it's on top
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  // Modal content box
  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = 'white';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '8px';
  modalContent.style.width = '600px';
  modalContent.style.maxWidth = '90%';
  modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Paste Make.com Scenario JSON';
  title.style.marginTop = '0';
  title.style.marginBottom = '15px';
  title.style.textAlign = 'center';

  // File Input Element
  const fileInputLabel = document.createElement('label');
  fileInputLabel.htmlFor = 'apicus-roi-json-file-input';
  fileInputLabel.textContent = 'Or Upload JSON File:';
  fileInputLabel.style.display = 'block';
  fileInputLabel.style.marginTop = '15px';
  fileInputLabel.style.marginBottom = '5px';
  fileInputLabel.style.fontWeight = 'bold';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'apicus-roi-json-file-input';
  fileInput.accept = '.json';
  fileInput.style.display = 'block';
  fileInput.style.marginBottom = '10px';

  // Textarea
  const textarea = document.createElement('textarea'); // Ensure textarea is defined here
  textarea.id = 'apicus-roi-json-input';
  textarea.style.width = 'calc(100% - 20px)'; // Account for padding
  textarea.style.height = '300px';
  textarea.style.marginBottom = '15px';
  textarea.style.border = '1px solid #ccc';
  textarea.style.borderRadius = '4px';
  textarea.style.padding = '10px';
  textarea.placeholder = 'Paste JSON here, or select a file above. File content will appear here.';

  fileInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (file) {
          // Check if the file type is JSON (basic check)
          if (file.type === "application/json" || file.name.endsWith(".json")) {
              const reader = new FileReader();

              reader.onload = function(e) {
                  loadedJsonStringFromFile = e.target.result;
                  textarea.value = `File loaded: ${file.name}\n\nContent will be processed. You can also clear selection and paste manually.`;
                  textarea.readOnly = true; // Make textarea read-only
                  console.log(`File "${file.name}" loaded successfully.`);
              };

              reader.onerror = function(e) {
                  console.error("Error reading file:", file.name, e);
                  alert(`Error reading file: ${file.name}. Please try again or paste content manually.`);
                  loadedJsonStringFromFile = null; // Reset
                  textarea.value = "Error reading file. Paste JSON here, or select a file above.";
                  textarea.readOnly = false; // Make textarea writable again
                  fileInput.value = ''; // Clear the file input
              };

              reader.readAsText(file);
          } else {
              alert("Invalid file type. Please select a .json file.");
              loadedJsonStringFromFile = null;
              textarea.value = "Invalid file type. Paste JSON here, or select a file above.";
              textarea.readOnly = false;
              fileInput.value = ''; // Clear the file input
          }
      } else {
          // No file selected (e.g., user cancelled file dialog)
          loadedJsonStringFromFile = null;
          textarea.value = "No file selected. Paste JSON here, or select a file above.";
          textarea.readOnly = false; // Make textarea writable
      }
  });

  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'flex-end';

  // Process Button
  const processButton = document.createElement('button');
  processButton.textContent = 'Process JSON';
  processButton.style.padding = '10px 20px';
  processButton.style.border = 'none';
  processButton.style.borderRadius = '4px';
  processButton.style.backgroundColor = '#007bff'; // Blue
  processButton.style.color = 'white';
  processButton.style.cursor = 'pointer';
  processButton.style.marginRight = '10px';

  processButton.addEventListener('click', () => {
    let jsonStringToProcess = null;

    if (loadedJsonStringFromFile) {
      jsonStringToProcess = loadedJsonStringFromFile;
      console.log("Processing JSON from loaded file.");
    } else if (textarea.value.trim()) {
      jsonStringToProcess = textarea.value.trim();
      console.log("Processing JSON from textarea.");
    }

    if (jsonStringToProcess) {
      processScenarioJson(jsonStringToProcess); // This is async, but we close modal immediately after call

      // Reset for next time modal opens (will also be done in closeModal for robustness)
      // loadedJsonStringFromFile = null; // This will be handled by closeModal
      // if(fileInput) fileInput.value = '';
      // textarea.value = '';
      // textarea.readOnly = false;

      closeModal(); // closeModal is already defined in showJsonInputModal
    } else {
      alert("No JSON data to process. Please select a file or paste JSON into the textarea.");
    }
  });

  // Cancel Button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.padding = '10px 20px';
  cancelButton.style.border = '1px solid #ccc';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.backgroundColor = '#f0f0f0';
  cancelButton.style.color = '#333';
  cancelButton.style.cursor = 'pointer';

  cancelButton.addEventListener('click', () => {
    closeModal();
  });

  // Function to close the modal
  function closeModal() {
    if (document.getElementById('apicus-roi-json-modal')) {
      document.body.removeChild(modal); // 'modal' is the overlay div
    }
    // Reset states
    loadedJsonStringFromFile = null;
    const fileInputForReset = document.getElementById('apicus-roi-json-file-input');
    if (fileInputForReset) {
        fileInputForReset.value = ''; // Clear file input
    }
    const textareaForReset = document.getElementById('apicus-roi-json-input');
    if (textareaForReset) {
        textareaForReset.value = ''; // Clear textarea
        textareaForReset.readOnly = false; // Ensure textarea is writable
    }
    console.log("Modal closed and input states reset.");
  }

  // Assemble modal
  buttonContainer.appendChild(processButton);
  buttonContainer.appendChild(cancelButton);

  modalContent.appendChild(title);
  // closeButton is already appended in showEmbeddedRoiModal, but this is showJsonInputModal
  // Assuming close button logic is handled or will be added if this modal needs one.
  // For now, following the structure from previous showJsonInputModal.
  modalContent.appendChild(fileInputLabel);
  modalContent.appendChild(fileInput);
  modalContent.appendChild(textarea);
  modalContent.appendChild(buttonContainer);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  textarea.focus(); // Focus the textarea when modal opens
  console.log("JSON input modal shown.");
}

// Parses the provided JSON input (string or object, expected to be a Make.com scenario export),
// extracts module information, and logs it. Also calls OpenAI for analysis.
async function processScenarioJson(inputData) { // Renamed parameter to inputData
    console.log("processScenarioJson: Received input, determining type...", typeof inputData);

    let scenarioData; // This will hold the parsed object

    if (typeof inputData === 'string') {
        console.log("processScenarioJson: Input is a string, attempting to parse.");
        try {
            scenarioData = JSON.parse(inputData);
        } catch (error) {
            console.error("processScenarioJson: Error parsing JSON string:", error);
            alert("Error parsing the provided JSON string: " + error.message + ". Please ensure it's valid JSON.");
            return; // Exit if string parsing fails
        }
    } else if (typeof inputData === 'object' && inputData !== null) {
        console.log("processScenarioJson: Input is already an object.");
        scenarioData = inputData; // Use the object directly
    } else {
        console.error("processScenarioJson: Invalid input data type. Expected string or object, got:", inputData);
        alert("Invalid data received for processing. Expected JSON string or object.");
        return; // Exit if input is neither string nor object
    }

    // At this point, scenarioData should be a valid JavaScript object.
    // The rest of the function continues from here, using 'scenarioData'.
    console.log("processScenarioJson: Validating scenarioData structure...", scenarioData);
    try {
        // Validate the basic structure (this was already in place, ensure it uses 'scenarioData')
        if (!scenarioData || !Array.isArray(scenarioData.flow)) { // Make sure this uses scenarioData
            console.error("Invalid scenario data structure: 'flow' array not found or not an array.", scenarioData);
            alert("Invalid scenario data structure. Expected a 'flow' array within the data. Please check the console for more details.");
            return;
        }

        const modules = scenarioData.flow; // This was already correct
        let extractedModulesInfo = [];

        console.log("Found " + modules.length + " modules in JSON.");

        modules.forEach(module => {
      const moduleInfo = {
        id: module.id,
        // Use metadata.designer.name if available for operationName, otherwise fallback to module.name
        operationName: (module.metadata && module.metadata.designer && module.metadata.designer.name) ? module.metadata.designer.name : module.name,
        fullType: module.module, // Use module.module for the full type
        parameters: module.parameters || {}, // Include parameters, default to empty object
        // Extract service from module.module (e.g., "gateway" from "gateway:CustomWebHook")
        service: module.module ? module.module.split(':')[0] : 'unknown'
      };
      extractedModulesInfo.push(moduleInfo);
    });

    if (extractedModulesInfo.length > 0) {
      console.log("Extracted Module Information:", extractedModulesInfo);
      // For a more readable console output, you can use console.table
      // if the data is relatively flat and consistent.
      if (console.table) {
        console.table(extractedModulesInfo);
      }
      alert("Successfully processed " + extractedModulesInfo.length + " modules! Check the console for details.");

      // Prompt for Industry
      const userProvidedIndustry = prompt("Please enter the industry for this workflow (e.g., Marketing, Legal, Healthcare):", "General");
      if (userProvidedIndustry === null) { // User clicked cancel
          console.log("User cancelled providing industry. Aborting OpenAI call.");
          alert("OpenAI call cancelled as industry was not provided.");
          return; // Exit if user cancels prompt
      }
      const industry = userProvidedIndustry.trim() || "General"; // Default if empty

      // Get Scenario Name
      const scenarioName = scenarioData.name || "Untitled Scenario";

      // Construct inputForOpenAI
      const inputForOpenAI = {
        industry: industry,
        workflow: {
          title: scenarioName,
          nodes: extractedModulesInfo // This is the array of module objects
        }
      };

      console.log("Calling getApicusRoiBenchmark with input:", inputForOpenAI);
      alert("Sending data to OpenAI for ROI Benchmark analysis. This may take a moment...");

      const roiBenchmarkObject = await getApicusRoiBenchmark(inputForOpenAI);

      if (roiBenchmarkObject) {
        console.log("OpenAI ROI Benchmark Response (Object):", roiBenchmarkObject); // Keep for debugging

        // Call the function to display the modal directly on the current page
        showEmbeddedRoiModal(roiBenchmarkObject);

        alert("ROI Benchmark results displayed on the page."); // Update alert

      } else {
        // This 'else' block (when roiBenchmarkObject is null) can remain as is.
        // It typically means an error was already handled and alerted by getApicusRoiBenchmark.
        console.log("processScenarioJson: roiBenchmarkObject was null, no modal to display.");
        // alert("Failed to get ROI Benchmark from OpenAI. Check console for errors."); // This alert might be redundant
      }
    } else {
      console.log("No modules were processed from the JSON.");
      alert("No modules found or processed from the JSON.");
    }

    } catch (error) { // This outer try-catch handles unexpected errors in the rest of the processing
        console.error("processScenarioJson: Error during processing of scenario data:", error);
        alert("An unexpected error occurred while processing the scenario data: " + error.message);
    }
}

function showEmbeddedRoiModal(roiData) {
    console.log("showEmbeddedRoiModal called with data:", roiData);

    const modalId = 'apicus-roi-modal-overlay';
    // Remove existing modal if any
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = modalId;
    // Styling for overlay will be in style.css, but basic properties can be set here
    // if needed, or rely entirely on CSS. For now, JS will set what's needed for behavior.

    // Create modal content box
    const modalContent = document.createElement('div');
    modalContent.className = 'apicus-roi-modal-content'; // For styling via style.css

    // Create title
    const titleElement = document.createElement('h2');
    titleElement.className = 'apicus-roi-modal-title';
    titleElement.textContent = 'Apicus ROI Benchmark';

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'apicus-roi-modal-close';
    closeButton.innerHTML = '&times;'; // '×' character
    closeButton.onclick = function() {
        overlay.remove();
    };

    // Helper function to create data rows
    function createDataRow(label, value, valueId, isCurrency = false, isBold = false) {
        const row = document.createElement('div');
        row.className = 'apicus-roi-data-row';

        const strong = document.createElement('strong');
        strong.textContent = label + ': ';
        row.appendChild(strong);

        const span = document.createElement('span');
        span.id = valueId ? `apicus-roi-${valueId}` : '';

        let displayValue = 'N/A';
        if (value !== undefined && value !== null) {
            if (isCurrency) {
                displayValue = typeof value === 'number' ? `$${value.toFixed(2)}` : String(value);
            } else {
                displayValue = typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : String(value);
            }
        }
        span.textContent = displayValue;

        if (isBold) {
            span.style.fontWeight = 'bold';
        }
        if (label === 'Calculated ROI (USD/month)') { // Special highlight for ROI
             row.classList.add('apicus-roi-highlight');
             span.classList.add('apicus-roi-highlight-value');
        }

        row.appendChild(span);
        return row;
    }

    // Populate modal content
    modalContent.appendChild(titleElement);
    modalContent.appendChild(closeButton);

    modalContent.appendChild(createDataRow('Automation Title', roiData.automation_title, 'automation_title_value'));
    modalContent.appendChild(createDataRow('Industry', roiData.industry, 'industry_value'));
    modalContent.appendChild(createDataRow('Estimated Runs per Month', roiData.estimated_runs_per_month, 'runs_value'));
    modalContent.appendChild(createDataRow('Estimated Time Saved (minutes/month)', roiData.estimated_time_saved_minutes, 'time_saved_value'));
    modalContent.appendChild(createDataRow('Task Value Multiplier (V*)', roiData.task_value_multiplier, 'v_star_value'));
    modalContent.appendChild(createDataRow('Estimated Risk Value (USD/month)', roiData.estimated_risk_value_usd, 'risk_value', true));
    modalContent.appendChild(createDataRow('Estimated Revenue Uplift (USD/month)', roiData.estimated_revenue_uplift_usd, 'revenue_uplift_value', true));
    modalContent.appendChild(createDataRow('Estimated Monthly Cost (USD)', roiData.estimated_monthly_cost_usd, 'monthly_cost_value', true));
    modalContent.appendChild(createDataRow('Calculated ROI (USD/month)', roiData.calculated_roi, 'calculated_roi_value', true, true));

    const notesDiv = document.createElement('div');
    notesDiv.className = 'apicus-roi-notes-container';
    const notesStrong = document.createElement('strong');
    notesStrong.textContent = 'Notes:';
    notesDiv.appendChild(notesStrong);
    const notesP = document.createElement('p');
    notesP.className = 'apicus-roi-notes-text';
    notesP.textContent = roiData.notes || 'No notes provided.';
    notesDiv.appendChild(notesP);
    modalContent.appendChild(notesDiv);

    const flagsDiv = document.createElement('div');
    flagsDiv.className = 'apicus-roi-flags-container';
    const flagsStrong = document.createElement('strong');
    flagsStrong.textContent = 'Flags: ';
    flagsDiv.appendChild(flagsStrong);
    const flagsSpan = document.createElement('span');
    if (Array.isArray(roiData.flags) && roiData.flags.length > 0) {
        flagsSpan.textContent = roiData.flags.join(', '); // Simple join for now, can be styled spans later
    } else {
        flagsSpan.textContent = 'N/A';
    }
    flagsDiv.appendChild(flagsSpan);
    modalContent.appendChild(flagsDiv);

    // Append modal content to overlay, then overlay to body
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    console.log("Embedded ROI modal displayed.");
}
