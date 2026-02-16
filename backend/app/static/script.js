const statuses = ["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"];

async function loadTasks() {
    const res = await fetch("/tasks");
    const tasks = await res.json();

    renderStats(tasks);
    renderBoard(tasks);
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
            <div class="card task-card" draggable="true"
                ondragstart="drag(event)"
                id="${task.id}">
                <div class="card-body">
                    <h6>${task.title}</h6>
                    <p class="small">${task.description || ""}</p>
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

function drag(ev) { ev.dataTransfer.setData("id", ev.target.id); }

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

    if (!title) return;

    await fetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority })
    });

    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDesc").value = "";

    loadTasks();
}

loadTasks();

