const statuses = ["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"];

let currentFilter = "ALL";
let allTasks = [];
let currentSort = "NONE";

async function loadTasks() {
    const res = await fetch("/tasks");
    allTasks = await res.json();

    applyFilter();
}

// function applyFilter() {
//     let filteredTasks = allTasks;

//     if (currentFilter !== "ALL") {
//         filteredTasks = allTasks.filter(t => t.status === currentFilter);
//     }

//     renderStats(filteredTasks);
//     renderBoard(filteredTasks);
// }

function applyFilter() {
    let filteredTasks = [...allTasks];

    // Apply filter
    if (currentFilter !== "ALL") {
        filteredTasks = filteredTasks.filter(t => t.status === currentFilter);
    }

    // Apply sorting
    if (currentSort === "DUE_ASC") {
        filteredTasks.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
    }

    if (currentSort === "DUE_DESC") {
        filteredTasks.sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
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
        headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, priority, due_date })
        });
        editingTaskId = null;
    } else {
        await fetch("/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    const res = await fetch("/tasks");
    const tasks = await res.json();
    const task = tasks.find(t => t.id === id);

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
        method: "DELETE"
    });

    loadTasks();
}

loadTasks();

