const COL_ID_MAP = {
  'Backlog':        'col-backlog',
  'To Do':          'col-todo',
  'In Bearbeitung': 'col-inprogress',
  'Erledigt':       'col-done',
};
const COUNT_ID_MAP = {
  'Backlog':        'count-backlog',
  'To Do':          'count-todo',
  'In Bearbeitung': 'count-inprogress',
  'Erledigt':       'count-done',
};

let _dragCol = null;
let _dragIdx = null;
let _dragProjectId = null;
const _dropControllers = new Map();

// ---- Deadline-Status ----
function taskDeadlineStatus(dateRaw) {
  if (!dateRaw) return null;
  const days = Math.ceil((new Date(dateRaw) - new Date()) / 86400000);
  if (days < 0)   return { cls: 'deadline-overdue',  label: 'Abgelaufen' };
  if (days === 0) return { cls: 'deadline-overdue',  label: 'Heute fällig' };
  if (days === 1) return { cls: 'deadline-overdue',  label: 'Morgen fällig' };
  if (days <= 7)  return { cls: 'deadline-overdue',  label: `In ${days} Tagen` };
  if (days <= 14) return { cls: 'deadline-critical', label: `In ${days} Tagen` };
  return { cls: 'deadline-ok', label: `In ${days} Tagen` };
}

// ---- Gesamt-Board (alle Projekte, nach Deadline sortiert) ----
function renderAllBoard() {
  currentProjectId = null;
  document.getElementById('board-back-btn').style.display = 'none';

  const badge = document.querySelector('.board-header .project-type-badge');
  badge.className = 'project-type-badge tag-uni';
  badge.textContent = 'Alle';
  document.querySelector('.board-title').textContent = 'Alle Aufgaben';

  // Alle Tasks aller Projekte je Spalte sammeln
  const merged = {};
  Object.keys(COL_ID_MAP).forEach(col => { merged[col] = []; });

  projects.forEach(project => {
    const pt = tasks[project.id] || {};
    if (!TYPE_CONFIG[project.type]) return;
    Object.keys(COL_ID_MAP).forEach(col => {
      (pt[col] || []).forEach(task => {
        merged[col].push({ ...task, _projectId: project.id, _projectName: project.name });
      });
    });
  });

  // Nach Deadline sortieren (kein Datum → ans Ende)
  const sortByDeadline = arr => [...arr].sort((a, b) => {
    if (!a.deadlineRaw && !b.deadlineRaw) return 0;
    if (!a.deadlineRaw) return 1;
    if (!b.deadlineRaw) return -1;
    return new Date(a.deadlineRaw) - new Date(b.deadlineRaw);
  });

  Object.keys(COL_ID_MAP).forEach(col => {
    const colEl   = document.getElementById(COL_ID_MAP[col]);
    const countEl = document.getElementById(COUNT_ID_MAP[col]);
    colEl.innerHTML = '';
    const sorted = sortByDeadline(merged[col]);
    sorted.forEach((task, idx) => colEl.appendChild(buildAllTaskCard(task, col, idx)));
    if (countEl) countEl.textContent = sorted.length;
    wireDropZone(colEl.closest('.kanban-col') || colEl, col);
  });
}

function buildAllTaskCard(task, col, idx) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.dataset.col = col;
  card.dataset.idx = idx;
  card.dataset.projectId = task._projectId;
  if (task.done) card.style.opacity = '0.5';

  const titleStyle = task.done ? 'style="text-decoration:line-through"' : '';
  const ds = taskDeadlineStatus(task.deadlineRaw);
  const dateDisplay = ds
    ? `<span class="task-deadline ${ds.cls}">${ds.label}</span>`
    : (task.date && task.date !== 'kein Datum' ? task.date : '');
  const timeText = `${task.time ? `⏱ ${task.time}` : ''}${task.time && dateDisplay ? ' · ' : ''}${dateDisplay}`;

  const project = projects.find(p => p.id === task._projectId);
  const cfg = project ? TYPE_CONFIG[project.type] : null;
  const projectBadge = project
    ? `<span class="project-type-badge ${cfg?.tagClass || ''}" style="font-size:0.65rem;padding:1px 6px">${escHtml(project.name)}</span>`
    : '';

  card.innerHTML = `
    <div class="kanban-card-title" ${titleStyle}>${escHtml(task.title)}</div>
    <div class="kanban-card-meta">
      <span class="kanban-card-time">${timeText}</span>
      ${projectBadge}
    </div>
  `;

  card.addEventListener('dragstart', e => {
    _dragCol = col;
    _dragIdx = idx;
    _dragProjectId = task._projectId;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.kanban-cards, .kanban-col').forEach(c => c.classList.remove('drag-over'));
  });

  return card;
}

