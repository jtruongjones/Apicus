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
// extracts module information, and logs it.
function processScenarioJson(jsonString) {
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
    } else {
      console.log("No modules were processed from the JSON.");
      alert("No modules found or processed from the JSON.");
    }

  } catch (error) {
    console.error("Error parsing JSON:", error);
    alert("Error parsing JSON: " + error.message + ". Please ensure it's valid JSON and check the console.");
  }
}
