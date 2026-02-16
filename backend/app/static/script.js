const statuses = ["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"];

let currentFilter = "ALL";
let allTasks = [];
let currentSort = "NONE";
let token = localStorage.getItem("token");

function showApp() {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
}

function showLogin() {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("appSection").style.display = "none";
}

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");

    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDark);

    const btn = document.getElementById("themeToggle");
    btn.innerText = isDark ? "☀ Light Mode" : "🌙 Dark Mode";
}

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
    });

    if (!res.ok) {
        alert("Invalid credentials");
        return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    token = data.access_token;

    showApp();
    loadTasks();
}

async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
        alert("Registration failed");
        return;
    }

    alert("User created. Please login.");
}

async function loadTasks() {

    // 🔒 Prevent API call if no token
    if (!token) {
        showLogin();
        return;
    }

    const res = await fetch("/tasks", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    // 🔐 Auto logout if token expired
    if (res.status === 401) {
        logout();
        return;
    }

    allTasks = await res.json();
    applyFilter();
}

function applyFilter() {
    let filteredTasks = [...allTasks];

    // Apply filter
    if (currentFilter !== "ALL") {
        filteredTasks = filteredTasks.filter(t => t.status === currentFilter);
    }

    // Apply sorting
    if (currentSort === "DUE_ASC") {
        filteredTasks.sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date.localeCompare(b.due_date);
        });
    }

    if (currentSort === "DUE_DESC") {
        filteredTasks.sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return b.due_date.localeCompare(a.due_date);
        });
    }

    if (currentSort === "PRIORITY_HIGH") {
        const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        filteredTasks.sort((a, b) => order[b.priority] - order[a.priority]);
    }

    if (currentSort === "PRIORITY_LOW") {
        const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        filteredTasks.sort((a, b) => order[a.priority] - order[b.priority]);
    }

    renderStats(filteredTasks);
    renderBoard(filteredTasks);
}

function setSort(value) {
    currentSort = value;
    applyFilter();
}

function setFilter(status) {
    currentFilter = status;
    applyFilter();
}

function renderStats(tasks) {
    const statsRow = document.getElementById("statsRow");
    statsRow.innerHTML = "";

    statuses.forEach(status => {
        const count = tasks.filter(t => t.status === status).length;

        statsRow.innerHTML += `
            <div class="col-md-3">
                <div class="stat-card ${status}">
                    <h5>${status.replace("_", " ")}</h5>
                    <h3>${count}</h3>
                </div>
            </div>
        `;
    });
}

function renderBoard(tasks) {
    const board = document.getElementById("board");
    board.innerHTML = "";

    statuses.forEach(status => {
        board.innerHTML += `
            <div class="col-md-3">
                <div class="status-title">${status.replace("_", " ")}</div>
                <div class="column" id="${status}"
                    ondrop="drop(event, '${status}')"
                    ondragover="allowDrop(event)">
                </div>
            </div>
        `;
    });

    tasks.forEach(task => {
        const priorityColor = getPriorityColor(task.priority);

        const card = `
            <div class="card task-card ${isOverdue(task) ? 'border-danger border-3' : ''}"
                draggable="true"
                ondragstart="drag(event)"
                onclick="editTask(${task.id})"
                id="${task.id}">
                <div class="card-body position-relative">

                    <!-- Delete Button -->
                    <button class="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-2"
                        onclick="deleteTask(event, ${task.id})">
                        ✕
                    </button>

                    <h6>${task.title}</h6>
                    <p class="small">${task.description || ""}</p>

                    ${task.due_date ? `<p class="small text-muted">Due: ${task.due_date}</p>` : ""}

                    <span class="badge bg-${priorityColor} priority-badge">
                        ${task.priority}
                    </span>
                </div>
            </div>
        `;

        document.getElementById(task.status).innerHTML += card;
    });
}

function getPriorityColor(priority) {
    if (priority === "HIGH") return "danger";
    if (priority === "MEDIUM") return "warning";
    return "secondary";
}

function allowDrop(ev) { ev.preventDefault(); }

function drag(ev) {
    const card = ev.target.closest(".task-card");
    if (!card) return;
    ev.dataTransfer.setData("id", card.id);
}

async function drop(ev, status) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("id");

    await fetch(`/tasks/${id}/status`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ status })
    });

    loadTasks();
}

async function createTask() {
    const title = document.getElementById("taskTitle").value;
    const description = document.getElementById("taskDesc").value;
    const priority = document.getElementById("taskPriority").value;
    const due_date = document.getElementById("taskDueDate").value;

    if (!title) return;

    if (editingTaskId) {
        await fetch(`/tasks/${editingTaskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ title, description, priority, due_date })
        });
        editingTaskId = null;
    } else {
        await fetch("/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ title, description, priority, due_date })
        });
    }

    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDesc").value = "";
    document.getElementById("taskDueDate").value = "";

    loadTasks();
}

function isOverdue(task) {
    if (!task.due_date || task.status === "CLOSED") return false;

    const today = new Date().toISOString().split("T")[0];
    return task.due_date < today;
}

let editingTaskId = null;

async function editTask(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;

    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDesc").value = task.description || "";
    document.getElementById("taskPriority").value = task.priority;
    document.getElementById("taskDueDate").value = task.due_date || "";

    const modal = new bootstrap.Modal(document.getElementById("taskModal"));
    modal.show();
}

async function deleteTask(event, id) {
    event.stopPropagation(); // Prevent opening edit modal

    const confirmDelete = confirm("Are you sure you want to delete this task?");
    if (!confirmDelete) return;

    await fetch(`/tasks/${id}`, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    loadTasks();
}

function applySavedTheme() {
    const saved = localStorage.getItem("darkMode");

    if (saved === "true") {
        document.body.classList.add("dark-mode");
        document.getElementById("themeToggle").innerText = "☀ Light Mode";
    }
}

function logout() {
    localStorage.removeItem("token");
    token = null;
    allTasks = [];
    document.getElementById("board").innerHTML = "";
    document.getElementById("statsRow").innerHTML = "";
    showLogin();
}

applySavedTheme();

if (token) {
    showApp();
    loadTasks();
} else {
    showLogin();
}