// ---- Board rendern ----
function renderBoard(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  currentProjectId = projectId;
  const cfg = TYPE_CONFIG[project.type];

  const badge = document.querySelector('.board-header .project-type-badge');
  badge.className = `project-type-badge ${cfg.tagClass}`;
  badge.textContent = project.type;
  document.querySelector('.board-title').textContent = project.name;

  const projectTasks = tasks[projectId] || {};
  Object.entries(COL_ID_MAP).forEach(([col, colId]) => {
    const colEl   = document.getElementById(colId);
    const countEl = document.getElementById(COUNT_ID_MAP[col]);
    colEl.innerHTML = '';
    const colTasks = projectTasks[col] || [];
    colTasks.forEach((task, idx) => colEl.appendChild(buildTaskCard(task, col, idx)));
    if (countEl) countEl.textContent = colTasks.length;
    wireDropZone(colEl.closest('.kanban-col') || colEl, col);
  });

  const sel = document.getElementById('task-project');
  for (const opt of sel.options) {
    if (opt.value === project.name) { opt.selected = true; break; }
  }
}

// ---- Karte bauen ----
function buildTaskCard(task, col, idx) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.dataset.col = col;
  card.dataset.idx = idx;
  if (task.done) card.style.opacity = '0.5';

  const titleStyle = task.done ? 'style="text-decoration:line-through"' : '';

  const ds = taskDeadlineStatus(task.deadlineRaw);
  const dateDisplay = ds
    ? `<span class="task-deadline ${ds.cls}">${ds.label}</span>`
    : (task.date && task.date !== 'kein Datum' ? task.date : '');
  const timeText = task.done
    ? dateDisplay
    : `${task.time ? `⏱ ${task.time}` : ''}${task.time && dateDisplay ? ' · ' : ''}${dateDisplay}`;

  card.innerHTML = `
    <div class="kanban-card-actions">
      <button class="kanban-card-action" draggable="false" title="Bearbeiten" onclick="openEditTask('${col}', ${idx})">✏</button>
      <button class="kanban-card-action danger" draggable="false" title="Löschen" onclick="confirmDeleteTask('${col}', ${idx})">✕</button>
    </div>
    <div class="kanban-card-title" ${titleStyle}>${escHtml(task.title)}</div>
    <div class="kanban-card-meta">
      <span class="kanban-card-time">${timeText}</span>
    </div>
  `;

  card.addEventListener('dragstart', e => {
    _dragCol = col;
    _dragIdx = idx;
    _dragProjectId = null;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.kanban-cards, .kanban-col').forEach(c => c.classList.remove('drag-over'));
  });

  return card;
}

// ---- Drop-Zone ----
function wireDropZone(colEl, col) {
  if (_dropControllers.has(col)) _dropControllers.get(col).abort();
  const ac = new AbortController();
  _dropControllers.set(col, ac);
  const sig = { signal: ac.signal };

  colEl.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    colEl.classList.add('drag-over');
  }, sig);
  colEl.addEventListener('dragleave', e => {
    if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('drag-over');
  }, sig);
  colEl.addEventListener('drop', e => {
    e.preventDefault();
    colEl.classList.remove('drag-over');
    if (_dragCol === null || _dragIdx === null) return;
    if (_dragCol === col) return;

    const projectId = currentProjectId || _dragProjectId;
    if (!projectId) return;

    const task = tasks[projectId][_dragCol].splice(_dragIdx, 1)[0];
    if (!tasks[projectId][col]) tasks[projectId][col] = [];
    tasks[projectId][col].push(task);
    saveData();

    const affected = [_dragCol, col];
    _dragCol = null;
    _dragIdx = null;
    _dragProjectId = null;

    if (currentProjectId) {
      affected.forEach(refreshColumn);
    } else {
      renderAllBoard();
    }
  }, sig);
}

