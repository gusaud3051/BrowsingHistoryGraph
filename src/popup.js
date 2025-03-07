// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Get view preference elements
  const viewTypeSelect = document.getElementById('view-type');
  const regexContainer = document.getElementById('regex-container');
  const regexPattern = document.getElementById('regex-pattern');

  // Get graph settings elements
  const graphSettingsToggle = document.getElementById('graph-settings-toggle');
  const graphViewControls = document.getElementById('graph-view-controls');
  const centerForceSlider = document.getElementById('center-force');
  const repelForceSlider = document.getElementById('repel-force');
  const linkForceSlider = document.getElementById('link-force');
  const linkDistanceSlider = document.getElementById('link-distance');

  // Get force value display elements
  const centerForceValue = document.getElementById('center-force-value');
  const repelForceValue = document.getElementById('repel-force-value');
  const linkForceValue = document.getElementById('link-force-value');
  const linkDistanceValue = document.getElementById('link-distance-value');

  let simulation; // Store the simulation so we can update it

  // Default view settings
  let viewSettings = {
    viewType: 'pageName', // Default to page name view
    regexPattern: '^.*?(?= -)'  // Default regex to extract content before " -"
  };

  // Default force settings
  let forceSettings = {
    centerForce: 0.95,
    repelForce: 0,
    linkForce: 1.0,
    linkDistance: 30
  };

  // Toggle graph settings panel
  graphSettingsToggle.addEventListener('click', () => {
    graphViewControls.style.display = graphViewControls.style.display === 'none' ? 'flex' : 'none';
  });

  // Toggle visibility of regex input based on view type
  viewTypeSelect.addEventListener('change', () => {
    if (viewTypeSelect.value === 'pageNameRegex') {
      regexContainer.style.display = 'block';
    } else {
      regexContainer.style.display = 'none';
    }

    // Save the view preference
    viewSettings.viewType = viewTypeSelect.value;
    browser.storage.local.set({ viewSettings: viewSettings });

    // Reload graph with new view setting
    reloadGraph();
  });

  // Update regex pattern when input changes
  regexPattern.addEventListener('input', () => {
    viewSettings.regexPattern = regexPattern.value;
    browser.storage.local.set({ viewSettings: viewSettings });

    // Reload graph with new regex pattern
    reloadGraph();
  });

  // Load the saved view settings
  browser.storage.local.get('viewSettings').then((result) => {
    if (result.viewSettings) {
      viewSettings = result.viewSettings;

      // Update UI with saved values
      viewTypeSelect.value = viewSettings.viewType;
      regexPattern.value = viewSettings.regexPattern || '';

      // Show/hide regex input based on view type
      regexContainer.style.display = viewSettings.viewType === 'pageNameRegex' ? 'block' : 'none';
    }
  });

  // Load the saved force settings
  browser.storage.local.get('forceSettings').then((result) => {
    if (result.forceSettings) {
      forceSettings = result.forceSettings;

      // Update sliders with saved values
      centerForceSlider.value = forceSettings.centerForce * 100;
      centerForceValue.textContent = `${Math.round(forceSettings.centerForce * 100)}%`;

      repelForceSlider.value = Math.min(100, Math.max(0, Math.abs(forceSettings.repelForce)));
      repelForceValue.textContent = `${repelForceSlider.value}%`;

      linkForceSlider.value = forceSettings.linkForce * 100;
      linkForceValue.textContent = `${Math.round(forceSettings.linkForce * 100)}%`;

      linkDistanceSlider.value = (forceSettings.linkDistance / 100) * 100;
      linkDistanceValue.textContent = `${Math.round((forceSettings.linkDistance / 100) * 100)}%`;
    }
  });

  // Force slider event handlers
  centerForceSlider.addEventListener('input', () => {
    const value = parseInt(centerForceSlider.value) / 100;
    centerForceValue.textContent = `${centerForceSlider.value}%`;
    forceSettings.centerForce = value;

    if (simulation) {
      // Update the center force strength instead of recreating it
      simulation.force('center').strength(value);
      simulation.alpha(0.3).restart();
    }

    saveForceSettings();
  });

  repelForceSlider.addEventListener('input', () => {
    const value = -parseInt(repelForceSlider.value) * 10; // Scale to appropriate range
    repelForceValue.textContent = `${repelForceSlider.value}%`;
    forceSettings.repelForce = value;

    if (simulation) {
      simulation.force('charge').strength(value);
      simulation.alpha(0.3).restart();
    }

    saveForceSettings();
  });

  linkForceSlider.addEventListener('input', () => {
    const value = parseInt(linkForceSlider.value) / 100;
    linkForceValue.textContent = `${linkForceSlider.value}%`;
    forceSettings.linkForce = value;

    if (simulation) {
      simulation.force('link').strength(value);
      simulation.alpha(0.3).restart();
    }

    saveForceSettings();
  });

  linkDistanceSlider.addEventListener('input', () => {
    const value = (parseInt(linkDistanceSlider.value) / 100) * 100; // Scale 0-100% to 0-100
    linkDistanceValue.textContent = `${linkDistanceSlider.value}%`;
    forceSettings.linkDistance = value;

    if (simulation) {
      simulation.force('link').distance(value);
      simulation.alpha(0.3).restart();
    }

    saveForceSettings();
  });

  function saveForceSettings() {
    browser.storage.local.set({ forceSettings: forceSettings });
  }

  // Function to reload graph with current settings
  function reloadGraph() {
    browser.storage.local.get('graphData').then((result) => {
      if (result.graphData && result.graphData.nodes && result.graphData.nodes.length > 0) {
        simulation = renderGraph(result.graphData, viewSettings, forceSettings);
      }
    });
  }

  // Load graph data from storage
  browser.storage.local.get('graphData').then((result) => {
    if (result.graphData && result.graphData.nodes && result.graphData.nodes.length > 0) {
      simulation = renderGraph(result.graphData, viewSettings, forceSettings);
      document.getElementById('config-message').style.display = 'none';
    } else {
      document.getElementById('graph-container').textContent = 'No browsing history data yet. Start browsing tracked sites!';
      document.getElementById('config-message').style.display = 'block';
    }
  });

  // Clear data button
  document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all graph data?')) {
      // Send message to background script to clear in-memory data as well
      browser.runtime.sendMessage({ action: 'clearGraphData' }).then(() => {
        // Clear from storage
        browser.storage.local.remove('graphData');
        document.getElementById('graph-container').textContent = 'Data cleared. Start browsing tracked sites!';
      }).catch(error => {
        console.error('Error clearing graph data:', error);
      });
    }
  });

  // Export data button
  document.getElementById('export-data').addEventListener('click', () => {
    browser.storage.local.get('graphData').then((result) => {
      if (result.graphData) {
        const dataStr = JSON.stringify(result.graphData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportLink = document.createElement('a');
        exportLink.setAttribute('href', dataUri);
        exportLink.setAttribute('download', 'browsing_history_graph.json');
        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);
      }
    });
  });

  // Open settings buttons
  function openSettings() {
    browser.runtime.openOptionsPage();
  }

  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('open-config').addEventListener('click', openSettings);
});

