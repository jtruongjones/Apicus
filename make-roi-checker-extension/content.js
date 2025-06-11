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
      try {
          const parsedJsonResponse = JSON.parse(aiResponseString);
          return parsedJsonResponse; // Return the parsed object
      } catch (parseError) {
          console.error("OpenAI API Error: Failed to parse AI's response as JSON.", parseError);
          console.error("AI's raw response string:", aiResponseString);
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

function initiateRoiAnalysis() {
  console.log("Apicus ROI Check: Analysis initiated.");

  // Step 1: Try to get info from the side panel (for a potentially selected module)
  const selectedModuleInfo = tryScrapeAuxiliaryInfo();
  if (selectedModuleInfo) {
    console.log("Information from selected module (side panel):", selectedModuleInfo);
    // We might display this to the user or use it, but for now, just log it.
  } else {
    console.log("No specific module information found in the side panel, or panel not open/selectors not matched.");
  }

  // Step 2: Always proceed to show the JSON input modal for full scenario analysis
  showJsonInputModal();
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

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.id = 'apicus-roi-json-input';
  textarea.style.width = 'calc(100% - 20px)'; // Account for padding
  textarea.style.height = '300px';
  textarea.style.marginBottom = '15px';
  textarea.style.border = '1px solid #ccc';
  textarea.style.borderRadius = '4px';
  textarea.style.padding = '10px';
  textarea.placeholder = 'Paste your exported scenario JSON here...';

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
    const jsonString = textarea.value;
    if (jsonString.trim()) {
      processScenarioJson(jsonString); // Call the processing function
      closeModal();
    } else {
      alert("Textarea is empty. Please paste your JSON.");
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
      document.body.removeChild(modal);
    }
  }

  // Assemble modal
  buttonContainer.appendChild(processButton);
  buttonContainer.appendChild(cancelButton);

  modalContent.appendChild(title);
  modalContent.appendChild(textarea);
  modalContent.appendChild(buttonContainer);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  textarea.focus(); // Focus the textarea when modal opens
  console.log("JSON input modal shown.");
}

// Parses the provided JSON string (expected to be a Make.com scenario export),
// extracts module information, and logs it. Also calls OpenAI for analysis.
async function processScenarioJson(jsonString) {
  console.log("Processing scenario JSON...");

  try {
    const scenarioData = JSON.parse(jsonString);

    // Validate the basic structure: scenarioData.flow should be an array of modules
    if (!scenarioData || !Array.isArray(scenarioData.flow)) {
      console.error("Invalid JSON structure: 'flow' array not found.", scenarioData);
      alert("Invalid JSON structure. Expected 'flow' to be an array of modules. Please check the console for more details.");
      return;
    }

    const modules = scenarioData.flow; // modules are directly in the 'flow' array
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
        console.log("OpenAI ROI Benchmark Response (Object):", roiBenchmarkObject); // Keep this log for debugging

        // Store data in chrome.storage.local and then open the new tab
        chrome.storage.local.set({ tempRoiData: roiBenchmarkObject }, function() {
          if (chrome.runtime.lastError) {
            console.error("Error saving tempRoiData to local storage:", chrome.runtime.lastError);
            alert("Error preparing data for display. Check console for details.");
            return;
          }

          // Successfully saved, now open the tab
          const displayPageUrl = chrome.runtime.getURL('display_roi.html');
          chrome.tabs.create({ url: displayPageUrl }, function(tab) {
              if (chrome.runtime.lastError) {
                  console.error("Error opening display tab:", chrome.runtime.lastError);
                  alert("Error opening display tab. Check console for details. ROI data is in the console.");
              } else {
                  console.log("Display tab opened:", tab);
                  alert("ROI Benchmark generated! Opening results in a new tab.");
              }
          });
        });

      } else {
        // This 'else' block for when roiBenchmarkObject is null (error already handled by getApicusRoiBenchmark)
        // can largely remain the same or be simplified, as getApicusRoiBenchmark already alerts on its own errors.
        // A simple log here is fine.
        console.log("processScenarioJson: roiBenchmarkObject was null, indicating a prior failure in getApicusRoiBenchmark.");
        // alert("Failed to get ROI Benchmark from OpenAI. Check console for errors."); // This might be redundant
      }
    } else {
      console.log("No modules were processed from the JSON.");
      alert("No modules found or processed from the JSON.");
    }

  } catch (error) {
    console.error("Error parsing JSON:", error);
    alert("Error parsing JSON: " + error.message + ". Please ensure it's valid JSON and check the console.");
  }
}
