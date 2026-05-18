/* ==========================================================================
   GLOBAL UI CONTROLLER - SYSTEM TEMPLATES & DIALOGS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Layout Shell Injection
  injectShellTemplate();

  // 2. Initialize Dark Mode Theme State
  initializeTheme();
});

/**
 * Dynamically injects the premium Sidebar and Top Navigation headers
 * to prevent boilerplate replication and keep navigation DRY.
 */
function injectShellTemplate() {
  const shellContainer = document.getElementById('app-shell');
  if (!shellContainer) return; // Not an app layout page (e.g. login.html)

  const currentUser = checkAuth();
  if (!currentUser) return;

  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const role = currentUser.role;

  // Build Sidebar Items based on User Role
  let navItemsHtml = `
    <a href="index.html" class="nav-item ${currentFile === 'index.html' ? 'active' : ''}">
      <i class="fas fa-chart-pie"></i>
      <span>Dashboard</span>
    </a>
  `;

  if (role === 'admin') {
    navItemsHtml += `
      <a href="students.html" class="nav-item ${currentFile === 'students.html' ? 'active' : ''}">
        <i class="fas fa-user-graduate"></i>
        <span>Students</span>
      </a>
      <a href="subjects.html" class="nav-item ${currentFile === 'subjects.html' ? 'active' : ''}">
        <i class="fas fa-book-open"></i>
        <span>Subjects</span>
      </a>
      <a href="history.html" class="nav-item ${currentFile === 'history.html' ? 'active' : ''}">
        <i class="fas fa-history"></i>
        <span>Activity History</span>
      </a>
    `;
  } else if (role === 'student') {
    navItemsHtml += `
      <a href="register.html" class="nav-item ${currentFile === 'register.html' ? 'active' : ''}">
        <i class="fas fa-edit"></i>
        <span>Register Subjects</span>
      </a>
    `;
  }

  // Get User Initials
  const initials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';

  // Master Shell Shell Frame structure
  const shellHtml = `
    <div class="app-container">
      <!-- SIDEBAR GRID PANEL -->
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">S</div>
          <span class="sidebar-title">SSIT PORTAL</span>
        </div>
        
        <nav class="sidebar-nav">
          ${navItemsHtml}
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" id="btn-logout">
            <i class="fas fa-sign-out-alt"></i>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <!-- MAIN PAGE VIEWPORT -->
      <main class="main-content">
        <!-- TOP NAVIGATION BAR -->
        <header class="top-nav">
          <div class="nav-left">
            <button class="menu-toggle" id="btn-menu-toggle">
              <i class="fas fa-bars"></i>
            </button>
            
            <div class="search-bar-wrapper">
              <i class="fas fa-search"></i>
              <input type="text" placeholder="Search operations..." class="search-bar" id="global-search-bar" disabled>
            </div>
          </div>

          <div class="nav-right">
            <!-- Theme Toggle -->
            <button class="theme-toggle" id="btn-theme-toggle" title="Toggle Theme Mode">
              <i class="fas fa-moon" id="theme-icon"></i>
            </button>

            <!-- Notifications Bell -->
            <button class="notifications-bell" title="Alerts & Notifications">
              <i class="far fa-bell"></i>
              <span class="bell-badge"></span>
            </button>

            <!-- Profile Widget -->
            <div class="profile-widget" id="profile-trigger">
              <div class="profile-avatar">${initials}</div>
              <div class="profile-info">
                <span class="profile-name">${currentUser.name}</span>
                <span class="profile-role">${currentUser.role === 'admin' ? 'Administrator' : currentUser.usn}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Dynamic Inner Page Slot -->
        <div class="page-container" id="page-slot-content">
          ${shellContainer.innerHTML}
        </div>
      </main>
    </div>
  `;

  // Swap layout slot
  shellContainer.innerHTML = shellHtml;

  // Bind Shared Shell Action Events
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('btn-menu-toggle').addEventListener('click', toggleMobileSidebar);
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleThemeMode);
}

/* ==========================================================================
   SHELL BEHAVIOR ACTIONS
   ========================================================================== */

function handleLogout() {
  showConfirm('Confirm Logout', 'Are you sure you want to end your session?', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showToast('Session ended successfully.', 'success');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
  });
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('show');
  }
}

// Close mobile sidebar if user clicks outside of it
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('app-sidebar');
  const toggleBtn = document.getElementById('btn-menu-toggle');
  
  if (sidebar && sidebar.classList.contains('show') && toggleBtn) {
    if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
      sidebar.classList.remove('show');
    }
  }
});

/* ==========================================================================
   THEME MANAGER (DARK / LIGHT MODE)
   ========================================================================== */

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleThemeMode() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
  
  showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme mode activated.`, 'success');
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'dark') {
      icon.className = 'fas fa-sun';
    } else {
      icon.className = 'fas fa-moon';
    }
  }
}

/* ==========================================================================
   MODAL & TOAST COMPONENT ENGINES
   ========================================================================== */

// 1. DYNAMIC SPINNING LOADER SYSTEM
function showLoader() {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'loader-overlay';
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);
  }
  // Force layout reflow
  loader.getBoundingClientRect();
  loader.classList.add('show');
}

function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.remove('show');
  }
}

// 2. STYLIZED SLIDE-IN TOAST ALERT SYSTEM
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-box-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-box-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';

  toast.innerHTML = `
    <i class="fas ${iconClass} toast-icon"></i>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  // Trigger Slide-In
  setTimeout(() => {
    toast.classList.add('show');
  }, 50);

  // Auto-Dismiss Slide-Out after 3.5s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// 3. PREMIUM CONFIRMATION POPUP SYSTEM
function showConfirm(title, message, onConfirm) {
  // Clean pre-existing modals
  const existingConfirm = document.getElementById('confirm-modal-backdrop');
  if (existingConfirm) existingConfirm.remove();

  const modalHtml = `
    <div class="modal-backdrop" id="confirm-modal-backdrop">
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <i class="fas fa-times modal-close" id="btn-confirm-close"></i>
        </div>
        <div class="modal-body">
          <p style="font-size: 15px; color: var(--text-secondary); line-height: 1.6;">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-confirm-cancel">Cancel</button>
          <button class="btn btn-danger" id="btn-confirm-ok">Yes, Proceed</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const backdrop = document.getElementById('confirm-modal-backdrop');

  // Trigger Reflow and Slide
  setTimeout(() => {
    backdrop.classList.add('show');
  }, 50);

  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => {
      backdrop.remove();
    }, 250);
  };

  document.getElementById('btn-confirm-close').addEventListener('click', closeModal);
  document.getElementById('btn-confirm-cancel').addEventListener('click', closeModal);
  
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    closeModal();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  });
}
