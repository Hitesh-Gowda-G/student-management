/* ==========================================================================
   STUDENT REGISTRY CONTROLLER - CRUD & FILTERS
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

  // 1. Initial Load of Students
  loadStudents(currentPage);

  // 2. Bind Interactive Filters
  document.getElementById('filter-dept').addEventListener('change', () => loadStudents(1));
  document.getElementById('filter-semester').addEventListener('change', () => loadStudents(1));
  
  // Debounced Table Search
  document.getElementById('search-student').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadStudents(1);
    }, 300);
  });

  // 3. Form Modal Listeners
  const studentFormModal = document.getElementById('student-form-modal');
  const addBtn = document.getElementById('btn-add-student-modal');
  const closeBtn = document.getElementById('btn-close-student-modal');
  const cancelBtn = document.getElementById('btn-cancel-student');
  const studentForm = document.getElementById('form-student-data');

  addBtn.addEventListener('click', () => openStudentModal('add'));
  
  const closeFormModal = () => {
    studentFormModal.classList.remove('show');
    studentForm.reset();
    document.getElementById('student-id-field').value = '';
  };

  closeBtn.addEventListener('click', closeFormModal);
  cancelBtn.addEventListener('click', closeFormModal);
  
  studentFormModal.addEventListener('click', (e) => {
    if (e.target === studentFormModal) closeFormModal();
  });

  // Handle Form Submit (Add / Edit Save)
  studentForm.addEventListener('submit', handleFormSubmit);

  // 4. View Modal Listeners
  const viewModal = document.getElementById('student-view-modal');
  const closeViewBtn = document.getElementById('btn-close-view-modal');
  const closeViewProfileBtn = document.getElementById('btn-close-view-profile');
  
  const closeViewModal = () => {
    viewModal.classList.remove('show');
  };
  
  closeViewBtn.addEventListener('click', closeViewModal);
  closeViewProfileBtn.addEventListener('click', closeViewModal);
  
  viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) closeViewModal();
  });

  // Check if URL has a shortcut action trigger (e.g. index quick task links)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'add') {
    setTimeout(() => {
      openStudentModal('add');
    }, 400);
  }
});

/**
 * Loads and renders the students list table based on active queries
 */
