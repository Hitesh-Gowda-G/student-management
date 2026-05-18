// DYNAMIC API BASE URL RESOLVER
const API_BASE_URL = (() => {
  // If running locally or opening raw HTML files directly in the browser
  if (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.protocol === 'file:'
  ) {
    return 'http://localhost:5000/api';
  }
  // Otherwise, point to the live Render backend
  // Note: During deploy, user can replace this with their actual Render service endpoint URL
  return 'https://student-management-backend-jf02.onrender.com/api';
})();

/**
 * Standard HTTP Fetch Request client with token handling.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Inject active session token if present
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    // Catch authorization or token expiration failures
    if (response.status === 401 || (response.status === 403 && data.message && data.message.includes('token'))) {
      console.warn('Session expired or unauthorized. Logging out...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Prevent redirect loop if already on login page
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, error.message);
    throw error;
  }
}

// Centralized REST API endpoints caller
const api = {
  get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),
  
  post: (endpoint, body) => apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  
  put: (endpoint, body) => apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  }),
  
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' })
};

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch (e) {
    window.location.href = 'login.html';
    return null;
  }
}

// Retrieve active user details
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}