// ---- Spalte neu rendern ----
function refreshColumn(col) {
  const colEl   = document.getElementById(COL_ID_MAP[col]);
  const countEl = document.getElementById(COUNT_ID_MAP[col]);
  colEl.innerHTML = '';
  const colTasks = (tasks[currentProjectId] || {})[col] || [];
  colTasks.forEach((task, idx) => colEl.appendChild(buildTaskCard(task, col, idx)));
  if (countEl) countEl.textContent = colTasks.length;
  wireDropZone(colEl.closest('.kanban-col') || colEl, col);

  const project = projects.find(p => p.id === currentProjectId);
  if (project) {
    const oldCard = document.querySelector(`.project-card[data-project-id="${currentProjectId}"]`);
    if (oldCard) { oldCard.remove(); renderProjectCard(project); }
  }
}

// ---- Aufgabe erstellen ----
function openCreateTask(column) {
  document.getElementById('createTaskForm').reset();
  if (column) {
    const sel = document.getElementById('task-column');
    for (const opt of sel.options) {
      if (opt.value === column) { opt.selected = true; break; }
    }
  }
  document.getElementById('createTaskOverlay').classList.add('open');
}
function closeCreateTask() {
  document.getElementById('createTaskOverlay').classList.remove('open');
}
document.getElementById('createTaskOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeCreateTask();
});

function submitTask(e) {
  e.preventDefault();
  const title    = document.getElementById('task-title').value.trim();
  const column   = document.getElementById('task-column').value;
  const timeVal  = document.getElementById('task-time').value;
  const deadline = document.getElementById('task-deadline').value;
  if (!title) return;

  const timeLabel = timeVal ? `${timeVal}h` : '';
  const dateLabel = deadline
    ? new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : 'kein Datum';

  const task = { title, time: timeLabel, date: dateLabel, deadlineRaw: deadline };

  if (!tasks[currentProjectId]) tasks[currentProjectId] = {};
  if (!tasks[currentProjectId][column]) tasks[currentProjectId][column] = [];
  tasks[currentProjectId][column].push(task);
  saveData();

  refreshColumn(column);
  closeCreateTask();
}

// ---- Aufgabe bearbeiten ----
function openEditTask(col, idx) {
  const task = (tasks[currentProjectId]?.[col] || [])[idx];
  if (!task) return;

  document.getElementById('edit-task-col').value   = col;
  document.getElementById('edit-task-idx').value   = idx;
  document.getElementById('edit-task-title').value = task.title;

  const colSel = document.getElementById('edit-task-column');
  for (const opt of colSel.options) {
    if (opt.value === col) { opt.selected = true; break; }
  }

  document.getElementById('edit-task-time').value     = task.time ? parseFloat(task.time) : '';
  document.getElementById('edit-task-deadline').value = task.deadlineRaw || '';

  document.getElementById('editTaskOverlay').classList.add('open');
}
function closeEditTask() {
  document.getElementById('editTaskOverlay').classList.remove('open');
}
document.getElementById('editTaskOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeEditTask();
});

function submitEditTask(e) {
  e.preventDefault();
  const oldCol   = document.getElementById('edit-task-col').value;
  const idx      = parseInt(document.getElementById('edit-task-idx').value);
  const newCol   = document.getElementById('edit-task-column').value;
  const title    = document.getElementById('edit-task-title').value.trim();
  const timeVal  = document.getElementById('edit-task-time').value;
  const deadline = document.getElementById('edit-task-deadline').value;
  if (!title) return;

  const timeLabel = timeVal ? `${timeVal}h` : '';
  const dateLabel = deadline
    ? new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : 'kein Datum';

  const updatedTask = { title, time: timeLabel, date: dateLabel, deadlineRaw: deadline };

  tasks[currentProjectId][oldCol].splice(idx, 1);
  if (!tasks[currentProjectId][newCol]) tasks[currentProjectId][newCol] = [];
  tasks[currentProjectId][newCol].push(updatedTask);
  saveData();

  const colsToRefresh = oldCol === newCol ? [oldCol] : [oldCol, newCol];
  colsToRefresh.forEach(refreshColumn);
  closeEditTask();
}

// ---- Aufgabe löschen ----
function confirmDeleteTask(col, idx) {
  const task = (tasks[currentProjectId]?.[col] || [])[idx];
  if (!task) return;
  openConfirm(
    'Aufgabe löschen?',
    `„${task.title}" wird unwiderruflich gelöscht.`,
    () => deleteTask(col, idx)
  );
}

function deleteTask(col, idx) {
  tasks[currentProjectId][col].splice(idx, 1);
  saveData();
  refreshColumn(col);
}
