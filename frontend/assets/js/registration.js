/* ==========================================================================
   SUBJECT REGISTRATION PORTAL CONTROLLER - SELECTION ENGINE
   ========================================================================== */

let studentId = null;
let catalogSubjects = [];
let selectedSubjectIds = new Set();
let initialRegisteredIds = [];

document.addEventListener('DOMContentLoaded', () => {
  // Ensure authentication
  const currentUser = checkAuth();
  if (!currentUser) return;

  if (currentUser.role !== 'student' || !currentUser.student_id) {
    // Admins are not students; show custom message or redirect
    showAdminWarning();
    return;
  }

  studentId = currentUser.student_id;

  // Initialize Data loads
  loadPortalData();

  // Bind Submit Button
  document.getElementById('btn-submit-registration').addEventListener('click', handleRegistrationSubmit);
});

/**
 * Handles dynamic warnings when an Admin bypasses page guards
 */
function showAdminWarning() {
  const container = document.getElementById('page-slot-content');
  container.innerHTML = `
    <div class="empty-state" style="margin-top: 48px;">
      <div class="empty-state-icon" style="color: var(--warning);"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="empty-state-title">Student Registration Portal</div>
      <div class="empty-state-desc">This registration portal is only available for Student accounts. Admin users cannot register for courses.</div>
      <a href="index.html" class="btn btn-primary" style="margin-top: 16px;">Return to Dashboard</a>
    </div>
  `;
}

/**
 * Loads available subjects and current student registrations in parallel
 */
