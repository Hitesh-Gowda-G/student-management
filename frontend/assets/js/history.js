/* ==========================================================================
   HISTORY AUDIT LOG CONTROLLER - COMPARISONS & MEMORY FILTER
   ========================================================================== */

let historyLogs = [];

document.addEventListener('DOMContentLoaded', () => {
  // Ensure authentication
  const currentUser = checkAuth();
  if (!currentUser || currentUser.role !== 'admin') {
    // Restrict students from directly accessing this admin History page
    window.location.href = 'index.html';
    return;
  }

  // 1. Initial Data Load
  loadHistoryLogs();

  // 2. Bind Refresh Button
  document.getElementById('btn-refresh-history').addEventListener('click', loadHistoryLogs);

  // 3. Bind Instant Filter
  document.getElementById('search-history').addEventListener('input', filterHistoryLogs);
});

/**
 * Loads history records from DB and stores in local cache
 */
async function loadHistoryLogs() {
  showLoader();
  try {
    const res = await api.get('/history');
    if (res.success) {
      historyLogs = res.data;
      renderHistoryTable(historyLogs);
    } else {
      showToast(res.message || 'Failed to fetch history logs.', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error connecting to database servers.', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Renders audit table rows
 */
function renderHistoryTable(logs) {
  const tbody = document.getElementById('tbody-history');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 48px;">
          <div class="empty-state" style="margin: 0; border: none;">
            <div class="empty-state-icon"><i class="fas fa-history"></i></div>
            <div class="empty-state-title">No Audit Logs Found</div>
            <div class="empty-state-desc">There are no registered system activity logs recorded.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  logs.forEach(log => {
    // Determine Color badges
    let badgeClass = 'added';
    if (log.action_type.includes('Modified') || log.action_type.includes('Updated')) badgeClass = 'modified';
    if (log.action_type.includes('Deleted')) badgeClass = 'deleted';

    const badgeHtml = `<span class="history-badge ${badgeClass}">${log.action_type}</span>`;

    // Format Dates
    const actionDate = new Date(log.action_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const timeParts = log.action_time.split(':');
    const formattedTime = `${timeParts[0]}:${timeParts[1]}`;

    // Get Beautiful Human-Readable Description + Value Comparisons
    const detailsHtml = generateValueComparisonHtml(log);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight: 500;">
        <div style="font-size: 14px; color: var(--text-primary);">${actionDate}</div>
        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;"><i class="far fa-clock" style="margin-right: 4px;"></i>${formattedTime}</div>
      </td>
      <td>
        <div style="font-weight: 700; color: var(--text-primary);">${log.student_name}</div>
      </td>
      <td>${badgeHtml}</td>
      <td style="font-size: 13.5px; line-height: 1.6;">
        ${detailsHtml}
      </td>
    `;
    tbody.appendChild(row);
  });
}

/**
 * Memory-based instant filtering of logs based on keywords
 */
function filterHistoryLogs() {
  const keyword = document.getElementById('search-history').value.toLowerCase().trim();
  
  if (!keyword) {
    renderHistoryTable(historyLogs);
    return;
  }

  const filtered = historyLogs.filter(log => {
    const initiator = log.student_name.toLowerCase();
    const type = log.action_type.toLowerCase();
    
    // Check Date format
    const actionDate = new Date(log.action_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();

    return initiator.includes(keyword) || type.includes(keyword) || actionDate.includes(keyword);
  });

  renderHistoryTable(filtered);
}

/**
 * Evaluates log contents and compares raw before/after JSON structures
 */
function generateValueComparisonHtml(log) {
  try {
    const prev = log.previous_value ? JSON.parse(log.previous_value) : null;
    const next = log.new_value ? JSON.parse(log.new_value) : null;

    // Student Addition
    if (log.action_type === 'Student Added' && next) {
      return `
        <div>Added student record: <b style="color: var(--text-primary);">${next.name}</b> (USN: <b>${next.usn}</b>).</div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; background: var(--bg-primary); padding: 4px 8px; border-radius: 4px;">
          Dept: ${next.department} | Sem: ${next.semester} | Email: ${next.email} | Phone: ${next.phone}
        </div>
      `;
    }

    // Student Deletion
    if (log.action_type === 'Student Deleted' && prev) {
      return `
        <div style="color: #ef4444;">Wiped student record: <b>${prev.name}</b> (USN: <b>${prev.usn}</b>) from DB.</div>
      `;
    }

    // Student Modification (Show Before -> After changes)
    if (log.action_type === 'Student Modified' && prev && next) {
      const diffs = [];
      if (prev.name !== next.name) diffs.push(`Name: <s>${prev.name}</s> → <b>${next.name}</b>`);
      if (prev.department !== next.department) diffs.push(`Dept: <s>${prev.department}</s> → <b>${next.department}</b>`);
      if (prev.semester !== next.semester) diffs.push(`Sem: <s>${prev.semester}</s> → <b>${next.semester}</b>`);
      if (prev.phone !== next.phone) diffs.push(`Phone: <s>${prev.phone}</s> → <b>${next.phone}</b>`);
      if (prev.email !== next.email) diffs.push(`Email: <s>${prev.email}</s> → <b>${next.email}</b>`);

      return `
        <div>Updated credentials for student <b>${next.name}</b>.</div>
        <div style="font-size: 12px; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; background-color: var(--warning-light); padding: 6px 12px; border-radius: 6px; border-left: 3px solid var(--warning);">
          ${diffs.join('<br>') || '<i>No changes detected. Profile synchronized.</i>'}
        </div>
      `;
    }

    // Subject Addition
    if (log.action_type === 'Subject Added' && next) {
      return `
        <div>Added subject <b>${next.name}</b> (Code: <b style="color: var(--primary);">${next.code}</b>, Credits: <b>${next.credits}</b>).</div>
      `;
    }

    // Subject Deletion
    if (log.action_type === 'Subject Deleted' && prev) {
      return `
        <div style="color: #ef4444;">Wiped subject <b>${prev.name}</b> (Code: <b>${prev.code}</b>) from catalog.</div>
      `;
    }

    // Subject Modification
    if (log.action_type === 'Subject Modified' && prev && next) {
      const diffs = [];
      if (prev.name !== next.name) diffs.push(`Name: <s>${prev.name}</s> → <b>${next.name}</b>`);
      if (prev.credits !== next.credits) diffs.push(`Credits: <s>${prev.credits}</s> → <b>${next.credits}</b>`);

      return `
        <div>Modified details for subject <b style="color: var(--primary);">${next.code}</b>.</div>
        <div style="font-size: 12px; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; background-color: var(--warning-light); padding: 6px 12px; border-radius: 6px; border-left: 3px solid var(--warning);">
          ${diffs.join('<br>')}
        </div>
      `;
    }

    // Registration Added
    if (log.action_type === 'Subject Registration Added' && next) {
      return `
        <div>Registered student for <b>${next.registeredCount}</b> subject(s).</div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; background-color: var(--bg-primary); padding: 4px 8px; border-radius: 4px;">
          Enrolled codes: ${next.subjects.map(s => s.code).join(', ')}
        </div>
      `;
    }

    // Registration Modified
    if (log.action_type === 'Subject Registration Modified' && prev && next) {
      const prevCodes = prev.subjects.map(s => s.code).join(', ') || 'None';
      const nextCodes = next.subjects.map(s => s.code).join(', ') || 'None';

      return `
        <div>Modified registrations selection.</div>
        <div style="font-size: 12px; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; background-color: var(--warning-light); padding: 6px 12px; border-radius: 6px; border-left: 3px solid var(--warning);">
          Before: <s>${prevCodes}</s> (${prev.registeredCount} subjects)<br>
          After: <b>${nextCodes}</b> (${next.registeredCount} subjects)
        </div>
      `;
    }

    // Registration Deleted
    if (log.action_type === 'Subject Registration Deleted' && prev) {
      return `
        <div>Dropped course enrollment: <b>${prev.name}</b> (Code: <b>${prev.code}</b>).</div>
      `;
    }

    return `Operation completed. Parameters logged successfully.`;
  } catch (e) {
    return `Logs detail extraction completed successfully.`;
  }
}
