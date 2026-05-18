/* ==========================================================================
   DASHBOARD CONTROLLER - METRIC RENDERING & LOG INTERPRETER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Ensure authentication
  const currentUser = checkAuth();
  if (!currentUser) return;

  // Initialize Page Data
  initializeDashboard(currentUser);
});

async function initializeDashboard(user) {
  // 1. Personalize Dashboard Greetings
  document.getElementById('dashboard-welcome').innerText = `Hello, ${user.name}`;
  
  if (user.role === 'admin') {
    document.getElementById('dashboard-welcome-sub').innerText = 'System is online. Here is an overview of today\'s academic operations.';
  } else {
    document.getElementById('dashboard-welcome-sub').innerText = `USN: ${user.usn} | Semester ${user.studentDetails ? user.studentDetails.semester : '6'} | CS Department`;
  }

  // 2. Load Dashboard Statistics & Recent Logs
  showLoader();
  try {
    const data = await api.get('/dashboard/stats');
    if (data.success) {
      renderStats(data.stats, user);
      renderRecentActivity(data.recentActivity);
      renderQuickTasks(user);
    } else {
      showToast('Failed to load stats data.', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error connecting to statistics server.', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Renders Stat Counters onto Dashboard Top Cards
 */
function renderStats(stats, user) {
  document.getElementById('card-total-students').innerText = stats.totalStudents;
  document.getElementById('card-total-subjects').innerText = stats.totalSubjects;

  const enrollmentValueCard = document.getElementById('card-total-registrations');
  const enrollmentLabel = enrollmentValueCard.previousElementSibling;

  if (user.role === 'admin') {
    enrollmentValueCard.innerText = stats.totalRegistrations;
    document.getElementById('btn-view-history').style.display = 'inline-flex';
  } else {
    // If student, customize the card to show their personal registrations
    enrollmentValueCard.innerText = stats.personalRegisteredCount;
    enrollmentLabel.innerText = 'My Registered Subjects';
    document.getElementById('btn-view-history').style.display = 'none'; // Hide history to students
  }
}

/**
 * Renders the 5 most recent activity logs in a clean, human-readable format
 */
function renderRecentActivity(activities) {
  const tbody = document.getElementById('tbody-recent-activity');
  tbody.innerHTML = '';

  if (activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 30px;">
          <div style="font-size: 32px; margin-bottom: 8px;"><i class="far fa-folder-open"></i></div>
          No recent system activities found.
        </td>
      </tr>
    `;
    return;
  }

  activities.forEach(act => {
    // Determine badge and clean type
    let badgeClass = 'added';
    if (act.action_type.includes('Modified') || act.action_type.includes('Updated')) badgeClass = 'modified';
    if (act.action_type.includes('Deleted')) badgeClass = 'deleted';

    const cleanActionName = act.action_type.replace('Subject Registration', 'Enrollment');
    const badgeHtml = `<span class="history-badge ${badgeClass}">${cleanActionName}</span>`;

    // Make dates look gorgeous
    const actionDate = new Date(act.action_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Clean times
    const timeParts = act.action_time.split(':');
    const formattedTime = `${timeParts[0]}:${timeParts[1]}`;

    // Decode changes in a beautiful human-readable way
    const description = decodeHistoryChanges(act);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight: 500;">
        <div>${actionDate}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">${formattedTime}</div>
      </td>
      <td>
        <div style="font-weight: 600;">${act.student_name}</div>
      </td>
      <td>${badgeHtml}</td>
      <td style="max-width: 320px; font-size: 13px; color: var(--text-secondary);">
        ${description}
      </td>
    `;
    tbody.appendChild(row);
  });
}

/**
 * Decodes previous and new value JSON logs into high-quality descriptive sentences
 */
function decodeHistoryChanges(log) {
  try {
    const prev = log.previous_value ? JSON.parse(log.previous_value) : null;
    const next = log.new_value ? JSON.parse(log.new_value) : null;

    if (log.action_type === 'Student Added' && next) {
      return `Added student <b>${next.name}</b> (${next.usn}) in <b>${next.department}</b> department.`;
    }
    
    if (log.action_type === 'Student Modified' && prev && next) {
      const changes = [];
      if (prev.semester !== next.semester) changes.push(`semester shifted to ${next.semester}`);
      if (prev.department !== next.department) changes.push(`dept changed to ${next.department}`);
      if (prev.phone !== next.phone) changes.push(`phone updated`);
      if (prev.email !== next.email) changes.push(`email updated`);
      return `Modified details for <b>${next.name}</b> (${changes.join(', ') || 'personal data profile'}).`;
    }

    if (log.action_type === 'Student Deleted' && prev) {
      return `Deleted student profile for <b>${prev.name}</b> (${prev.usn}) and closed their login account.`;
    }

    if (log.action_type === 'Subject Added' && next) {
      return `Added subject <b>${next.name}</b> (Code: <b>${next.code}</b>, Credits: <b>${next.credits}</b>).`;
    }

    if (log.action_type === 'Subject Modified' && prev && next) {
      const changes = [];
      if (prev.name !== next.name) changes.push(`name to '${next.name}'`);
      if (prev.credits !== next.credits) changes.push(`credits to ${next.credits}`);
      return `Updated subject <b>${next.code}</b> (${changes.join(', ')}).`;
    }

    if (log.action_type === 'Subject Deleted' && prev) {
      return `Deleted subject catalog entry <b>${prev.name}</b> (${prev.code}).`;
    }

    if (log.action_type === 'Subject Registration Added' && next) {
      return `Enrolled in <b>${next.registeredCount}</b> subject(s): ${next.subjects.map(s => s.code).join(', ')}.`;
    }

    if (log.action_type === 'Subject Registration Modified' && prev && next) {
      return `Modified selection from <b>${prev.registeredCount}</b> to <b>${next.registeredCount}</b> subjects.`;
    }

    if (log.action_type === 'Subject Registration Deleted' && prev) {
      return `Unregistered from subject <b>${prev.name}</b> (Code: <b>${prev.code}</b>).`;
    }

    return `System event logged. Details captured in history log.`;
  } catch (e) {
    return `Completed operation on student records.`;
  }
}

/**
 * Renders Quick Tasks action links depending on user's access role
 */
function renderQuickTasks(user) {
  const container = document.getElementById('quick-tasks-container');
  container.innerHTML = '';

  if (user.role === 'admin') {
    container.innerHTML = `
      <a href="students.html?action=add" class="btn btn-primary" style="text-align: left; justify-content: flex-start; padding: 14px;">
        <i class="fas fa-user-plus" style="width: 20px;"></i> Add New Student
      </a>
      <a href="subjects.html?action=add" class="btn btn-secondary" style="text-align: left; justify-content: flex-start; padding: 14px;">
        <i class="fas fa-plus-circle" style="width: 20px;"></i> Add New Subject
      </a>
      <a href="history.html" class="btn btn-secondary" style="text-align: left; justify-content: flex-start; padding: 14px;">
        <i class="fas fa-history" style="width: 20px;"></i> View Activity Logs
      </a>
    `;
  } else {
    container.innerHTML = `
      <a href="register.html" class="btn btn-primary" style="text-align: left; justify-content: flex-start; padding: 14px;">
        <i class="fas fa-edit" style="width: 20px;"></i> Register My Subjects
      </a>
      <a href="register.html" class="btn btn-secondary" style="text-align: left; justify-content: flex-start; padding: 14px;">
        <i class="fas fa-clipboard-list" style="width: 20px;"></i> View Enrolled Subjects
      </a>
    `;
  }
}
