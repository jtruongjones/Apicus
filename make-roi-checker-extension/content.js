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
  button.textContent = 'Run ROI Check';

  // Styles are now in style.css

  document.body.appendChild(button);

  button.addEventListener('click', () => {
    console.log('Run ROI Check button clicked!');
    // Functionality to be added later
  });

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