// Render graph with D3.js
function renderGraph(graphData, viewSettings = {
  viewType: 'pageName',
  regexPattern: '^.*?(?= -)'
}, forceSettings = {
  centerForce: 0.95,
  repelForce: -500,
  linkForce: 1.0,
  linkDistance: 30
}) {
  const container = document.getElementById('graph-container');
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Convert data format for D3
  const nodes = graphData.nodes.map(id => ({ id }));
  const links = graphData.edges.map(edge => ({
    source: edge.source,
    target: edge.target,
    timestamp: edge.timestamp,
    isRedirect: edge.isRedirect || false,
    isNewTab: edge.isNewTab || false
  }));

  // Create SVG with zoom support
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Add a main group for all elements that will be transformed together
  const g = svg.append("g");

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Function to center the viewport on nodes
  function centerViewport() {
    if (nodes.length === 0) return;

    // Calculate the bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    });

    // Calculate the center and dimensions of the node layout
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const dx = maxX - minX;
    const dy = maxY - minY;

    // Calculate appropriate scale to fit all nodes
    const scale = Math.min(
      0.8, // Maximum zoom out to 80%
      0.9 / Math.max(dx / width, dy / height)
    );

    // Create transform that centers the nodes
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    // Apply the transform with a transition
    svg.transition().duration(750)
      .call(zoom.transform, transform);
  }

  // Add button to center viewport
  svg.append("rect")
    .attr("x", 10)
    .attr("y", height - 40)
    .attr("width", 30)
    .attr("height", 30)
    .attr("rx", 5)
    .attr("fill", "#0060df")
    .attr("cursor", "pointer")
    .on("click", centerViewport);

  svg.append("text")
    .attr("x", 25)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "18px")
    .attr("pointer-events", "none")
    .text("⊕");

  // Create the graph simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => d.isRedirect ? forceSettings.linkDistance * 0.75 : forceSettings.linkDistance)
      .strength(d => d.isRedirect ? forceSettings.linkForce * 2 : forceSettings.linkForce)
    )
    .force('charge', d3.forceManyBody()
      .strength(forceSettings.repelForce)
    )
    .force("x", d3.forceX(width / 2))
    .force("y", d3.forceY(height / 2))
    // Use D3's built-in center force with strength parameter
    .force('center', d3.forceCenter(width / 2, height / 2).strength(forceSettings.centerForce))
    .alpha(0.3) // Initial alpha value
    .force('collision', d3.forceCollide()
      .radius(15) // Prevent node overlap
    );

  // Draw links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => d.isNewTab ? '#4a6b' : '#999') // Color new tab links differently
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', d => {
      // Count duplicate edges for line thickness
      const duplicates = links.filter(l =>
        l.source.id === d.source.id && l.target.id === d.target.id
      ).length;
      return Math.log(duplicates + 1) + 1;
    })
    .attr('stroke-dasharray', d => {
      if (d.isRedirect) return '5,5'; // Dashed for redirects
      if (d.isNewTab) return '10,3'; // Dotted for new tab navigations
      return 'none'; // Solid line for normal navigation
    });

  // Add arrowheads for direction
  g.append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 25) // Offset so the arrow doesn't overlap the target node
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#999');

  // Add a second marker for redirect arrows
  g.append('defs')
    .append('marker')
    .attr('id', 'arrow-redirect')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 25)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#999');
    
  // Add a third marker for new tab arrows
  g.append('defs')
    .append('marker')
    .attr('id', 'arrow-newtab')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 25)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#4a6b');

  // Apply the appropriate marker to each link
  link.attr('marker-end', d => {
    if (d.isRedirect) return 'url(#arrow-redirect)';
    if (d.isNewTab) return 'url(#arrow-newtab)';
    return 'url(#arrow)';
  });

  // Draw nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', 10)
    .attr('fill', d => {
      try {
        const hostname = d.id.split('/')[0];
        // Check if this is a tracked site
        let isTracked = false;
        try {
          isTracked = browser.extension.getBackgroundPage().isTrackedSite(hostname);
        } catch (e) {
          // Fallback if the background page is not accessible
          isTracked = false;
        }

        // Extract the base domain (e.g., "wikipedia.org" from "en.wikipedia.org")
        const domainParts = hostname.split('.');
        let baseDomain;

        // Handle domains with at least 2 parts
        if (domainParts.length >= 2) {
          // Get the last 2 parts at minimum (e.g., "wikipedia.org")
          baseDomain = domainParts.slice(-2).join('.');

          // Special case for country-specific TLDs (e.g., "co.uk")
          const knownCcTLDs = ['co.uk', 'com.au', 'co.jp', 'co.nz', 'co.za', 'com.br'];
          const lastThreeParts = domainParts.slice(-3).join('.');

          if (knownCcTLDs.some(ccTLD => lastThreeParts.endsWith(ccTLD))) {
            baseDomain = domainParts.slice(-3).join('.');
          }
        } else {
          baseDomain = hostname;
        }

        // Simple hash function for consistent coloring
        let hash = 0;
        for (let i = 0; i < baseDomain.length; i++) {
          hash = baseDomain.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);

        // Tracked sites get more saturated colors
        return isTracked ?
          `hsl(${hue}, 90%, 60%)` : // Bright, saturated for tracked sites
          `hsl(${hue}, 30%, 80%)`; // Lighter, less saturated for external sites
      } catch (e) {
        return '#ccc';
      }
    })
    .attr('stroke', d => {
      // Add border to tracked sites
      try {
        const hostname = d.id.split('/')[0];
        let isTracked = false;
        try {
          isTracked = browser.extension.getBackgroundPage().isTrackedSite(hostname);
        } catch (e) {
          isTracked = false;
        }
        return isTracked ?
          '#333' : // Dark border for tracked sites
          'none';  // No border for external sites
      } catch (e) {
        return 'none';
      }
    })
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer') // Add pointer cursor to indicate clickability
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', handleNodeClick); // Add click event handler

  // Add tooltips on hover with full information
  node.append('title')
    .text(d => {
      const pageTitle = graphData.pageTitles && graphData.pageTitles[d.id] ? graphData.pageTitles[d.id] : '';
      return `${d.id}\n${pageTitle}`;
    });

  // Add labels
  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('dx', 15)
    .attr('dy', '.35em')
    .text(d => {
      // Get node display text based on view type
      return getNodeLabelText(d, graphData, viewSettings);
    });

  // Function to get node label text based on view type
  function getNodeLabelText(node, graphData, viewSettings) {
    const pageTitle = graphData.pageTitles && graphData.pageTitles[node.id] ? graphData.pageTitles[node.id] : '';

    switch (viewSettings.viewType) {
      case 'url':
        // URL view - just display the URL/hostname
        try {
          const urlParts = node.id.split('/');
          const hostname = urlParts[0];
          const path = urlParts.slice(1).join('/');

          // Format path for display
          let displayPath = '';
          if (path) {
            // Truncate path if it's too long
            if (path.length > 20) {
              displayPath = '/' + path.substring(0, 17) + '...';
            } else {
              displayPath = '/' + path;
            }
          }

          return hostname + displayPath;
        } catch (e) {
          return node.id;
        }

      case 'pageName':
        // Page name view - show page title if available
        if (pageTitle) {
          return pageTitle.length > 25 ? pageTitle.substring(0, 22) + '...' : pageTitle;
        } else {
          // Fallback to URL if no page title
          try {
            const hostname = node.id.split('/')[0];
            return hostname;
          } catch (e) {
            return node.id;
          }
        }

      case 'pageNameRegex':
        // Page name + regex view
        if (pageTitle && viewSettings.regexPattern) {
          try {
            // Create regex from pattern
            const regex = new RegExp(viewSettings.regexPattern);
            const match = pageTitle.match(regex);

            if (match && match[0]) {
              // If we have a match, show page title with match highlighted
              // For simplicity, we'll just show the matched part
              return match[0];
            }
          } catch (e) {
            // If regex is invalid, just show the page title
            console.error('Invalid regex pattern:', e);
          }
        }

        // Fallback to standard page title display
        if (pageTitle) {
          return pageTitle.length > 25 ? pageTitle.substring(0, 22) + '...' : pageTitle;
        } else {
          // Fallback to URL if no page title
          try {
            const hostname = node.id.split('/')[0];
            return hostname;
          } catch (e) {
            return node.id;
          }
        }
    }
  }

  // Add legend (keep this outside the main g group so it doesn't zoom/pan)
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', 'translate(20, 20)');

  // Legend background
  legend.append('rect')
    .attr('width', 170)  // Width for legend
    .attr('height', 90)  // Increased height for new tab item
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('fill', 'white')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1);

  // Tracked sites legend item
  legend.append('circle')
    .attr('cx', 15)
    .attr('cy', 15)
    .attr('r', 6)
    .attr('fill', 'hsl(200, 90%, 60%)')
    .attr('stroke', '#333')
    .attr('stroke-width', 2);

  legend.append('text')
    .attr('x', 30)
    .attr('y', 19)
    .text('Tracked sites');

  // External sites legend item
  legend.append('circle')
    .attr('cx', 15)
    .attr('cy', 35)
    .attr('r', 6)
    .attr('fill', 'hsl(200, 30%, 80%)');

  legend.append('text')
    .attr('x', 30)
    .attr('y', 39)
    .text('External sites');

  // Redirect legend item
  legend.append('line')
    .attr('x1', 10)
    .attr('y1', 55)
    .attr('x2', 20)
    .attr('y2', 55)
    .attr('stroke', '#999')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,5');

  legend.append('text')
    .attr('x', 30)
    .attr('y', 59)
    .text('Redirect');
    
  // New tab legend item
  legend.append('line')
    .attr('x1', 10)
    .attr('y1', 75)
    .attr('x2', 20)
    .attr('y2', 75)
    .attr('stroke', '#4a6b')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '10,3');

  legend.append('text')
    .attr('x', 30)
    .attr('y', 79)
    .text('New tab');

  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });

  // Add an "Auto-center" button to the main controls
  const controlsDiv = document.querySelector('.main-controls');
  if (controlsDiv) {
    // Check if the button already exists to avoid duplicates
    if (!document.getElementById('center-viewport')) {
      const centerButton = document.createElement('button');
      centerButton.id = 'center-viewport';
      centerButton.textContent = 'Center Graph';
      centerButton.addEventListener('click', () => {
        // Wait for simulation to settle a bit before centering
        setTimeout(centerViewport, 100);
      });
      controlsDiv.appendChild(centerButton);
    }
  }

  // Auto-center on initial load (with slight delay to let simulation start)
  setTimeout(centerViewport, 300);

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Function to handle node click - open or switch to tab
  function handleNodeClick(event, d) {
    // Prevent the click from triggering a drag event
    if (event.defaultPrevented) return;
    
    // Get the full URL for this node
    const url = getFullUrlFromNodeId(d.id);
    if (!url) return;
    
    // First check if this URL is already open in a tab
    findAndSwitchToTab(url).then(tabFound => {
      // If no existing tab was found, open a new one
      if (!tabFound) {
        openNewTab(url);
      }
    }).catch(error => {
      console.error("Error handling node click:", error);
      // Fallback to just opening a new tab
      openNewTab(url);
    });
  }

  // Function to get a valid URL from node ID
  function getFullUrlFromNodeId(nodeId) {
    try {
      // NodeId is stored as hostname/path, convert to a valid URL
      const parts = nodeId.split('/');
      const hostname = parts[0];
      const path = parts.slice(1).join('/');
      
      // Add proper protocol
      return `https://${hostname}/${path}`;
    } catch (e) {
      console.error("Error creating URL from node ID:", e);
      return null;
    }
  }

  // Function to find existing tab with this URL and switch to it
  async function findAndSwitchToTab(url) {
    try {
      // Query for all tabs
      const tabs = await browser.tabs.query({});
      
      // Look for a tab with a matching URL
      for (const tab of tabs) {
        // Simple matching - could be enhanced for better URL comparison
        if (tab.url.includes(url)) {
          // Found a matching tab, switch to it
          await browser.tabs.update(tab.id, { active: true });
          // Also focus the window containing this tab
          await browser.windows.update(tab.windowId, { focused: true });
          return true;
        }
      }
      
      // No matching tab found
      return false;
    } catch (e) {
      console.error("Error finding existing tab:", e);
      return false;
    }
  }

  // Function to open a new tab with the specified URL
  async function openNewTab(url) {
    try {
      // Create a new tab with the URL
      await browser.tabs.create({ url: url });
      
      // Close the popup after creating the tab
      window.close();
      
      return true;
    } catch (e) {
      console.error("Error opening new tab:", e);
      return false;
    }
  }
  
  return simulation;
}