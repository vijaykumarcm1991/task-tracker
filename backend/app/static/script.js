const statuses = ["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"];

async function loadTasks() {
    const res = await fetch("/tasks");
    const tasks = await res.json();

    const board = document.getElementById("board");
    board.innerHTML = "";

    statuses.forEach(status => {
        const col = document.createElement("div");
        col.className = "col-md-3";
        col.innerHTML = `
            <h5>${status}</h5>
            <div class="column" 
                ondrop="drop(event, '${status}')" 
                ondragover="allowDrop(event)" 
                id="${status}">
            </div>
        `;
        board.appendChild(col);
    });

    tasks.forEach(task => {
        const card = document.createElement("div");
        card.className = "card task-card";
        card.draggable = true;
        card.id = task.id;
        card.ondragstart = drag;

        card.innerHTML = `
            <div class="card-body">
                <h6>${task.title}</h6>
                <small>${task.priority}</small>
            </div>
        `;

        document.getElementById(task.status).appendChild(card);
    });
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

async function showAddModal() {
    const title = prompt("Task title:");
    if (!title) return;

    await fetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
    });

    loadTasks();
}

loadTasks();