async function loadStudents(page) {
  currentPage = page;
  showLoader();

  const search = document.getElementById('search-student').value.trim();
  const dept = document.getElementById('filter-dept').value;
  const semester = document.getElementById('filter-semester').value;

  try {
    let endpoint = `/students?page=${page}&limit=${currentLimit}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (dept !== 'All') endpoint += `&department=${encodeURIComponent(dept)}`;
    if (semester !== 'All') endpoint += `&semester=${semester}`;

    const res = await api.get(endpoint);

    if (res.success) {
      renderStudentsTable(res.data);
      renderPagination(res.pagination);
    } else {
      showToast(res.message || 'Failed to fetch student registry.', 'error');
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
function renderStudentsTable(students) {
  const tbody = document.getElementById('tbody-students');
  tbody.innerHTML = '';

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px;">
          <div class="empty-state" style="margin: 0; border: none;">
            <div class="empty-state-icon"><i class="fas fa-user-friends"></i></div>
            <div class="empty-state-title">No Students Found</div>
            <div class="empty-state-desc">Try modifying your department, semester, or search filter queries.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  students.forEach(st => {
    const row = document.createElement('tr');
    
    // Get Initials for Avatar Icon inside Row
    const rowInitials = st.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    row.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background-color: var(--primary-light); color: var(--primary); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; font-family: 'Outfit'; border: 1.5px solid var(--primary);">${rowInitials}</div>
          <div>
            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${st.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${st.email}</div>
          </div>
        </div>
      </td>
      <td style="font-weight: 600; letter-spacing: 0.5px; font-family: 'Outfit'; font-size: 13px; color: var(--text-secondary);">${st.usn}</td>
      <td>
        <span class="department-badge">${st.department}</span>
      </td>
      <td style="font-weight: 600; text-align: center; padding-right: 40px;">${st.semester}</td>
      <td style="color: var(--text-secondary); font-size: 13px;">${st.phone}</td>
      <td style="text-align: right;">
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-icon view-btn" onclick="viewStudentProfile(${st.id})" title="View Complete Profile"><i class="fas fa-eye"></i></button>
          <button class="btn-icon edit-btn" onclick="openStudentModal('edit', ${st.id})" title="Edit Student Record"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete-btn" onclick="deleteStudent(${st.id}, '${st.name}')" title="Delete Student Record"><i class="fas fa-trash-alt"></i></button>
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

  summary.innerText = `Showing ${start} to ${end} of ${meta.total} students`;
  controls.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = meta.page === 1;
  prevBtn.addEventListener('click', () => loadStudents(meta.page - 1));
  controls.appendChild(prevBtn);

  // Direct Page Buttons
  for (let i = 1; i <= meta.totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${meta.page === i ? 'active' : ''}`;
    pageBtn.innerText = i;
    pageBtn.addEventListener('click', () => loadStudents(i));
    controls.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = meta.page === meta.totalPages || meta.totalPages === 0;
  nextBtn.addEventListener('click', () => loadStudents(meta.page + 1));
  controls.appendChild(nextBtn);
}

/**
 * Opens Add or Edit Modals, resetting fields or pulling student info
 */
async function openStudentModal(mode, studentId = null) {
  const modal = document.getElementById('student-form-modal');
  const title = document.getElementById('student-modal-title');
  const helperNote = document.getElementById('login-helper-note');
  const usnInput = document.getElementById('student-usn');
  const emailInput = document.getElementById('student-email');

  if (mode === 'add') {
    title.innerText = 'Add New Student Record';
    helperNote.style.display = 'block';
    usnInput.disabled = false;
    emailInput.disabled = false;
    
    // Clear and Show Modal
    document.getElementById('form-student-data').reset();
    document.getElementById('student-id-field').value = '';
    modal.classList.add('show');
  } else if (mode === 'edit' && studentId) {
    title.innerText = 'Edit Student Details';
    helperNote.style.display = 'none'; // Users already created
    
    showLoader();
    try {
      const res = await api.get(`/students/${studentId}`);
      if (res.success) {
        const st = res.data;
        document.getElementById('student-id-field').value = st.id;
        document.getElementById('student-name').value = st.name;
        usnInput.value = st.usn;
        document.getElementById('student-dept').value = st.department;
        document.getElementById('student-semester').value = st.semester;
        emailInput.value = st.email;
        document.getElementById('student-phone').value = st.phone;

        // Block changing critical indices during edit to avoid log disconnects
        usnInput.disabled = true;
        emailInput.disabled = true;

        modal.classList.add('show');
      } else {
        showToast('Failed to fetch student record.', 'error');
      }
    } catch (error) {
      showToast(error.message || 'Error pulling student details.', 'error');
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

  const id = document.getElementById('student-id-field').value;
  const name = document.getElementById('student-name').value.trim();
  const usn = document.getElementById('student-usn').value.trim();
  const dept = document.getElementById('student-dept').value;
  const semester = document.getElementById('student-semester').value;
  const email = document.getElementById('student-email').value.trim();
  const phone = document.getElementById('student-phone').value.trim();

  const payload = { name, usn, department: dept, semester, email, phone };

  showLoader();
  try {
    let res;
    if (id) {
      // Put Editing. We re-attach disabled fields to satisfy Express validators
      payload.usn = usn; 
      payload.email = email;
      res = await api.put(`/students/${id}`, payload);
    } else {
      // Post Adding
      res = await api.post('/students', payload);
    }

    if (res.success) {
      showToast(res.message, 'success');
      document.getElementById('student-form-modal').classList.remove('show');
      document.getElementById('form-student-data').reset();
      loadStudents(id ? currentPage : 1);
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
 * Invokes stylized confirmation and executes student deletion
 */
function deleteStudent(id, name) {
  showConfirm(
    'Wipe Student Record?',
    `Are you sure you want to completely delete <b>${name}</b>?<br><br><span style="color: var(--danger); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Warning:</span> This operation is permanent. It will instantly delete their system login account and wipe all course registrations.`,
    async () => {
      showLoader();
      try {
        const res = await api.delete(`/students/${id}`);
        if (res.success) {
          showToast(res.message, 'success');
          loadStudents(1);
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

/**
 * Combined Profile Viewer details + Enrolled list generator
 */
async function viewStudentProfile(studentId) {
  showLoader();
  try {
    // 1. Parallel requests to student profile + their registration list
    const [profileRes, regRes] = await Promise.all([
      api.get(`/students/${studentId}`),
      api.get(`/registrations/student/${studentId}`)
    ]);

    if (profileRes.success && regRes.success) {
      const st = profileRes.data;
      const regs = regRes.data;

      // Update Header Avatar Initials
      const initials = st.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      document.getElementById('view-avatar-initials').innerText = initials;

      // Update Text Fields
      document.getElementById('view-student-name').innerText = st.name;
      document.getElementById('view-student-usn').innerText = st.usn;
      document.getElementById('view-student-dept').innerText = st.department;
      document.getElementById('view-student-sem').innerText = `${st.semester}th Semester`;
      document.getElementById('view-student-email').innerText = st.email;
      document.getElementById('view-student-phone').innerText = st.phone;

      // Update Enrollment badge
      document.getElementById('view-subjects-count').innerText = `${regs.length} Subject(s) Enrolled`;

      // Update Registrations select lists
      const regList = document.getElementById('view-registered-list');
      regList.innerHTML = '';

      if (regs.length === 0) {
        regList.innerHTML = `<p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 12px 0;"><i class="far fa-calendar-times" style="margin-right: 4px;"></i> No subjects registered yet.</p>`;
      } else {
        regs.forEach(r => {
          const pill = document.createElement('div');
          pill.className = 'selected-pill';
          pill.style.borderLeft = '3px solid var(--primary)';
          pill.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${r.name}</span>
              <span style="font-size: 10px; color: var(--text-secondary); font-weight: 500;">Code: ${r.code} | Credits: ${r.credits}</span>
            </div>
          `;
          regList.appendChild(pill);
        });
      }

      // Show Modal
      document.getElementById('student-view-modal').classList.add('show');
    } else {
      showToast('Failed to pull student profile details.', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error pulling student credentials.', 'error');
  } finally {
    hideLoader();
  }
}
