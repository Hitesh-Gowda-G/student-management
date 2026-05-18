# SSIT Student Management System (Full-Stack Portal)

A complete, high-end, responsive full-stack **Student Management System** with beautiful Glassmorphic layouts, dynamic Light/Dark mode transitions, complete Student & Subject CRUD operations, a reactive Subject Registration module, and a detailed audit Activity History log.

## Tech Stack
* **Frontend**: HTML5, CSS3 (Premium custom styling with HSL tokens, transitions, and drawer panels), and JavaScript (ES6 with AJAX Fetch APIs).
* **Backend**: Node.js + Express.js API.
* **Database**: Neon Cloud PostgreSQL (relational integrity, cascading deletes, and unique constraint validations).
* **Hosting**: Configured for instant deployment on **Netlify** (Frontend) and **Render** (Backend).

---

## 🚀 Live Demo & Default Logins

Once the database is seeded and the servers are booted, test the systems using these credentials:

| Account Role | Username / Email | Password | Linked Target |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@ssit.edu` | `Admin@123` | Master System Access |
| **Student** | `student@ssit.edu` | `Student@123` | `Jane Doe` (USN: `1SI22CS001`) |

*Note: For newly added students, their portal logins are automatically created, and their default passwords are set to their **USN in uppercase**.*

---

## 🛠️ Local Development Setup

### 1. Clone the repository and navigate inside:
```bash
cd STUDENT-MANAGEMENT
```

### 2. Configure Database Environment Variables
Create a `.env` file inside the `backend/` folder:
```bash
# backend/.env
PORT=5000
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```
*(A pre-configured Neon cloud database connection has already been placed in your active `backend/.env` for convenience!)*

### 3. Install dependencies and run the Database Seeder
The project includes a root-level orchestrator. Simply run the seeder script from the workspace root to build tables and seed defaults:
```bash
# Installs backend node_modules and seeds database
npm install
npm run seed
```

### 4. Start the backend local development server
```bash
npm run backend-dev
```
The server will boot up at: `http://localhost:5000`

### 5. Launch the Frontend
Since the frontend consists of static files (`.html`, `.css`, `.js`), simply double-click and open `frontend/login.html` in your browser, or serve it using any local server extension (like Live Server in VS Code). 

*Note: The frontend `assets/js/api.js` client is pre-wired to automatically talk to `http://localhost:5000/api` when running on `localhost`.*

---

## ☁️ Cloud Deployments

### 1. Frontend Hosting: Netlify
Deploying the static UI is completely automated:
1. Connect your GitHub repository to **Netlify**.
2. Select the repository.
3. Netlify will read the root `netlify.toml` file automatically and configure the build settings (`publish = "frontend"`).
4. Click **Deploy Site**. That's it!

### 2. Backend Hosting: Render
To deploy the REST APIs:
1. Connect your repository to **Render** and create a new **Web Service**.
2. Render will read the root `package.json` file. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
3. In the service's **Environment** tab, define your production keys:
   - `DATABASE_URL` = *Your Neon PostgreSQL connection string*
   - `JWT_SECRET` = *A strong random password secret key*
   - `NODE_ENV` = `production`
4. Click **Deploy Web Service**.

*Once Render assigns you a live backend URL (e.g. `https://your-service.onrender.com`), open `frontend/assets/js/api.js` and update the production URL fallback at the top of the file!*

---

## 📂 Repository Structure

```
STUDENT-MANAGEMENT/
├── backend/
│   ├── config/db.js          # Neon pool config
│   ├── middleware/auth.js    # JWT & Role authorization guards
│   ├── routes/               # API Router mount points
│   ├── controllers/          # CRUD & Registration logic
│   ├── database/
│   │   ├── schema.sql        # Tables schema
│   │   └── seed.js           # Seeder script
│   └── server.js             # Entry point
├── frontend/
│   ├── assets/
│   │   ├── css/style.css     # Premium UI theme and Dark Mode definitions
│   │   └── js/
│   │       ├── api.js        # Dynamic Fetch client
│   │       ├── ui.js         # Dialogs, Toasts, Drawer, and Theme manager
│   │       ├── dashboard.js  # Dashboard metrics logic
│   │       ├── students.js   # Student CRUD logic
│   │       ├── subjects.js   # Subject CRUD logic
│   │       ├── registration.js # Reg Portal selection mechanics
│   │       └── history.js    # Audit trail details
│   ├── login.html
│   ├── index.html            # Dashboard UI
│   ├── students.html         # Students CRUD
│   ├── subjects.html         # Subjects CRUD
│   ├── register.html         # Subject Registration portal
│   └── history.html          # History Audit logs
├── netlify.toml              # Netlify publication instructions
└── package.json              # Render install script orchestrator
```
