// DOMS to Google Form Data Transfer Bookmarklet
// Version 2.0 - Enhanced with automation features
// Full Source Code (Unminified)

(function() {
  'use strict';
  
  // ========================================
  // GLOBAL STATE
  // ========================================
  
  let modal, isDragging = false, isCollapsed = false;
  let offsetX = 0, offsetY = 0;
  let currentLeadNumber = '';
  let leadDetectionTimeout = null;
  let leadMonitoringInterval = null;
  let userOverrodeLanguage = false; // Track if user manually changed language
  
  // ========================================
  // PART 1: DATA EXTRACTION FUNCTIONS
  // ========================================
  
  // Extract Lead Number from H1 tag
  function getLeadNumber() {
    const h1Elements = document.querySelectorAll('h1.MuiTypography-h1');
    for (let h1 of h1Elements) {
      const text = h1.textContent;
      if (text.includes('Lead #')) {
        // Extract everything after "Lead #"
        const match = text.match(/Lead #([A-Z0-9]+)/);
        if (match) return match[1];
      }
    }
    return '';
  }
  
  // Extract TID from "Assigned to" section (top right)
  function getTID() {
    const assignedToElements = document.querySelectorAll('.MuiTypography-subtitle1');
    for (let el of assignedToElements) {
      if (el.textContent === 'Assigned to') {
        const parent = el.closest('.MuiBox-root');
        if (parent) {
          const valueEl = parent.querySelector('.MuiTypography-h3');
          if (valueEl) return valueEl.textContent.trim();
        }
      }
    }
    return '';
  }
  
  // Helper function to find text content by label (supports multiple label variants)
  function getTextByLabel(...labelTexts) {
    const elements = document.querySelectorAll('.MuiTypography-body2');
    for (let el of elements) {
      const elText = el.textContent;
      // Check if any of the provided label texts match
      for (let labelText of labelTexts) {
        if (elText.includes(labelText)) {
          const parent = el.closest('.MuiBox-root');
          if (parent) {
            const valueEl = parent.querySelector('.MuiTypography-body1');
            if (valueEl) return valueEl.textContent.trim();
          }
        }
      }
    }
    return '';
  }
  
  // Clean phone number (remove +1 prefix, keep last 10 digits)
  function cleanPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    return digits.slice(-10);
  }
  
  // Extract received date from timeline
  function getReceivedDate() {
    const timelineItems = document.querySelectorAll('.MuiTimelineItem-root');
    for (let item of timelineItems) {
      const text = item.textContent;
      if (text.includes('New lead:')) {
        const dateEl = item.querySelector('.MuiTypography-caption');
        if (dateEl) {
          return parseDateString(dateEl.textContent.trim());
        }
      }
    }
    return null;
  }
  
  // Parse date string "Feb 05, 2026 11:04 am PST" to object
  function parseDateString(dateStr) {
    try {
      const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)\s+(\d+):(\d+)\s+(am|pm)/i);
      if (!match) return null;
      
      const months = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
      const month = months[match[1]];
      const day = parseInt(match[2]);
      const year = parseInt(match[3]);
      let hour = parseInt(match[4]);
      const minute = parseInt(match[5]);
      const ampm = match[6].toLowerCase();
      
      // Convert to 24-hour format
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      
      // FIX: Handle malformed data (24h format with PM/AM suffix like "13:02 pm")
      // If hour > 12, it's already in 24h format, convert back to 12h
      if (hour > 12) {
        hour = hour - 12; // 13 becomes 1, 14 becomes 2, etc.
      }
      
      return { year, month, day, hour, minute };
    } catch (e) {
      return null;
    }
  }
  
  // Extract all data from the page
  function extractSourceData() {
    return {
      leadNumber: getLeadNumber(),
      firstName: getTextByLabel('First name'),
      lastName: getTextByLabel('Last name'),
      email: getTextByLabel('Email address'),
      primaryPhone: cleanPhone(getTextByLabel('Primary phone number')),
      preferredPhone: cleanPhone(getTextByLabel('Numéro du contact principal', 'Preferred contact number (if different from above)')),
      verbatim: getTextByLabel('Pouvez-vous décrire le problème', 'Can you share your unresolved concern'),
      receivedDate: getReceivedDate(),
      confirmationEmail: getTextByLabel('Confirmation Email')
    };
  }
  
  // Helper function to build verbatim with agent note prepended
  function buildVerbatimWithAgentNote() {
    const agentNote = modal.querySelector('#agent-note');
    const agentNoteText = agentNote ? agentNote.value.trim() : '';
    const freshData = extractSourceData();
    const verbatim = freshData.verbatim || '';
    
    if (agentNoteText) {
      return `[NOTE FOR AGENT: ${agentNoteText}] ${verbatim}`;
    }
    return verbatim;
  }
  
  // ========================================
  // PART 2: MODAL UI CREATION
  // ========================================
  
  function createModal(data) {
    // Remove existing modal if present
    const existing = document.getElementById('doms-form-modal');
    if (existing) existing.remove();
    
    // Create modal container
    modal = document.createElement('div');
    modal.id = 'doms-form-modal';
    modal.innerHTML = `
      <div id="modal-header" style="cursor:move;background:#4285f4;color:white;padding:12px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>DOMS Submission Helper</strong><br>
          <span style="font-size:10px;font-weight:normal;">Created by: Brandon T</span>
        </div>
        <div>
          <button id="toggle-collapse" style="background:none;border:none;color:white;cursor:pointer;font-size:18px;margin-right:8px;">−</button>
          <button id="close-modal" style="background:none;border:none;color:white;cursor:pointer;font-size:18px;">×</button>
        </div>
      </div>
      <div id="modal-content" style="padding:16px;overflow-y:auto;">
        <div id="extracted-data-section" style="margin-bottom:12px;padding:8px;background:#f0f0f0;border-radius:4px;font-size:11px;border:2px solid #555;">
          <strong>Extracted Data:</strong>
          <div id="extracted-data-content" style="margin-top:4px;">Loading...</div>
        </div>
        
        <!-- Section #1: Two Columns (Left: BAN/Brand/Product, Right: Note for Agent) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <!-- Left Column -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label>
              <strong>BAN/CID *</strong><br>
              <input type="text" id="bancid" required maxlength="9" tabindex="1" style="width:calc(100% - 12px);padding:6px;">
            </label>
            <label>
              <strong>Brand *</strong><br>
              <select id="brand" required tabindex="2" style="width:100%;padding:6px;">
              <option value="">Choose...</option>
              <option>TELUS</option>
              <option>Koodo</option>
              <option>Public Mobile</option>
              <option>Subscription</option>
              <option>SHS Residential</option>
              <option>Custom Home</option>
              <option>Mascon By TELUS</option>
              <option>PC Mobile</option>
              <option>Commercial Security</option>
              <option>SMB Security</option>
            </select>
          </label>
            <label>
            <strong>Product/Service *</strong><br>
            <select id="product" required tabindex="3" style="width:100%;padding:6px;">
              <option value="">Choose...</option>
              <option>Postpaid</option>
              <option>Prepaid</option>
              <option>EPP</option>
              <option>Pure Fibre in CSR</option>
              <option>Copper in Compass</option>
              <option>Copper in CSR</option>
              <option>Offnet</option>
              <option>SmartHub</option>
              <option>Apple TV</option>
              <option>Discovery+</option>
              <option>Corp</option>
              <option>MMB</option>
              <option>SmartEnergy</option>
              <option>Telus Online Security (TOS)</option>
              <option>Xbox Game Pass Ultimate (XGPU)</option>
            </select>
          </label>
          </div>
          
          <!-- Right Column: Note for Agent (spans height of 3 left fields) -->
          <div style="display:flex;flex-direction:column;">
            <label style="flex:1;display:flex;flex-direction:column;">
              <strong>Note for Agent <span style="cursor:help;margin-left:4px;color:#666;" title="Type in here to add a note for an agent which will be added to the Verbatim">ℹ️</span></strong><br>
              <textarea id="agent-note" tabindex="7" style="flex:1;padding:6px;resize:none;font-family:Arial,sans-serif;border:1px solid #ccc;border-radius:4px;min-height:110px;"></textarea>
            </label>
          </div>
        </div>
        
        <!-- Section #2: Single Column Radio Buttons -->
        <label style="display:block;margin-bottom:8px;">
          <strong>LOB *</strong><br>
          <label><input type="radio" name="lob" value="Wireless" tabindex="4" required> Wireless</label>
          <label style="margin-left:12px;"><input type="radio" name="lob" value="Wireline"> Wireline</label>
        </label>
        
        <label style="display:block;margin-bottom:8px;">
          <strong>Customer Type *</strong><br>
          <label><input type="radio" name="custType" value="Consumer" tabindex="5" required> Consumer</label>
          <label style="margin-left:12px;"><input type="radio" name="custType" value="EPP"> EPP</label>
          <label style="margin-left:12px;"><input type="radio" name="custType" value="Business"> Business</label>
        </label>
        
        <label style="display:block;margin-bottom:16px;">
          <strong>Customer Language *</strong><br>
          <label><input type="radio" name="lang" value="EN" tabindex="6" required> EN</label>
          <label style="margin-left:12px;"><input type="radio" name="lang" value="FR"> FR</label>
        </label>
        
        <div style="display:flex;gap:6px;">
          <button id="reset-btn" tabindex="-1" style="flex:1;padding:8px;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;">Reset</button>
          <div style="flex:1;position:relative;display:flex;margin-right:12px;">
            <button id="generate-btn" disabled tabindex="8" style="flex:0 0 80%;padding:8px;background:#ccc;color:#666;border:none;border-radius:4px 0 0 4px;cursor:not-allowed;font-weight:bold;font-size:12px;">Submit</button>
            <button id="submit-dropdown-btn" disabled tabindex="-1" style="flex:0 0 20%;padding:8px;background:#ccc;color:#666;border:none;border-left:1px solid #999;border-radius:0 4px 4px 0;cursor:not-allowed;font-size:10px;">▼</button>
            <div id="submit-dropdown-menu" style="display:none;position:fixed;background:white;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:10000000;min-width:120px;">
              <div id="copy-url-option" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid #eee;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">Copy URL</div>
            </div>
          </div>
          <button id="next-case-btn" disabled tabindex="9" style="flex:1;padding:8px;background:#ccc;color:#666;border:none;border-radius:4px;cursor:not-allowed;font-weight:bold;font-size:12px;">Next</button>
        </div>
      </div>
    `;
    
    // Style the modal
    Object.assign(modal.style, {
      position: 'fixed',
      top: '75px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '420px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: '999999',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px'
    });
    
    document.body.appendChild(modal);
    
    // Add window resize listener to keep modal visible
    window.addEventListener('resize', () => {
      if (!modal) return;
      const rect = modal.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        modal.style.left = 'auto';
        modal.style.right = '10px';
        modal.style.transform = 'none';
      }
    });
    
    updateExtractedDataDisplay(data);
    setupModalEvents(data);
  }
  
  function formatDate(d) {
    return `${d.month}/${d.day}/${d.year} ${d.hour}:${String(d.minute).padStart(2,'0')}`;
  }
  
  // Helper function to truncate text
  function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  // Clipboard copy functions
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyNotification();
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }
  
  function showCopyNotification() {
    const notification = document.createElement('div');
    notification.innerHTML = '✓ Copied to clipboard!';
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#4caf50',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '4px',
      zIndex: '10000000',
      fontWeight: 'bold',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    });
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }
  
  // Create native copy button (clone from existing page buttons)
  function createCopyButton() {
    // Try to find an existing copy button to clone
    const existingCopyBtn = document.querySelector('[data-testid="copy"]');
    
    if (existingCopyBtn) {
      const clonedBtn = existingCopyBtn.cloneNode(true);
      clonedBtn.removeAttribute('data-testid');
      clonedBtn.removeAttribute('aria-label');
      clonedBtn.removeAttribute('title');
      clonedBtn.style.cssText = 'display:inline-flex;vertical-align:middle;margin-left:2px;padding:1px;font-size:9px;';
      return clonedBtn.outerHTML;
    }
    
    // Fallback: create MUI-styled copy button manually (smaller version)
    return `
      <button class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorPrimary MuiIconButton-sizeSmall" 
              style="display:inline-flex;vertical-align:middle;margin-left:2px;padding:1px;font-size:9px;"
              tabindex="-1" type="button">
        <span class="MuiIconButton-label" style="font-size:9px;">
          <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall" focusable="false" viewBox="0 0 24 24" style="width:14px;height:14px;">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4l6 6v10c0 1.1-.9 2-2 2H7.99C6.89 23 6 22.1 6 21l.01-14c0-1.1.89-2 1.99-2h7zm-1 7h5.5L14 6.5V12z"></path>
          </svg>
        </span>
      </button>
    `;
  }
  
  function updateExtractedDataDisplay(data) {
    const content = modal.querySelector('#extracted-data-content');
    if (!content) return;
    
    // Format in 2 columns as requested
    const dateDisplay = data.receivedDate ? formatDate(data.receivedDate) : 'N/A';
    const nameValue = `${data.firstName} ${data.lastName}`.trim();
    const nameDisplay = nameValue || 'N/A';
    const emailValue = data.email || '';
    const emailDisplay = emailValue || 'N/A';
    const phoneValue = data.primaryPhone || '';
    const phoneDisplay = phoneValue || 'N/A';
    const preferredValue = data.preferredPhone || '';
    const preferredDisplay = preferredValue || 'N/A';
    const verbatimTruncated = truncateText(data.verbatim, 100);
    const verbatimFull = data.verbatim || 'N/A';
    
    // Get native copy button HTML
    const clipIcon = createCopyButton();
    
    // Lead # display logic - show inline if present, otherwise show waiting message
    const leadSection = modal.querySelector('#extracted-data-section');
    if (leadSection) {
      const heading = leadSection.querySelector('strong');
      if (data.leadNumber) {
        heading.innerHTML = 'Extracted Data:';
        currentLeadNumber = data.leadNumber;
      } else {
        heading.innerHTML = 'Extracted Data: <span style="color:#ff9800;font-weight:normal;font-size:10px;" id="waiting-message">Waiting up to 60 seconds for the user to open a new lead...</span>';
      }
    }
    
    const leadDisplay = data.leadNumber || 'N/A';
    
    const html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
        <div><strong>Lead #:</strong> ${leadDisplay}</div>
        <div><strong>Date:</strong> ${dateDisplay}</div>
        <div><strong>Name:</strong> ${nameDisplay}${nameValue ? '<span class="copy-icon" data-copy="' + nameValue + '">' + clipIcon + '</span>' : ''}</div>
        <div><strong>Email:</strong> ${emailDisplay}${emailValue ? '<span class="copy-icon" data-copy="' + emailValue + '">' + clipIcon + '</span>' : ''}</div>
        <div><strong>Phone:</strong> ${phoneDisplay}${phoneValue ? '<span class="copy-icon" data-copy="' + phoneValue + '">' + clipIcon + '</span>' : ''}</div>
        <div><strong>Contact #:</strong> ${preferredDisplay}${preferredValue ? '<span class="copy-icon" data-copy="' + preferredValue + '">' + clipIcon + '</span>' : ''}</div>
        <div style="grid-column:1/-1;" id="verbatim-row">
          <strong>Verbatim:</strong> 
          <span id="verbatim-text">${verbatimTruncated}</span>
          ${verbatimTruncated ? '<span class="copy-icon" data-copy="' + data.verbatim.replace(/"/g, '&quot;') + '">' + clipIcon + '</span>' : ''}
          ${verbatimTruncated ? '<button id="translate-btn" class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorPrimary MuiIconButton-sizeSmall" style="display:inline-flex;vertical-align:middle;margin-left:4px;padding:3px;" title="Translate with Google" tabindex="-1" type="button"><span class="MuiIconButton-label">🌐</span></button>' : ''}
          ${verbatimTruncated ? '<span id="verbatim-expand-icon" tabindex="-1" style="cursor:pointer;margin-left:6px;color:#2196f3;font-size:18px;font-weight:bold;user-select:none;padding:4px 8px;background:#e3f2fd;border-radius:4px;transition:all 0.2s;" onmouseover="this.style.background=\'#bbdefb\'" onmouseout="this.style.background=\'#e3f2fd\'">▼</span>' : ''}
          <div id="verbatim-full" style="display:none;margin-top:8px;padding:8px;background:#f9f9f9;border-radius:4px;white-space:pre-wrap;max-height:150px;overflow-y:auto;border:1px solid #ddd;">${verbatimFull}</div>
        </div>
      </div>
    `;
    
    content.innerHTML = html;
    
    // Add click handlers to copy icons
    content.querySelectorAll('.copy-icon').forEach(icon => {
      icon.onclick = () => {
        const textToCopy = icon.getAttribute('data-copy');
        copyToClipboard(textToCopy);
      };
    });
    
    // Setup translate button
    setupTranslateButton(data);
    
    // Add click handler for verbatim expand/collapse
    const expandIcon = content.querySelector('#verbatim-expand-icon');
    if (expandIcon) {
      expandIcon.onclick = () => {
        const fullDiv = content.querySelector('#verbatim-full');
        const textSpan = content.querySelector('#verbatim-text');
        const icon = content.querySelector('#verbatim-expand-icon');
        
        if (fullDiv.style.display === 'none') {
          // Expand
          fullDiv.style.display = 'block';
          textSpan.style.display = 'none';
          icon.textContent = '▲';
        } else {
          // Collapse
          fullDiv.style.display = 'none';
          textSpan.style.display = 'inline';
          icon.textContent = '▼';
        }
      };
    }
  }
  
  // Setup translate button for verbatim
  function setupTranslateButton(data) {
    const translateBtn = modal.querySelector('#translate-btn');
    if (!translateBtn) return;
    
    translateBtn.onclick = () => {
      const verbatim = data.verbatim || '';
      if (!verbatim || verbatim === 'N/A') return;
      
      // Detect source language from confirmationEmail
      const confirmEmail = (data.confirmationEmail || '').toLowerCase();
      const sourceLang = confirmEmail.includes('fr') ? 'fr' : 'auto';
      const targetLang = confirmEmail.includes('fr') ? 'en' : 'fr';
      
      // Build Google Translate URL
      const translateURL = `https://translate.google.com/?sl=${sourceLang}&tl=${targetLang}&text=${encodeURIComponent(verbatim)}&op=translate`;
      
      // Open in popup window
      window.open(translateURL, 'GoogleTranslate', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      console.log('[Translate] Opened Google Translate popup');
    };
  }
  
  // ========================================
  // PART 3: RESET & EXTRACT FUNCTIONS
  // ========================================
  
  function resetModal() {
    // Clear manual input fields
    modal.querySelectorAll('input[name="lob"]').forEach(r => r.checked = false);
    modal.querySelector('#brand').value = '';
    modal.querySelectorAll('input[name="custType"]').forEach(r => r.checked = false);
    modal.querySelector('#product').value = '';
    modal.querySelectorAll('input[name="lang"]').forEach(r => r.checked = false);
    modal.querySelector('#bancid').value = '';
    
    // Clear agent note field
    const agentNote = modal.querySelector('#agent-note');
    if (agentNote) agentNote.value = '';
    
    // Clear extracted data display
    const emptyData = {
      leadNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      primaryPhone: '',
      preferredPhone: '',
      verbatim: '',
      receivedDate: null
    };
    updateExtractedDataDisplay(emptyData);
    currentLeadNumber = '';
    
    // DO NOT clear TID - it persists
    // Reset language override flag when resetting
    userOverrodeLanguage = false;
    
    // Trigger validation update
    validateForm();
  }
  
  function extractAndUpdate() {
    // First reset (clears everything except TID)
    resetModal();
    
    // Then extract fresh data
    const freshData = extractSourceData();
    updateExtractedDataDisplay(freshData);
    
    // Auto-set customer language based on Confirmation Email
    autoSetLanguage(freshData);
    
    // Start lead detection if no lead number found
    if (!freshData.leadNumber) {
      startLeadDetection();
    }
  }
  
  // ========================================
  // PART 4: LEAD DETECTION & MONITORING
  // ========================================
  
  function startLeadDetection() {
    if (leadDetectionTimeout) clearTimeout(leadDetectionTimeout);
    
    const startTime = Date.now();
    const maxWaitTime = 60000; // 60 seconds
    
    const checkForLead = () => {
      const leadNum = getLeadNumber();
      
      if (leadNum && leadNum !== currentLeadNumber) {
        // New lead found!
        const freshData = extractSourceData();
        updateExtractedDataDisplay(freshData);
        currentLeadNumber = leadNum;
        return;
      }
      
      // Check if timeout reached
      if (Date.now() - startTime >= maxWaitTime) {
        // Timeout - update message by finding the specific waiting message element
        const waitingMsg = modal.querySelector('#waiting-message');
        if (waitingMsg) {
          waitingMsg.style.color = '#f44336';
          waitingMsg.textContent = 'Auto-detect new lead has timed out. Data will refresh when you open a new lead.';
        }
        return;
      }
      
      // Continue checking
      leadDetectionTimeout = setTimeout(checkForLead, 1000);
    };
    
    checkForLead();
  }
  
  // Start continuous monitoring for lead changes
  function startContinuousLeadMonitoring() {
    // Clear any existing monitoring interval
    if (leadMonitoringInterval) clearInterval(leadMonitoringInterval);
    
    // Check every 3 seconds for lead changes
    leadMonitoringInterval = setInterval(() => {
      const currentPageLead = getLeadNumber();
      
      // If lead number changed, auto-refresh data
      if (currentPageLead && currentPageLead !== currentLeadNumber) {
        console.log(`Lead changed detected: ${currentLeadNumber} → ${currentPageLead}`);
        expandModal(); // FIX: Expand modal when new lead detected
        extractAndUpdate();
        
        // Disable Next button when new lead is detected
        disableNextButton();
      }
      
      // Check if "Change Status" button is available and disable Next button if not
      if (!isChangeStatusButtonAvailable()) {
        disableNextButton();
      }
    }, 3000);
  }
  
  // Stop continuous monitoring (called when modal is closed)
  function stopContinuousLeadMonitoring() {
    if (leadMonitoringInterval) {
      clearInterval(leadMonitoringInterval);
      leadMonitoringInterval = null;
    }
  }
  
  // ========================================
  // PART 5: NEXT CASE AUTOMATION
  // ========================================
  
  // Helper functions to enable/disable Next button
  function enableNextButton() {
    const nextBtn = modal.querySelector('#next-case-btn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.background = '#4caf50';
      nextBtn.style.color = 'white';
      nextBtn.style.cursor = 'pointer';
    }
  }
  
  function disableNextButton() {
    const nextBtn = modal.querySelector('#next-case-btn');
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.style.background = '#ccc';
      nextBtn.style.color = '#666';
      nextBtn.style.cursor = 'not-allowed';
    }
  }
  
  
  // Check if "Change Status" button is visible/enabled on DOMS page
  function isChangeStatusButtonAvailable() {
    const changeStatusBtn = document.querySelector('button .MuiButton-label svg path[d*="M17 3H5c-1.11"]')?.closest('button');
    if (!changeStatusBtn) return false;
    
    // Check if button is visible and not disabled
    const isVisible = changeStatusBtn.offsetParent !== null;
    const isDisabled = changeStatusBtn.disabled;
    
    return isVisible && !isDisabled;
  }
  
  // Helper function to set React-controlled field values
  function setReactField(selector, value, fieldName) {
    const input = document.querySelector(selector);
    if (!input) {
      console.error(`[Next Case] ✗ Field not found: ${selector}`);
      return false;
    }
    
    const reactKey = Object.keys(input).find(key => key.startsWith('__reactProps'));
    if (!reactKey) {
      console.error(`[Next Case] ✗ React props not found for: ${selector}`);
      return false;
    }
    
    const reactProps = input[reactKey];
    if (reactProps && reactProps.onChange) {
      // Set value directly for text inputs
      if (input.type === 'text') {
        input.value = value;
      }
      
      // Trigger onChange
      const fakeEvent = {
        target: { value: value, name: input.name },
        currentTarget: { value: value, name: input.name }
      };
      reactProps.onChange(fakeEvent);
      
      // Dispatch input event for text fields
      if (input.type === 'text') {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      console.log(`[Next Case] ✓ ${fieldName} set to: ${value}`);
      return true;
    }
    return false;
  }
  
  async function handleNextCase() {
    try {
      console.log('[Next Case] Starting automation...');
      
      // Step 1: Reset and collapse modal
      resetModal();
      collapseModal();
      moveModalToTopRight();
      console.log('[Next Case] Modal reset and collapsed');
      
      // Step 2: Click "Change Status" button
      const changeStatusBtn = document.querySelector('button .MuiButton-label svg path[d*="M17 3H5c-1.11"]')?.closest('button');
      if (!changeStatusBtn) {
        alert('Could not find "Change Status" button. Please click it manually.');
        return;
      }
      
      changeStatusBtn.click();
      console.log('[Next Case] Change Status button clicked');
      
      // Step 3: Wait for status modal to appear
      await waitForElement('.MuiDialog-paper[role="dialog"]', 5000);
      console.log('[Next Case] Status modal appeared');
      await sleep(500); // Wait for modal to render
      
      // Step 4: Set "Change status to" = "Completed" using React
      console.log('[Next Case] Setting status to COMPLETED...');
      setReactField('input[name="status"]', 'COMPLETED', 'Status');
      
      // Step 5: Wait for dependent fields to appear, then set System updated in
      await sleep(500); // Wait for other fields to appear
      console.log('[Next Case] Setting System updated in to None...');
      setReactField('input[name="updatedSystem"]', 'None', 'System Updated In');
      
      // Step 6: Fill External system order ID with TID
      await sleep(300);
      const tid = getTID();
      console.log('[Next Case] Filling TID:', tid);
      setReactField('input[name="externalSystemOrderID"]', tid, 'External Order ID');
      
      console.log('[Next Case] Automation complete. Waiting for user to submit...');
      
      // Step 7: Wait for user to submit, then monitor for new lead
      monitorForNewLead();
      
    } catch (error) {
      console.error('[Next Case] Automation error:', error);
      alert('Next Case automation encountered an error. Check console for details.');
    }
  }
  
  function monitorForNewLead() {
    const originalLead = currentLeadNumber;
    const startTime = Date.now();
    const maxWaitTime = 60000; // 60 seconds
    
    const checkInterval = setInterval(() => {
      const newLead = getLeadNumber();
      
      if (newLead && newLead !== originalLead) {
        // New lead detected!
        clearInterval(checkInterval);
        expandModal();
        extractAndUpdate();
      } else if (Date.now() - startTime >= maxWaitTime) {
        // Timeout
        clearInterval(checkInterval);
        expandModal();
        const content = modal.querySelector('#extracted-data-content');
        if (content) {
          content.innerHTML = '<span style="color:#f44336;">Auto-detect new lead has timed out. Please click Extract Data when you have a new lead open.</span>';
        }
      }
    }, 1000);
  }
  
  function collapseModal() {
    isCollapsed = true;
    const content = modal.querySelector('#modal-content');
    const toggleBtn = modal.querySelector('#toggle-collapse');
    if (content) content.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '+';
  }
  
  function expandModal() {
    isCollapsed = false;
    const content = modal.querySelector('#modal-content');
    const toggleBtn = modal.querySelector('#toggle-collapse');
    if (content) content.style.display = 'block';
    if (toggleBtn) toggleBtn.textContent = '−';
  }
  
  function moveModalToTopRight() {
    modal.style.top = '75px';
    modal.style.right = '10px';
    modal.style.left = 'auto';
    modal.style.transform = 'none';
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime >= timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  }
  
  // ========================================
  // PART 6: EVENT HANDLERS & VALIDATION
  // ========================================
  
  function validateForm() {
    const lob = modal.querySelector('input[name="lob"]:checked');
    const brand = modal.querySelector('#brand').value;
    const custType = modal.querySelector('input[name="custType"]:checked');
    const product = modal.querySelector('#product').value;
    const lang = modal.querySelector('input[name="lang"]:checked');
    const bancid = modal.querySelector('#bancid').value.trim();
    
    const isValid = lob && brand && custType && product && lang && bancid.length >= 1 && bancid.length <= 9;
    
    const generateBtn = modal.querySelector('#generate-btn');
    const dropdownBtn = modal.querySelector('#submit-dropdown-btn');
    
    generateBtn.disabled = !isValid;
    dropdownBtn.disabled = !isValid;
    
    if (isValid) {
      generateBtn.style.background = '#4285f4';
      generateBtn.style.color = 'white';
      generateBtn.style.cursor = 'pointer';
      dropdownBtn.style.background = '#4285f4';
      dropdownBtn.style.color = 'white';
      dropdownBtn.style.cursor = 'pointer';
    } else {
      generateBtn.style.background = '#ccc';
      generateBtn.style.color = '#666';
      generateBtn.style.cursor = 'not-allowed';
      dropdownBtn.style.background = '#ccc';
      dropdownBtn.style.color = '#666';
      dropdownBtn.style.cursor = 'not-allowed';
    }
  }
  
  function setupModalEvents(data) {
    const header = modal.querySelector('#modal-header');
    const closeBtn = modal.querySelector('#close-modal');
    const toggleBtn = modal.querySelector('#toggle-collapse');
    const content = modal.querySelector('#modal-content');
    const generateBtn = modal.querySelector('#generate-btn');
    const resetBtn = modal.querySelector('#reset-btn');
    const nextCaseBtn = modal.querySelector('#next-case-btn');
    const dropdownBtn = modal.querySelector('#submit-dropdown-btn');
    const dropdownMenu = modal.querySelector('#submit-dropdown-menu');
    const copyUrlOption = modal.querySelector('#copy-url-option');
    
    // Dropdown toggle
    dropdownBtn.onclick = (e) => {
      e.stopPropagation();
      if (!dropdownBtn.disabled) {
        if (dropdownMenu.style.display === 'none') {
          // Position dropdown below button
          const rect = dropdownBtn.getBoundingClientRect();
          dropdownMenu.style.top = (rect.bottom + 2) + 'px';
          dropdownMenu.style.left = (rect.right - 120) + 'px'; // Align to right edge
          dropdownMenu.style.display = 'block';
        } else {
          dropdownMenu.style.display = 'none';
        }
      }
    };
    
    // Copy URL option click
    copyUrlOption.onclick = () => {
      // CRITICAL FIX: Extract fresh data from current page, not stale closure data
      const freshData = extractSourceData();
      
      // Generate URL without opening it
      const lob = modal.querySelector('input[name="lob"]:checked').value;
      const brand = modal.querySelector('#brand').value;
      const custType = modal.querySelector('input[name="custType"]:checked').value;
      const product = modal.querySelector('#product').value;
      const lang = modal.querySelector('input[name="lang"]:checked').value;
      const bancid = modal.querySelector('#bancid').value.trim();
      const fullName = `${freshData.firstName} ${freshData.lastName}`.trim();
      
      const baseURL = 'https://docs.google.com/forms/d/e/1FAIpQLSfJ0AQaptO3wIaa09kJhHGULvApaiAdQRnTJzCq7CzwmP3SKw/viewform';
      const params = new URLSearchParams();
      
      if (freshData.receivedDate) {
        params.append('entry.1882987299_year', freshData.receivedDate.year);
        params.append('entry.1882987299_month', freshData.receivedDate.month);
        params.append('entry.1882987299_day', freshData.receivedDate.day);
        params.append('entry.1882987299_hour', freshData.receivedDate.hour);
        params.append('entry.1882987299_minute', freshData.receivedDate.minute);
      }
      
      params.append('entry.506082014', lob);
      params.append('entry.104012616', brand);
      params.append('entry.1228494129', custType);
      params.append('entry.1098890156', product);
      params.append('entry.500460836', lang);
      params.append('entry.615216667', bancid);
      
      if (fullName) params.append('entry.1133516513', fullName);
      if (freshData.primaryPhone) params.append('entry.504696174', freshData.primaryPhone);
      if (freshData.preferredPhone) params.append('entry.1161771354', freshData.preferredPhone);
      
      // Use verbatim with agent note prepended
      const verbatimWithNote = buildVerbatimWithAgentNote();
      if (verbatimWithNote) params.append('entry.961402602', verbatimWithNote);
      
      const finalURL = `${baseURL}?${params.toString()}`;
      
      // Copy to clipboard and log
      copyToClipboard(finalURL);
      console.log('=== FORM URL COPIED ===');
      console.log('URL Length:', finalURL.length);
      console.log('URL:', finalURL);
      console.log('\nParameters:');
      console.log('- Verbatim length:', freshData.verbatim?.length || 0, 'characters');
      
      // Close dropdown
      dropdownMenu.style.display = 'none';
      
      // Enable Next button after copying URL
      enableNextButton();
    };
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (dropdownMenu && !dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = 'none';
      }
    });
    
    // Close button
    closeBtn.onclick = () => {
      stopContinuousLeadMonitoring();
      modal.remove();
    };
    
    // Collapse/Expand button
    toggleBtn.onclick = () => {
      if (isCollapsed) {
        expandModal();
      } else {
        collapseModal();
      }
    };
    
    // Drag functionality
    header.onmousedown = (e) => {
      if (e.target === closeBtn || e.target === toggleBtn) return;
      isDragging = true;
      const rect = modal.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      modal.style.transform = 'none';
    };
    
    document.onmousemove = (e) => {
      if (!isDragging) return;
      modal.style.left = (e.clientX - offsetX) + 'px';
      modal.style.top = (e.clientY - offsetY) + 'px';
      modal.style.right = 'auto';
    };
    
    document.onmouseup = () => {
      isDragging = false;
    };
    
    // Reset button
    resetBtn.onclick = () => {
      resetModal();
    };
    
    // Next Case button
    nextCaseBtn.onclick = () => {
      handleNextCase();
    };
    
    // Form validation listeners
    modal.querySelectorAll('input, select').forEach(el => {
      if (el.id !== 'tid') { // Don't validate TID
        el.addEventListener('change', validateForm);
        el.addEventListener('input', validateForm);
      }
    });
    
    // Generate button click
    generateBtn.onclick = () => {
      if (!generateBtn.disabled) {
        // CRITICAL FIX: Extract fresh data from current page, not stale closure data
        const freshData = extractSourceData();
        generateFormURL(freshData);
        
        // Enable Next button after submitting
        enableNextButton();
      }
    };
    
    // Setup language override listeners
    setupLanguageOverrideListeners();
    
    // Initial validation
    validateForm();
  }
  
  // ========================================
  // PART 7: ASSIGN TO ME CHECK & URL GENERATION
  // ========================================
  
  function checkAssignToMeButton() {
    // First, check if there's an "Assigned to" value
    // If assigned, the case already belongs to the user - allow submission
    const assignedToElements = document.querySelectorAll('.MuiTypography-subtitle1');
    for (let el of assignedToElements) {
      if (el.textContent === 'Assigned to') {
        // Found "Assigned to" label, now check if there's a value
        const parent = el.closest('.MuiBox-root');
        if (parent) {
          const valueEl = parent.querySelector('.MuiTypography-h3');
          if (valueEl && valueEl.textContent.trim() !== '') {
            // Case is already assigned! Don't show warning
            return false;
          }
        }
      }
    }
    
    // If not assigned, check if "Assign to me" button exists
    const assignBtn = document.querySelector('button .MuiButton-label svg path[d*="M19 3h-4.18"]')?.closest('button');
    return assignBtn !== null && assignBtn !== undefined;
  }
  
  function showAssignToMeWarning() {
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.id = 'assign-warning-modal';
    warningModal.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000000;">
        <div style="background:white;padding:24px;border-radius:8px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
          <h3 style="margin:0 0 16px 0;color:#f44336;">⚠️ Action Required</h3>
          <p style="margin:0 0 20px 0;line-height:1.5;">Please click <strong>"ASSIGN TO ME"</strong> first before submitting the form.</p>
          <button id="close-warning" style="width:100%;padding:10px;background:#4285f4;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">OK, Got it!</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(warningModal);
    
    // Close button handler
    warningModal.querySelector('#close-warning').onclick = () => {
      warningModal.remove();
    };
  }
  
  function generateFormURL(data) {
    // Check if user needs to assign to themselves first
    if (checkAssignToMeButton()) {
      showAssignToMeWarning();
      return; // Don't proceed with form generation
    }
    
    const lob = modal.querySelector('input[name="lob"]:checked').value;
    const brand = modal.querySelector('#brand').value;
    const custType = modal.querySelector('input[name="custType"]:checked').value;
    const product = modal.querySelector('#product').value;
    const lang = modal.querySelector('input[name="lang"]:checked').value;
    const bancid = modal.querySelector('#bancid').value.trim();
    
    // Combine first and last name
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    
    // Build URL parameters
    const baseURL = 'https://docs.google.com/forms/d/e/1FAIpQLSfJ0AQaptO3wIaa09kJhHGULvApaiAdQRnTJzCq7CzwmP3SKw/viewform';
    const params = new URLSearchParams();
    
    // Add date/time parameters if available
    if (data.receivedDate) {
      params.append('entry.1882987299_year', data.receivedDate.year);
      params.append('entry.1882987299_month', data.receivedDate.month);
      params.append('entry.1882987299_day', data.receivedDate.day);
      params.append('entry.1882987299_hour', data.receivedDate.hour);
      params.append('entry.1882987299_minute', data.receivedDate.minute);
    }
    
    // Add form selections
    params.append('entry.506082014', lob);
    params.append('entry.104012616', brand);
    params.append('entry.1228494129', custType);
    params.append('entry.1098890156', product);
    params.append('entry.500460836', lang);
    params.append('entry.615216667', bancid);
    
    // Add extracted data
    if (fullName) params.append('entry.1133516513', fullName);
    if (data.primaryPhone) params.append('entry.504696174', data.primaryPhone);
    if (data.preferredPhone) params.append('entry.1161771354', data.preferredPhone);
    
    // Use verbatim with agent note prepended
    const verbatimWithNote = buildVerbatimWithAgentNote();
    if (verbatimWithNote) params.append('entry.961402602', verbatimWithNote);
    
    const finalURL = `${baseURL}?${params.toString()}`;
    
    // Open in new tab
    window.open(finalURL, '_blank');
  }
  
  // ========================================
  // PART 8: AUTO LANGUAGE DETECTION
  // ========================================
  
  // Auto-set customer language based on Confirmation Email field
  function autoSetLanguage(data) {
    // Only auto-set if user hasn't manually overridden
    if (userOverrodeLanguage) return;
    
    const confirmEmail = (data.confirmationEmail || '').toLowerCase();
    
    // Check if it contains "fr" (case-insensitive)
    if (confirmEmail.includes('fr')) {
      // Set to FR
      const frRadio = modal.querySelector('input[name="lang"][value="FR"]');
      if (frRadio) {
        frRadio.checked = true;
        console.log('[Auto Language] Set to FR based on Confirmation Email:', data.confirmationEmail);
      }
    } else {
      // Default to EN (or if empty)
      const enRadio = modal.querySelector('input[name="lang"][value="EN"]');
      if (enRadio) {
        enRadio.checked = true;
        if (confirmEmail) {
          console.log('[Auto Language] Set to EN based on Confirmation Email:', data.confirmationEmail);
        } else {
          console.log('[Auto Language] Set to EN (default - no Confirmation Email found)');
        }
      }
    }
  }
  
  // Add change listeners to language radios to track user overrides
  function setupLanguageOverrideListeners() {
    modal.querySelectorAll('input[name="lang"]').forEach(radio => {
      radio.addEventListener('change', () => {
        userOverrodeLanguage = true;
        console.log('[Auto Language] User manually changed language - auto-detection disabled until next lead');
      });
    });
  }
  
  // ========================================
  // MAIN EXECUTION
  // ========================================
  
  // Extract data and show modal
  const sourceData = extractSourceData();
  createModal(sourceData);
  
  // Start continuous lead monitoring
  startContinuousLeadMonitoring();
  
  // Start lead detection if no lead number on initial load
  if (!sourceData.leadNumber) {
    startLeadDetection();
  }
  
})();