async function loadPortalData() {
  showLoader();
  try {
    const [catalogRes, registrationRes] = await Promise.all([
      api.get('/subjects?limit=50'), // Load all subjects
      api.get(`/registrations/student/${studentId}`) // Load what student is registered for
    ]);

    if (catalogRes.success && registrationRes.success) {
      catalogSubjects = catalogRes.data;
      
      // Load initially registered subjects
      initialRegisteredIds = registrationRes.data.map(r => r.subject_id);
      
      // Populate selection sets
      selectedSubjectIds = new Set(initialRegisteredIds);

      // Render catalog grid cards
      renderCatalogGrid();

      // Recalculate summary metrics
      updateSummary();
    } else {
      showToast('Failed to load catalog data.', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error connecting to registration servers.', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Renders list of catalog subjects as responsive grid cards
 */
function renderCatalogGrid() {
  const grid = document.getElementById('grid-subjects-selection');
  grid.innerHTML = '';

  if (catalogSubjects.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px;">
        <i class="fas fa-book-open" style="font-size: 32px; color: var(--text-secondary); margin-bottom: 8px;"></i>
        <p style="color: var(--text-secondary);">No course subjects currently active in the catalogue.</p>
      </div>
    `;
    return;
  }

  catalogSubjects.forEach(sub => {
    const isSelected = selectedSubjectIds.has(sub.id);
    
    const card = document.createElement('div');
    card.id = `subject-card-${sub.id}`;
    card.className = `subject-item-card ${isSelected ? 'selected' : ''}`;
    
    card.innerHTML = `
      <div class="subject-checkbox">
        ${isSelected ? '<i class="fas fa-check"></i>' : ''}
      </div>
      <div class="subject-item-code">${sub.code}</div>
      <div class="subject-item-name">${sub.name}</div>
      <div class="subject-item-credits">
        <i class="far fa-star" style="color: var(--warning); margin-right: 4px;"></i>${sub.credits} Credits
      </div>
    `;

    // Bind card click listener
    card.addEventListener('click', () => toggleSubjectSelection(sub.id));
    grid.appendChild(card);
  });
}

/**
 * Toggles a subject's selection state reactively
 */
function toggleSubjectSelection(subjectId) {
  const sub = catalogSubjects.find(s => s.id === subjectId);
  if (!sub) return;

  const card = document.getElementById(`subject-card-${subjectId}`);
  const checkbox = card.querySelector('.subject-checkbox');

  if (selectedSubjectIds.has(subjectId)) {
    // Deselect is always allowed
    selectedSubjectIds.delete(subjectId);
    card.classList.remove('selected');
    checkbox.innerHTML = '';
  } else {
    // Calculate current total credits selected
    let currentTotal = 0;
    selectedSubjectIds.forEach(id => {
      const s = catalogSubjects.find(item => item.id === id);
      if (s) currentTotal += s.credits;
    });

    // Enforce max credit limit of 23
    if (currentTotal + sub.credits > 23) {
      showToast(`Cannot select subject. Adding this subject (${sub.credits} credits) would exceed the 23-credit limit (Current: ${currentTotal} credits).`, 'error');
      return;
    }

    // Select
    selectedSubjectIds.add(subjectId);
    card.classList.add('selected');
    checkbox.innerHTML = '<i class="fas fa-check"></i>';
  }

  // Recalculate summary metrics
  updateSummary();
}

/**
 * Deselects a subject directly from selection summary pills
 */
function deselectSubject(subjectId) {
  if (selectedSubjectIds.has(subjectId)) {
    selectedSubjectIds.delete(subjectId);
    
    // Update card class directly if card is rendered in catalog grid
    const card = document.getElementById(`subject-card-${subjectId}`);
    if (card) {
      card.classList.remove('selected');
      card.querySelector('.subject-checkbox').innerHTML = '';
    }

    updateSummary();
  }
}

/**
 * Calculates selected count, credit aggregates, updates summary pills and submit buttons
 */
function updateSummary() {
  const countSpan = document.getElementById('summary-count');
  const creditsSpan = document.getElementById('summary-credits');
  const pillsContainer = document.getElementById('container-selected-pills');
  const submitBtn = document.getElementById('btn-submit-registration');
  const successBadge = document.getElementById('registered-success-badge');

  countSpan.innerText = selectedSubjectIds.size;

  // Calculate accumulated credits value
  let totalCredits = 0;
  pillsContainer.innerHTML = '';

  if (selectedSubjectIds.size === 0) {
    pillsContainer.innerHTML = `
      <p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 24px 0;" id="placeholder-summary-empty">
        <i class="fas fa-tasks" style="display: block; font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
        Click on subject cards on the left to select them.
      </p>
    `;
    creditsSpan.innerText = '0';
    submitBtn.disabled = true;
    successBadge.style.display = 'none';
    return;
  }

  // Populate dynamic selection pills
  selectedSubjectIds.forEach(id => {
    const sub = catalogSubjects.find(s => s.id === id);
    if (sub) {
      totalCredits += sub.credits;

      const pill = document.createElement('div');
      pill.className = 'selected-pill';
      pill.innerHTML = `
        <span title="${sub.name}">${sub.name} <small style="color: var(--text-secondary);">(${sub.code})</small></span>
        <i class="fas fa-times-circle" onclick="deselectSubject(${sub.id})" title="Remove selection"></i>
      `;
      pillsContainer.appendChild(pill);
    }
  });

  creditsSpan.innerText = totalCredits;

  // Determine submit buttons states
  const arraysAreEqual = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    const s1 = new Set(arr1);
    return arr2.every(x => s1.has(x));
  };

  const currentSelectionArr = Array.from(selectedSubjectIds);
  const isIdentical = arraysAreEqual(currentSelectionArr, initialRegisteredIds);

  // Enforce min and max of exactly 23 credits
  if (totalCredits !== 23) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i> Requires Exactly 23 Credits (${totalCredits}/23)`;
    submitBtn.style.opacity = '0.65';
    submitBtn.style.cursor = 'not-allowed';
    successBadge.style.display = 'none';
  } else if (isIdentical && initialRegisteredIds.length > 0) {
    // Already saved, no edits made
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-check-double"></i> Selection Up to Date';
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'default';
    successBadge.style.display = 'inline-flex';
  } else {
    // Pending modifications
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Save & Confirm Registration';
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    successBadge.style.display = 'none';
  }
}

/**
 * Handles Register/Modify Submission Calls
 */
async function handleRegistrationSubmit() {
  const selectedArr = Array.from(selectedSubjectIds);

  // Double-check total credits select validation
  let totalCredits = 0;
  selectedArr.forEach(id => {
    const sub = catalogSubjects.find(s => s.id === id);
    if (sub) totalCredits += sub.credits;
  });

  if (totalCredits !== 23) {
    showToast(`Registration requires exactly 23 credits. Currently selected: ${totalCredits} credits.`, 'error');
    return;
  }

  showConfirm(
    'Confirm Enrollments?',
    `Are you sure you want to save these <b>${selectedArr.length}</b> subjects totaling <b>23 credits</b>?<br>This will finalize your registration list and log your semester enrollment.`,
    async () => {
      showLoader();
      try {
        const res = await api.put('/registrations', {
          studentId: studentId,
          subjectIds: selectedArr
        });

        if (res.success) {
          showToast('Course registration saved successfully!', 'success');
          
          // Re-sync states
          initialRegisteredIds = selectedArr;
          updateSummary();
        } else {
          showToast(res.message || 'Failed to complete registration.', 'error');
        }
      } catch (error) {
        showToast(error.message || 'Error processing registration save.', 'error');
      } finally {
        hideLoader();
      }
    }
  );
}
