// DOMS to Google Form Data Transfer Bookmarklet - EMBEDDED VERSION
// Version 3.0 - Seamlessly Integrated Native-Looking Boxes
// Full Source Code (Unminified)

(function() {
  'use strict';
  
  // ========================================
  // GLOBAL STATE
  // ========================================
  
  let currentLeadNumber = '';
  let leadMonitoringInterval = null;
  let userOverrodeLanguage = false;
  
  // ========================================
  // PART 1: DATA EXTRACTION FUNCTIONS
  // ========================================
  
  // Extract Lead Number from H1 tag
  function getLeadNumber() {
    const h1Elements = document.querySelectorAll('h1.MuiTypography-h1');
    for (let h1 of h1Elements) {
      const text = h1.textContent;
      if (text.includes('Lead #')) {
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
  
  // Helper function to find text content by label
  function getTextByLabel(...labelTexts) {
    const elements = document.querySelectorAll('.MuiTypography-body2');
    for (let el of elements) {
      const elText = el.textContent;
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
  
  // Parse date string to object
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
      
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      
      if (hour > 12) hour = hour - 12;
      
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
  
  function formatDate(d) {
    return `${d.month}/${d.day}/${d.year} ${d.hour}:${String(d.minute).padStart(2,'0')}`;
  }
  
  // Helper function to build verbatim with agent note prepended
  function buildVerbatimWithAgentNote() {
    const agentNote = document.querySelector('#doms-agent-note');
    const agentNoteText = agentNote ? agentNote.value.trim() : '';
    const freshData = extractSourceData();
    const verbatim = freshData.verbatim || '';
    
    if (agentNoteText) {
      return `[NOTE FOR AGENT: ${agentNoteText}] ${verbatim}`;
    }
    return verbatim;
  }
  
  // Clipboard copy function
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyNotification();
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }
  
  function showCopyNotification() {
    const notification = document.createElement('div');
    notification.innerHTML = '✓ Copied!';
    Object.assign(notification.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      background: '#4caf50',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '4px',
      zIndex: '10000000',
      fontWeight: 'bold',
      fontSize: '14px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    });
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 1500);
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
          reject(new Error(`Element ${selector} not found`));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
  
  // ========================================
  // PART 2: COMPACT STYLING
  // ========================================
  
  function injectCompactStyles() {
    if (document.getElementById('doms-embedded-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'doms-embedded-styles';
    styleEl.textContent = `
      /* Override header padding */
      .jss21 {
        padding: 15px 24px !important;
      }
      
      /* Hide native left sidebar (Summary/Email tabs) */
      .MuiGrid-root.MuiGrid-item.MuiGrid-grid-xs-2 {
        display: none !important;
      }
      
      /* Side-by-side flex container */
      #doms-embedded-container {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
      }
      
      #doms-optimized-view {
        flex: 0 0 auto;
        width: auto;
        min-width: 200px;
        max-width: 600px;
      }
      
      #doms-info-needed {
        flex: 1;
        position: relative;
        min-width: 670px;
      }
      
      /* Two-column grid for Information Needed */
      .doms-two-col-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 8px;
      }
      
      .doms-left-col,
      .doms-right-col {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      /* Align radio buttons with dropdown labels */
      .doms-right-col > div {
        margin-top: 14px;
      }
      
      .doms-right-col > div:first-child {
        margin-top: 0;
      }
      
      /* Verbatim in Optimized View with scroll */
      #doms-opt-verbatim {
        padding: 8px;
        background: #f5f5f5;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 4px;
        font-size: 0.875rem;
        font-family: 'Helvetica Neue Light', Helvetica, Arial, sans-serif;
        color: rgba(0, 0, 0, 0.87);
        max-height: 200px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
      
      /* Language Tab Styling */
      .doms-lang-tab {
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 0.875rem;
        font-family: 'Helvetica Neue Medium', Helvetica, Arial, sans-serif;
        color: #666;
        transition: all 0.2s;
      }
      
      .doms-lang-tab.active {
        border-bottom-color: #4B286D;
        color: #4B286D;
        font-weight: bold;
      }
      
      .doms-lang-tab:hover {
        background: #f5f5f5;
      }
      
      .doms-tab-bar {
        display: flex;
        align-items: center;
        width: 100%;
        margin-bottom: 4px;
        border-bottom: 1px solid #ddd;
      }
      
      /* Compact spacing for embedded boxes */
      #doms-info-needed .MuiCardContent-root,
      #doms-optimized-view .MuiCardContent-root {
        padding: 12px !important;
      }
      
      #doms-info-needed .field-row {
        margin-bottom: 8px !important;
        display: flex;
        gap: 8px;
      }
      
      #doms-info-needed .field-row label {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      
      #doms-info-needed input:not([type="radio"]),
      #doms-info-needed select,
      #doms-info-needed textarea {
        width: 100%;
        padding: 6px 8px !important;
        font-size: 0.875rem !important;
        font-family: 'Helvetica Neue Medium', Helvetica, Arial, sans-serif;
        border: 1px solid rgba(0, 0, 0, 0.23);
        border-radius: 4px;
        box-sizing: border-box;
      }
      
      #doms-info-needed input:focus,
      #doms-info-needed select:focus,
      #doms-info-needed textarea:focus {
        outline: none;
        border-color: #4B286D;
        border-width: 2px;
      }
      
      #doms-info-needed .MuiButton-root {
        padding: 6px 12px !important;
        font-size: 0.8125rem !important;
        font-family: 'Helvetica Neue Medium', Helvetica, Arial, sans-serif;
        text-transform: uppercase;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
      }
      
      #doms-info-needed h3,
      #doms-optimized-view h3 {
        margin-bottom: 8px !important;
        font-size: 1.15rem;
        font-family: 'Helvetica Neue Medium', Helvetica, Arial, sans-serif;
        font-weight: 500;
        line-height: 1.167;
        color: rgba(0, 0, 0, 0.87);
      }
      
      #doms-info-needed .sub-heading {
        font-size: 0.875rem;
        font-family: 'Helvetica Neue Light', Helvetica, Arial, sans-serif;
        color: rgba(0, 0, 0, 0.54);
        margin-bottom: 12px;
      }
      
      #doms-optimized-view .opt-row {
        margin-bottom: 6px !important;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      #doms-optimized-view .opt-label {
        font-size: 0.875rem;
        font-family: 'Helvetica Neue Light', Helvetica, Arial, sans-serif;
        color: rgba(0, 0, 0, 0.54);
        margin-right: 4px;
      }
      
      #doms-optimized-view .opt-value {
        font-size: 0.875rem;
        font-family: 'Helvetica Neue Medium', Helvetica, Arial, sans-serif;
        color: rgba(0, 0, 0, 0.87);
        word-break: break-word;
      }
      
      .doms-button-row {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .doms-button-row button {
        flex: 1;
      }
      
      #doms-verbatim-display {
        padding: 8px;
        background: #f5f5f5;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 4px;
        font-size: 0.875rem;
        font-family: 'Helvetica Neue Light', Helvetica, Arial, sans-serif;
        color: rgba(0, 0, 0, 0.87);
        max-height: 150px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  // ========================================
  // PART 3: CREATE BOX 1 - INFORMATION NEEDED
  // ========================================
  
  function createInformationNeededBox(data) {
    const card = document.createElement('div');
    card.className = 'MuiPaper-root MuiCard-root MuiPaper-outlined MuiPaper-rounded';
    card.id = 'doms-info-needed';
    
    const cardContent = document.createElement('div');
    cardContent.className = 'MuiCardContent-root';
    
    cardContent.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div>
          <h3 class="MuiTypography-root MuiTypography-h3" style="margin-bottom:4px;">Information Needed</h3>
          <p class="sub-heading" style="margin-bottom:12px;">Please use CASA to get the information needed to fill out the empty fields</p>
        </div>
        <span style="font-size:0.75rem;color:#999;font-family:'Helvetica Neue Light',Helvetica,Arial,sans-serif;white-space:nowrap;">Created by: Brandon T</span>
      </div>
      
      <!-- Two-Column Grid -->
      <div class="doms-two-col-grid">
        <!-- LEFT COLUMN -->
        <div class="doms-left-col">
          <label>
            <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">BAN/CID *</strong>
            <input type="text" id="doms-bancid" required maxlength="9" />
          </label>
          <label>
            <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">Brand *</strong>
            <select id="doms-brand" required>
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
            <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">Product/Service *</strong>
            <select id="doms-product" required>
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
        
        <!-- RIGHT COLUMN -->
        <div class="doms-right-col">
          <div>
            <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">LOB *</strong>
            <label style="display:inline;margin-right:16px;"><input type="radio" name="doms-lob" value="Wireless" required> Wireless</label>
            <label style="display:inline;"><input type="radio" name="doms-lob" value="Wireline"> Wireline</label>
          </div>
          <div>
            <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">Customer Language *</strong>
            <label style="display:inline;margin-right:16px;"><input type="radio" name="doms-lang" value="EN" required> EN</label>
            <label style="display:inline;"><input type="radio" name="doms-lang" value="FR"> FR</label>
          </div>
          <div>
            <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">Customer Type *</strong>
            <label style="display:inline;margin-right:12px;"><input type="radio" name="doms-custType" value="Consumer" required> Consumer</label>
            <label style="display:inline;margin-right:12px;"><input type="radio" name="doms-custType" value="EPP"> EPP</label>
            <label style="display:inline;"><input type="radio" name="doms-custType" value="Business"> Business</label>
          </div>
        </div>
      </div>
      
      <!-- Note for Agent - Single Line -->
      <div class="field-row">
        <label style="flex:1;">
          <strong style="font-size:0.875rem;margin-bottom:4px;display:block;">Note for Agent (Optional)</strong>
          <input type="text" id="doms-agent-note" />
        </label>
      </div>
      
      <!-- Buttons -->
      <div class="doms-button-row">
        <button id="doms-reset-btn" class="MuiButton-root" style="background:#f44336;color:white;">Reset Fields</button>
        <button id="doms-submit-btn" class="MuiButton-root" style="background:#4285f4;color:white;" disabled>Submit Form</button>
        <button id="doms-complete-btn" class="MuiButton-root" style="background:#4caf50;color:white;" disabled>Complete</button>
      </div>
    `;
    
    card.appendChild(cardContent);
    
    return card;
  }
  
  // ========================================
  // PART 4: CREATE BOX 2 - OPTIMIZED VIEW
  // ========================================
  
  function createOptimizedViewBox(data) {
    const card = document.createElement('div');
    card.className = 'MuiPaper-root MuiCard-root MuiPaper-outlined MuiPaper-rounded';
    card.id = 'doms-optimized-view';
    
    const cardContent = document.createElement('div');
    cardContent.className = 'MuiCardContent-root';
    
    // Combine first and last name
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A';
    const emailDisplay = data.email || 'N/A';
    const phoneDisplay = data.primaryPhone || 'N/A';
    const preferredDisplay = data.preferredPhone || 'N/A';
    const verbatimDisplay = data.verbatim || 'N/A';
    
    cardContent.innerHTML = `
      <h3 class="MuiTypography-root MuiTypography-h3">Optimized View</h3>
      
      <!-- Row 1: Name -->
      <div class="opt-row">
        <span class="opt-label">Name:</span>
        <span class="opt-value">${fullName}</span>
        ${fullName !== 'N/A' ? '<span class="doms-copy-btn" data-copy="' + fullName + '"></span>' : ''}
      </div>
      
      <!-- Row 2: Email -->
      <div class="opt-row">
        <span class="opt-label">Email:</span>
        <span class="opt-value">${emailDisplay}</span>
        ${emailDisplay !== 'N/A' ? '<span class="doms-copy-btn" data-copy="' + emailDisplay + '"></span>' : ''}
      </div>
      
      <!-- Row 3: Phone -->
      <div class="opt-row">
        <span class="opt-label">Phone:</span>
        <span class="opt-value">${phoneDisplay}</span>
        ${phoneDisplay !== 'N/A' ? '<span class="doms-copy-btn" data-copy="' + phoneDisplay + '"></span>' : ''}
      </div>
      
      <!-- Row 4: Preferred -->
      <div class="opt-row">
        <span class="opt-label">Preferred:</span>
        <span class="opt-value">${preferredDisplay}</span>
        ${preferredDisplay !== 'N/A' ? '<span class="doms-copy-btn" data-copy="' + preferredDisplay + '"></span>' : ''}
      </div>
      
      <!-- Row 5: Verbatim with Scroll -->
      <div class="opt-row" style="flex-direction:column;align-items:flex-start;margin-top:8px;">
        <div style="display:flex;align-items:center;width:100%;margin-bottom:4px;">
          <span class="opt-label">Verbatim:</span>
          ${verbatimDisplay !== 'N/A' ? '<span class="doms-copy-btn" data-copy="' + verbatimDisplay.replace(/"/g, '&quot;') + '" style="margin-left:4px;"></span>' : ''}
          ${verbatimDisplay !== 'N/A' ? '<button id="doms-translate-btn" class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorPrimary MuiIconButton-sizeSmall" style="display:inline-flex;vertical-align:middle;margin-left:4px;padding:3px;" title="Translate with Google" tabindex="0" type="button"><span class="MuiIconButton-label">🌐 Translate</span></button>' : ''}
        </div>
        <div id="doms-opt-verbatim">${verbatimDisplay}</div>
      </div>
    `;
    
    card.appendChild(cardContent);
    
    return card;
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
      clonedBtn.style.cssText = 'display:inline-flex;vertical-align:middle;margin-left:4px;padding:3px;';
      return clonedBtn.outerHTML;
    }
    
    // Fallback: create MUI-styled copy button manually
    return `
      <button class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorPrimary MuiIconButton-sizeSmall" 
              style="display:inline-flex;vertical-align:middle;margin-left:4px;padding:3px;"
              tabindex="0" type="button">
        <span class="MuiIconButton-label">
          <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall" focusable="false" viewBox="0 0 24 24">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4l6 6v10c0 1.1-.9 2-2 2H7.99C6.89 23 6 22.1 6 21l.01-14c0-1.1.89-2 1.99-2h7zm-1 7h5.5L14 6.5V12z"></path>
          </svg>
        </span>
      </button>
    `;
  }
  
  // ========================================
  // PART 5: INJECTION & SETUP
  // ========================================
  
  function injectEmbeddedBoxes() {
    // Remove existing container if present
    const existingContainer = document.getElementById('doms-embedded-container');
    if (existingContainer) existingContainer.remove();
    
    // Find injection point (first card in the grid)
    const gridContainer = document.querySelector('.MuiGrid-container.MuiGrid-spacing-xs-2');
    if (!gridContainer) {
      console.error('[DOMS Embedded] Could not find grid container');
      return;
    }
    
    const firstCard = gridContainer.querySelector('.MuiGrid-item');
    if (!firstCard) {
      console.error('[DOMS Embedded] Could not find first grid item');
      return;
    }
    
    // Extract data
    const data = extractSourceData();
    currentLeadNumber = data.leadNumber;
    
    // Inject styles
    injectCompactStyles();
    
    // Remove native sidebar (JavaScript approach - more reliable than CSS)
    const sidebar = document.querySelector('.MuiGrid-root.MuiGrid-item.MuiGrid-grid-xs-2');
    if (sidebar) {
      sidebar.remove();
      console.log('[DOMS Embedded] Native sidebar removed');
    }
    
    // Create side-by-side container
    const container = document.createElement('div');
    container.id = 'doms-embedded-container';
    
    // Create boxes
    const optBox = createOptimizedViewBox(data);
    const infoBox = createInformationNeededBox(data);
    
    // Add boxes to container (Optimized View on left, Information Needed on right)
    container.appendChild(optBox);
    container.appendChild(infoBox);
    
    // Inject container before first card
    gridContainer.insertBefore(container, firstCard);
    
    // Setup copy buttons
    setupCopyButtons();
    
    // Setup translate button
    setupTranslateButton(data);
    
    // Setup form functionality
    setupFormHandlers();
    
    // Auto-set language
    autoSetLanguage(data);
    
    // Start navigation monitoring
    startNavigationMonitoring();
    
    console.log('[DOMS Embedded] Boxes injected successfully');
  }
  
  // ========================================
  // PART 7: NAVIGATION MONITORING
  // ========================================
  
  function startNavigationMonitoring() {
    // Clear any existing interval
    if (leadMonitoringInterval) {
      clearInterval(leadMonitoringInterval);
    }
    
    // Monitor for lead number changes (page navigation)
    leadMonitoringInterval = setInterval(() => {
      const newLeadNumber = getLeadNumber();
      
      // If lead number changed and boxes exist, re-inject
      if (newLeadNumber && newLeadNumber !== currentLeadNumber) {
        console.log('[Navigation Monitor] Lead changed from', currentLeadNumber, 'to', newLeadNumber);
        currentLeadNumber = newLeadNumber;
        
        // Small delay to let page fully load
        setTimeout(() => {
          if (document.getElementById('doms-embedded-container')) {
            injectEmbeddedBoxes();
          }
        }, 500);
      }
    }, 1000); // Check every second
    
    console.log('[Navigation Monitor] Started monitoring for lead changes');
  }
  
  function setupCopyButtons() {
    const copyBtnTemplate = createCopyButton();
    
    document.querySelectorAll('.doms-copy-btn').forEach(placeholder => {
      const textToCopy = placeholder.getAttribute('data-copy');
      placeholder.innerHTML = copyBtnTemplate;
      
      const btn = placeholder.querySelector('button');
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          copyToClipboard(textToCopy);
        };
      }
    });
  }
  
  function setupTranslateButton(data) {
    const translateBtn = document.getElementById('doms-translate-btn');
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
  
  function setupVerbatimExpand() {
    const expandBtn = document.getElementById('doms-opt-expand');
    if (!expandBtn) return;
    
    const shortDiv = document.getElementById('doms-opt-verbatim-short');
    const fullDiv = document.getElementById('doms-opt-verbatim-full');
    
    expandBtn.onclick = () => {
      if (fullDiv.style.display === 'none') {
        fullDiv.style.display = 'block';
        shortDiv.style.display = 'none';
        expandBtn.textContent = '▲ Collapse';
      } else {
        fullDiv.style.display = 'none';
        shortDiv.style.display = 'block';
        expandBtn.textContent = '▼ Expand';
      }
    };
  }
  
  // ========================================
  // PART 6: FORM VALIDATION & HANDLERS
  // ========================================
  
  function validateForm() {
    const lob = document.querySelector('input[name="doms-lob"]:checked');
    const brand = document.getElementById('doms-brand').value;
    const custType = document.querySelector('input[name="doms-custType"]:checked');
    const product = document.getElementById('doms-product').value;
    const lang = document.querySelector('input[name="doms-lang"]:checked');
    const bancid = document.getElementById('doms-bancid').value.trim();
    
    const isValid = lob && brand && custType && product && lang && bancid.length >= 1 && bancid.length <= 9;
    
    const submitBtn = document.getElementById('doms-submit-btn');
    const completeBtn = document.getElementById('doms-complete-btn');
    
    submitBtn.disabled = !isValid;
    completeBtn.disabled = !isValid;
    
    if (isValid) {
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      completeBtn.style.opacity = '1';
      completeBtn.style.cursor = 'pointer';
    } else {
      submitBtn.style.opacity = '0.5';
      submitBtn.style.cursor = 'not-allowed';
      completeBtn.style.opacity = '0.5';
      completeBtn.style.cursor = 'not-allowed';
    }
  }
  
  function autoSetLanguage(data) {
    if (userOverrodeLanguage) return;
    
    const confirmEmail = (data.confirmationEmail || '').toLowerCase();
    
    if (confirmEmail.includes('fr')) {
      const frRadio = document.querySelector('input[name="doms-lang"][value="FR"]');
      if (frRadio) {
        frRadio.checked = true;
        console.log('[Auto Language] Set to FR based on Confirmation Email:', data.confirmationEmail);
      }
    } else {
      const enRadio = document.querySelector('input[name="doms-lang"][value="EN"]');
      if (enRadio) {
        enRadio.checked = true;
        console.log('[Auto Language] Set to EN');
      }
    }
  }
  
  function setupFormHandlers() {
    // Form validation on change
    const inputs = document.querySelectorAll('#doms-info-needed input, #doms-info-needed select');
    inputs.forEach(el => {
      el.addEventListener('change', validateForm);
      el.addEventListener('input', validateForm);
    });
    
    // Track language override
    document.querySelectorAll('input[name="doms-lang"]').forEach(radio => {
      radio.addEventListener('change', () => {
        userOverrodeLanguage = true;
        console.log('[Auto Language] User manually changed language');
      });
    });
    
    // Reset button
    document.getElementById('doms-reset-btn').onclick = () => {
      document.getElementById('doms-bancid').value = '';
      document.getElementById('doms-brand').value = '';
      document.getElementById('doms-product').value = '';
      document.getElementById('doms-agent-note').value = '';
      document.querySelectorAll('input[name="doms-lob"]').forEach(r => r.checked = false);
      document.querySelectorAll('input[name="doms-lang"]').forEach(r => r.checked = false);
      document.querySelectorAll('input[name="doms-custType"]').forEach(r => r.checked = false);
      userOverrodeLanguage = false;
      validateForm();
    };
    
    // Submit Form button
    document.getElementById('doms-submit-btn').onclick = () => {
      if (document.getElementById('doms-submit-btn').disabled) return;
      
      const freshData = extractSourceData();
      const lob = document.querySelector('input[name="doms-lob"]:checked').value;
      const brand = document.getElementById('doms-brand').value;
      const custType = document.querySelector('input[name="doms-custType"]:checked').value;
      const product = document.getElementById('doms-product').value;
      const lang = document.querySelector('input[name="doms-lang"]:checked').value;
      const bancid = document.getElementById('doms-bancid').value.trim();
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
      
      // Build verbatim with agent note if present
      const agentNote = document.getElementById('doms-agent-note').value.trim();
      const verbatim = freshData.verbatim || '';
      
      let finalVerbatim = verbatim;
      
      if (agentNote) {
        finalVerbatim = `[NOTE FOR AGENT: ${agentNote}] ${verbatim}`;
      }
      
      if (finalVerbatim) params.append('entry.961402602', finalVerbatim);
      
      const finalURL = `${baseURL}?${params.toString()}`;
      window.open(finalURL, '_blank');
      console.log('[Submit Form] URL opened');
    };
    
    // Complete button (Next case automation)
    document.getElementById('doms-complete-btn').onclick = async () => {
      if (document.getElementById('doms-complete-btn').disabled) return;
      
      try {
        console.log('[Complete] Starting automation...');
        
        const changeStatusBtn = document.querySelector('button .MuiButton-label svg path[d*="M17 3H5c-1.11"]')?.closest('button');
        if (!changeStatusBtn) {
          alert('Could not find "Change Status" button. Please click it manually.');
          return;
        }
        
        changeStatusBtn.click();
        console.log('[Complete] Change Status button clicked');
        
        await waitForElement('.MuiDialog-paper[role="dialog"]', 5000);
        await sleep(500);
        
        // Set React fields
        setReactField('input[name="status"]', 'COMPLETED', 'Status');
        await sleep(500);
        setReactField('input[name="updatedSystem"]', 'None', 'System Updated In');
        await sleep(300);
        
        const tid = getTID();
        if (tid) {
          setReactField('input[name="externalSystemOrderID"]', tid, 'External Order ID');
          console.log('[Complete] TID set to:', tid);
        }
        
        console.log('[Complete] Automation complete. User must submit modal.');
        
      } catch (error) {
        console.error('[Complete] Automation error:', error);
        alert('Complete automation encountered an error. Check console for details.');
      }
    };
    
    // Initial validation
    validateForm();
  }
  
  function setReactField(selector, value, fieldName) {
    const input = document.querySelector(selector);
    if (!input) {
      console.error(`[Complete] ✗ Field not found: ${selector}`);
      return false;
    }
    
    const reactKey = Object.keys(input).find(key => key.startsWith('__reactProps'));
    if (!reactKey) {
      console.error(`[Complete] ✗ React props not found for: ${selector}`);
      return false;
    }
    
    const reactProps = input[reactKey];
    if (reactProps && reactProps.onChange) {
      if (input.type === 'text') {
        input.value = value;
      }
      
      const fakeEvent = {
        target: { value: value, name: input.name },
        currentTarget: { value: value, name: input.name }
      };
      reactProps.onChange(fakeEvent);
      
      if (input.type === 'text') {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      console.log(`[Complete] ✓ ${fieldName} set to: ${value}`);
      return true;
    }
    return false;
  }
  
  // ========================================
  // PART 8: PERSISTENCE ACROSS PAGE REFRESHES
  // ========================================
  
  function enablePersistence() {
    // Set flag in sessionStorage
    sessionStorage.setItem('doms-embedded-active', 'true');
    console.log('[Persistence] Enabled - boxes will persist across page refreshes');
  }
  
  function checkAndAutoInject() {
    // Check if we should auto-inject after page load
    const isActive = sessionStorage.getItem('doms-embedded-active');
    
    if (isActive === 'true') {
      console.log('[Persistence] Detected active session, waiting for page to load...');
      
      // Wait for grid container to be available
      const checkInterval = setInterval(() => {
        const gridContainer = document.querySelector('.MuiGrid-container.MuiGrid-spacing-xs-2');
        const leadNumber = getLeadNumber();
        
        if (gridContainer && leadNumber && !document.getElementById('doms-embedded-container')) {
          clearInterval(checkInterval);
          console.log('[Persistence] Page ready, auto-injecting boxes...');
          injectEmbeddedBoxes();
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }
  
  // ========================================
  // MAIN EXECUTION
  // ========================================
  
  // Check if boxes already exist
  if (document.getElementById('doms-info-needed')) {
    console.log('[DOMS Embedded] Already loaded, skipping...');
    return;
  }
  
  // Check if we need to auto-inject (after page refresh)
  checkAndAutoInject();
  
  // Manual injection (first time or from bookmarklet)
  const leadNumber = getLeadNumber();
  if (leadNumber && !document.getElementById('doms-embedded-container')) {
    injectEmbeddedBoxes();
    enablePersistence();
  }
  
  console.log('[DOMS Embedded] Version 3.0 loaded successfully!');
  
})();
