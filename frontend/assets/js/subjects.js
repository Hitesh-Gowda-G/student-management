/* ==========================================================================
   SUBJECTS REGISTRY CONTROLLER - CRUD & FILTERS
   ========================================================================== */

let currentPage = 1;
let currentLimit = 10;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  // Ensure authentication
  const currentUser = checkAuth();
  if (!currentUser || currentUser.role !== 'admin') {
    // Restrict students from directly accessing this admin CRUD page
    window.location.href = 'index.html';
    return;
  }

  // 1. Initial Load of Subjects
  loadSubjects(currentPage);

  // 2. Bind Interactive Filters
  document.getElementById('search-subject').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadSubjects(1);
    }, 300);
  });

  // 3. Form Modal Listeners
  const subjectFormModal = document.getElementById('subject-form-modal');
  const addBtn = document.getElementById('btn-add-subject-modal');
  const closeBtn = document.getElementById('btn-close-subject-modal');
  const cancelBtn = document.getElementById('btn-cancel-subject');
  const subjectForm = document.getElementById('form-subject-data');

  addBtn.addEventListener('click', () => openSubjectModal('add'));
  
  const closeFormModal = () => {
    subjectFormModal.classList.remove('show');
    subjectForm.reset();
    document.getElementById('subject-id-field').value = '';
  };

  closeBtn.addEventListener('click', closeFormModal);
  cancelBtn.addEventListener('click', closeFormModal);
  
  subjectFormModal.addEventListener('click', (e) => {
    if (e.target === subjectFormModal) closeFormModal();
  });

  // Handle Form Submit (Add / Edit Save)
  subjectForm.addEventListener('submit', handleFormSubmit);

  // Check if URL has a shortcut action trigger (e.g. index quick task links)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'add') {
    setTimeout(() => {
      openSubjectModal('add');
    }, 400);
  }
});

/**
 * Loads and renders the subjects catalog based on active queries
 */
