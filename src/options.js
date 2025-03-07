document.addEventListener('DOMContentLoaded', () => {
  const sitesTextarea = document.getElementById('sites-to-track');
  const saveButton = document.getElementById('save-button');
  const statusMessage = document.getElementById('status-message');
  
  // Load existing configuration
  loadSettings();
  
  // Save settings when button is clicked
  saveButton.addEventListener('click', saveSettings);
  
  function loadSettings() {
    browser.storage.local.get('sitesToTrack').then((result) => {
      if (result.sitesToTrack && Array.isArray(result.sitesToTrack)) {
        sitesTextarea.value = result.sitesToTrack.join('\n');
      } else {
        // Default sites
        sitesTextarea.value = 'wikipedia.org';
      }
    }).catch((error) => {
      console.error('Error loading settings:', error);
      showStatus('Error loading settings. Please try again.', 'error');
    });
  }
  
  function saveSettings() {
    // Get sites from textarea, split by newline, and trim whitespace
    const sites = sitesTextarea.value
      .split('\n')
      .map(site => site.trim())
      .filter(site => site.length > 0);
    
    // Save to storage
    browser.storage.local.set({
      sitesToTrack: sites
    }).then(() => {
      showStatus('Settings saved successfully!', 'success');
      
      // Notify the background script that settings have changed
      browser.runtime.sendMessage({ action: 'settingsUpdated' });
    }).catch((error) => {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings. Please try again.', 'error');
    });
  }
  
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status ' + type;
    statusMessage.style.display = 'block';
    
    // Hide message after 3 seconds
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
});