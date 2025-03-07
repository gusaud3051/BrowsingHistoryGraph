// Configuration - sites to track (will be loaded from storage)
let SITES_TO_TRACK = [
  "wikipedia.org"
];

// Store the graph data
let graphData = {
  nodes: new Set(),
  edges: [],
  pageTitles: {} // Store page titles by nodeId
};

// Previous page to track navigation source
let previousPages = {};

// Track redirections
let redirects = new Map(); // Maps redirect source to redirect target

// Function to expose functionality to other parts of the extension
function handleMessage(message, sender, sendResponse) {
  if (message.action === 'isTrackedSite') {
    return Promise.resolve({ result: isTrackedSite(message.url) });
  } else if (message.action === 'getSitesToTrack') {
    return Promise.resolve({ result: [...SITES_TO_TRACK] });
  } else if (message.action === 'settingsUpdated') {
    // Reload sites to track
    loadSitesToTrack();
    return Promise.resolve({ success: true });
  } else if (message.action === 'clearGraphData') {
    // Clear in-memory graph data
    graphData.nodes = new Set();
    graphData.edges = [];
    graphData.pageTitles = {};
    previousPages = {};
    redirects.clear();
    console.log('Graph data cleared');
    return Promise.resolve({ success: true });
  }
  return Promise.resolve(false);
}

// Set up message handler
browser.runtime.onMessage.addListener(handleMessage);

// Load sites to track from storage
function loadSitesToTrack() {
  browser.storage.local.get('sitesToTrack').then((result) => {
    if (result.sitesToTrack && Array.isArray(result.sitesToTrack)) {
      SITES_TO_TRACK = result.sitesToTrack;
      console.log('Loaded sites to track:', SITES_TO_TRACK);
    }
  }).catch((error) => {
    console.error('Error loading sites to track:', error);
  });
}

// Check if a URL belongs to a tracked site
function isTrackedSite(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    return SITES_TO_TRACK.some(site => {
      // Exact match
      if (hostname === site) {
        return true;
      }

      // Subdomain match (e.g., en.wikipedia.org matches wikipedia.org)
      if (hostname.endsWith('.' + site)) {
        return true;
      }

      // www version match (e.g., www.site.com matches site.com)
      if (site === hostname.replace(/^www\./, '')) {
        return true;
      }

      return false;
    });
  } catch (e) {
    // Fallback if URL parsing fails
    return SITES_TO_TRACK.some(site => url.includes(site));
  }
}

// Extract domain and path for node identification
function getNodeId(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch (e) {
    return url; // Fallback if URL parsing fails
  }
}

// Function to set up redirect listener if available
function setupRedirectListener() {
  try {
    if (browser.webNavigation.onBeforeRedirect) {
      browser.webNavigation.onBeforeRedirect.addListener((details) => {
        // Only track main frame navigation (not iframes)
        if (details.frameId !== 0) return;

        const sourceUrl = details.url;
        const targetUrl = details.redirectUrl;
        
        const sourceNodeId = getNodeId(sourceUrl);
        const targetNodeId = getNodeId(targetUrl);
        
        // Store the redirect relationship
        redirects.set(sourceNodeId, targetNodeId);
        
        // Add both nodes to the graph
        const sourceIsTracked = isTrackedSite(sourceUrl);
        const targetIsTracked = isTrackedSite(targetUrl);
        
        if (sourceIsTracked || targetIsTracked) {
          graphData.nodes.add(sourceNodeId);
          graphData.nodes.add(targetNodeId);

          // Add edge (direction: source -> target) with redirect flag
          graphData.edges.push({
            source: sourceNodeId,
            target: targetNodeId,
            timestamp: Date.now(),
            isRedirect: true
          });
          
          saveGraphData();
        }
      });
      console.log("Redirect listener set up successfully");
    } else {
      console.log("webNavigation.onBeforeRedirect event not available");
    }
  } catch (e) {
    console.error("Error setting up redirect listener:", e);
  }
}

// Alternative way to detect redirects
// Track timestamps to identify quick transitions that might be redirects
let navigationTimestamps = {};

// Listen for completed navigation
browser.webNavigation.onCompleted.addListener((details) => {
  // Only track main frame navigation (not iframes)
  if (details.frameId !== 0) return;

  const currentUrl = details.url;
  const tabId = details.tabId;
  const currentNodeId = getNodeId(currentUrl);

  // If we have a previous page for this tab, check if either current or previous is tracked
  if (previousPages[tabId]) {
    const previousNodeId = previousPages[tabId];
    const previousTimestamp = navigationTimestamps[tabId] || 0;
    const currentTimestamp = Date.now();
    const timeDiff = currentTimestamp - previousTimestamp;
    
    // Update the timestamp for this tab
    navigationTimestamps[tabId] = currentTimestamp;
    
    // Don't add edge if this was already tracked as a redirect
    const alreadyTrackedAsRedirect = redirects && redirects.has && 
                                    redirects.has(previousNodeId) && 
                                    redirects.get(previousNodeId) === currentNodeId;
    
    if (!alreadyTrackedAsRedirect) {
      const previousIsTracked = isTrackedSite(previousNodeId);
      const currentIsTracked = isTrackedSite(currentUrl);

      // Add edge if either the source or destination is a tracked site
      if (previousIsTracked || currentIsTracked) {
        graphData.nodes.add(previousNodeId);
        graphData.nodes.add(currentNodeId);
        
        // Check if this might be a redirect based on time difference
        // If navigation happened within 1 second, it's likely a redirect
        const isLikelyRedirect = timeDiff < 1000;
        
        // Add edge (direction: previous -> current)
        graphData.edges.push({
          source: previousNodeId,
          target: currentNodeId,
          timestamp: currentTimestamp,
          isRedirect: isLikelyRedirect
        });
        
        // If it's likely a redirect, add to our redirects Map
        if (isLikelyRedirect) {
          redirects.set(previousNodeId, currentNodeId);
        }

        // Get the page title for the current node
        browser.tabs.get(tabId).then(tab => {
          if (tab && tab.title) {
            graphData.pageTitles[currentNodeId] = tab.title;
            saveGraphData();
          }
        }).catch(error => {
          console.error("Error getting tab title:", error);
          saveGraphData();
        });
      }
    }
  }

  // Update previous page for this tab
  previousPages[tabId] = currentNodeId;
});

// Save graph data to browser storage
function saveGraphData() {
  browser.storage.local.set({
    graphData: {
      nodes: Array.from(graphData.nodes),
      edges: graphData.edges,
      pageTitles: graphData.pageTitles
    }
  });
}

// Load graph data from storage when extension starts
function loadGraphData() {
  browser.storage.local.get('graphData').then((result) => {
    if (result.graphData) {
      graphData.nodes = new Set(result.graphData.nodes);
      graphData.edges = result.graphData.edges;
      graphData.pageTitles = result.graphData.pageTitles || {};
    }
  });
}

// Initialize
loadGraphData();
loadSitesToTrack();
setupRedirectListener();