async function loadSubjects(page) {
  currentPage = page;
  showLoader();

  const search = document.getElementById('search-subject').value.trim();

  try {
    let endpoint = `/subjects?page=${page}&limit=${currentLimit}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;

    const res = await api.get(endpoint);

    if (res.success) {
      renderSubjectsTable(res.data);
      renderPagination(res.pagination);
    } else {
      showToast(res.message || 'Failed to fetch subjects catalog.', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error connecting to database servers.', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Renders HTML table rows inside tbody
 */
function renderSubjectsTable(subjects) {
  const tbody = document.getElementById('tbody-subjects');
  tbody.innerHTML = '';

  if (subjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 48px;">
          <div class="empty-state" style="margin: 0; border: none;">
            <div class="empty-state-icon"><i class="fas fa-book-open"></i></div>
            <div class="empty-state-title">No Subjects Found</div>
            <div class="empty-state-desc">Try modifying your search filter query.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  subjects.forEach(sub => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight: 700; letter-spacing: 0.5px; font-family: 'Outfit'; font-size: 14px; color: var(--primary);">${sub.code}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${sub.name}</td>
      <td>
        <span class="semester-badge" style="background-color: var(--secondary-light); color: var(--secondary); border-radius: var(--border-radius-sm); font-weight: 700; padding: 4px 10px;">Semester ${sub.semester}</span>
      </td>
      <td>
        <span class="department-badge" style="background-color: var(--warning-light); color: var(--warning); border-radius: var(--border-radius-sm); font-weight: 700; padding: 4px 10px;">${sub.credits} Credits</span>
      </td>
      <td style="text-align: right;">
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-icon edit-btn" onclick="openSubjectModal('edit', ${sub.id})" title="Edit Subject Record"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete-btn" onclick="deleteSubject(${sub.id}, '${sub.name}')" title="Delete Subject"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

/**
 * Handles Pagination Controls Assembly
 */
function renderPagination(meta) {
  const summary = document.getElementById('pagination-summary');
  const controls = document.getElementById('pagination-buttons');

  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  summary.innerText = `Showing ${start} to ${end} of ${meta.total} subjects`;
  controls.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = meta.page === 1;
  prevBtn.addEventListener('click', () => loadSubjects(meta.page - 1));
  controls.appendChild(prevBtn);

  // Direct Page Buttons
  for (let i = 1; i <= meta.totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${meta.page === i ? 'active' : ''}`;
    pageBtn.innerText = i;
    pageBtn.addEventListener('click', () => loadSubjects(i));
    controls.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = meta.page === meta.totalPages || meta.totalPages === 0;
  nextBtn.addEventListener('click', () => loadSubjects(meta.page + 1));
  controls.appendChild(nextBtn);
}

/**
 * Opens Add or Edit Modals, resetting fields or pulling subject info
 */
async function openSubjectModal(mode, subjectId = null) {
  const modal = document.getElementById('subject-form-modal');
  const title = document.getElementById('subject-modal-title');
  const codeInput = document.getElementById('subject-code');

  if (mode === 'add') {
    title.innerText = 'Add New Course Subject';
    codeInput.disabled = false;
    
    // Clear and Show Modal
    document.getElementById('form-subject-data').reset();
    document.getElementById('subject-id-field').value = '';
    modal.classList.add('show');
  } else if (mode === 'edit' && subjectId) {
    title.innerText = 'Edit Subject Details';
    
    showLoader();
    try {
      const res = await api.get(`/subjects/${subjectId}`);
      if (res.success) {
        const sub = res.data;
        document.getElementById('subject-id-field').value = sub.id;
        codeInput.value = sub.code;
        document.getElementById('subject-name').value = sub.name;
        document.getElementById('subject-credits').value = sub.credits;
        document.getElementById('subject-semester').value = sub.semester;

        // Block changing code to maintain relational constraint links
        codeInput.disabled = true;

        modal.classList.add('show');
      } else {
        showToast('Failed to fetch subject details.', 'error');
      }
    } catch (error) {
      showToast(error.message || 'Error pulling subject details.', 'error');
    } finally {
      hideLoader();
    }
  }
}

/**
 * Handles Submitting Modal Form Save (POST / PUT)
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('subject-id-field').value;
  const code = document.getElementById('subject-code').value.trim();
  const name = document.getElementById('subject-name').value.trim();
  const credits = document.getElementById('subject-credits').value;
  const semester = document.getElementById('subject-semester').value;

  const payload = { code, name, credits, semester };

  showLoader();
  try {
    let res;
    if (id) {
      // Put Editing. We re-attach disabled fields to satisfy Express validators
      payload.code = code;
      res = await api.put(`/subjects/${id}`, payload);
    } else {
      // Post Adding
      res = await api.post('/subjects', payload);
    }

    if (res.success) {
      showToast(res.message, 'success');
      document.getElementById('subject-form-modal').classList.remove('show');
      document.getElementById('form-subject-data').reset();
      loadSubjects(id ? currentPage : 1);
    } else {
      showToast(res.message || 'Operation failed.', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error processing request.', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Invokes stylized confirmation and executes subject deletion
 */
function deleteSubject(id, name) {
  showConfirm(
    'Delete Course Subject?',
    `Are you sure you want to completely delete subject <b>${name}</b>?<br><br><span style="color: var(--danger); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Warning:</span> This operation is permanent. It will automatically drop this subject from all active student registrations!`,
    async () => {
      showLoader();
      try {
        const res = await api.delete(`/subjects/${id}`);
        if (res.success) {
          showToast(res.message, 'success');
          loadSubjects(1);
        } else {
          showToast(res.message || 'Delete operation failed.', 'error');
        }
      } catch (error) {
        showToast(error.message || 'Error sending request to database.', 'error');
      } finally {
        hideLoader();
      }
    }
  );
}
