const TYPE_CONFIG = {
  'Uni':    { tagClass: 'tag-uni',    color: 'var(--tag-uni)',    iconBg: 'rgba(222,109,32,0.15)',  defaultIcon: '📚' },
  'SAP':    { tagClass: 'tag-work',   color: 'var(--tag-work)',   iconBg: 'rgba(92,133,160,0.15)',  defaultIcon: '💼' },
  'Privat': { tagClass: 'tag-privat', color: 'var(--tag-privat)', iconBg: 'rgba(140,140,140,0.15)', defaultIcon: '🏠' },
};

function getEmoji(str) {
  // Erstes Graphem (Emoji oder Buchstabe) extrahieren
  const segs = [...new Intl.Segmenter().segment(str)];
  return segs.length > 0 ? segs[0].segment : '';
}

function wireEmojiPreview(inputId, previewId, fallback) {
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  input.addEventListener('input', () => {
    const em = getEmoji(input.value);
    preview.textContent = em || fallback;
    // Eingabe auf erstes Graphem beschränken
    if (em) input.value = em;
  });
}

function openBoard(projectId) {
  document.getElementById('board-back-btn').style.display = '';
  renderBoard(projectId);
  showPage('board', true);
}

// ---- Projektkarte rendern ----
function renderProjectCard(project) {
  const cfg = TYPE_CONFIG[project.type];
  const projectTasks = tasks[project.id] || {};
  const allTasks  = Object.values(projectTasks).flat();
  const doneTasks = (projectTasks['Erledigt'] || []).length;
  const total     = allTasks.length;
  const progress  = total > 0 ? Math.round((doneTasks / total) * 100) : 0;
  const itemLabel = 'Aufgaben';

  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.projectId = project.id;
  card.onclick = (e) => {
    if (e.target.closest('.card-menu-btn') || e.target.closest('.card-dropdown')) return;
    openBoard(project.id);
  };

  card.innerHTML = `
    <div class="card-actions">
      <button class="card-action" title="Bearbeiten" onclick="event.stopPropagation();openEditProject('${project.id}')">✏</button>
      <button class="card-action danger" title="Löschen" onclick="event.stopPropagation();confirmDeleteProject('${project.id}')">✕</button>
    </div>
    <div class="project-card-top">
      <div class="project-icon" style="background:${cfg.iconBg}">${project.icon}</div>
      <span class="project-type-badge ${cfg.tagClass}">${project.type}</span>
    </div>
    <h3>${escHtml(project.name)}</h3>
    <p>${escHtml(project.desc || '–')}</p>
    <div class="project-progress-bar">
      <div class="project-progress-fill" style="width:${progress}%;background:${cfg.color}"></div>
    </div>
    <div class="project-stats">
      <span>${doneTasks} / ${total} ${itemLabel}</span>
      <span class="deadline-badge ${deadlineStatus(project).cls}">${deadlineStatus(project).label}</span>
    </div>
  `;

  const grid = document.querySelector('.project-grid');
  grid.insertBefore(card, grid.querySelector('.add-project-card'));
  return card;
}

function deadlineStatus(project) {
  if (!project.deadline) return { label: 'kein Datum', cls: 'deadline-none' };
  const days = Math.ceil((new Date(project.deadline) - new Date()) / 86400000);
  if (days < 0)   return { label: 'Abgelaufen',       cls: 'deadline-overdue' };
  if (days === 0) return { label: 'Heute fällig',     cls: 'deadline-overdue' };
  if (days === 1) return { label: 'Morgen fällig',    cls: 'deadline-overdue' };
  if (days <= 7)  return { label: `In ${days} Tagen`, cls: 'deadline-overdue' };
  if (days <= 14) return { label: `In ${days} Tagen`, cls: 'deadline-critical' };
  return { label: project.deadlineLabel, cls: 'deadline-ok' };
}

// ---- Init ----
function initProjects() {
  wireEmojiPreview('proj-icon', 'proj-icon-preview', '📚');
  wireEmojiPreview('edit-proj-icon', 'edit-proj-icon-preview', '📚');

  const sel = document.getElementById('task-project');
  const sorted = [...projects].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });
  sorted.forEach(project => {
    renderProjectCard(project);
    const opt = document.createElement('option');
    opt.value = project.name;
    opt.textContent = project.name;
    sel.appendChild(opt);
  });
}

// ---- Erstellen ----
function openCreateProject() {
  document.getElementById('createProjectForm').reset();
  document.getElementById('proj-icon-preview').textContent = '📚';
  document.getElementById('createProjectOverlay').classList.add('open');
}
function closeCreateProject() {
  document.getElementById('createProjectOverlay').classList.remove('open');
}
document.getElementById('createProjectOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeCreateProject();
});

function submitProject(e) {
  e.preventDefault();
  const name     = document.getElementById('proj-name').value.trim();
  const type     = document.getElementById('proj-type').value;
  const iconRaw  = document.getElementById('proj-icon').value.trim();
  const icon     = getEmoji(iconRaw);
  const desc     = document.getElementById('proj-desc').value.trim();
  const deadline = document.getElementById('proj-deadline').value;
  if (!name || !type) return;

  const cfg = TYPE_CONFIG[type];
  const id  = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'kein Datum';

  const project = { id, name, type, icon: icon || cfg.defaultIcon, desc, deadlineLabel, deadline };
  projects.push(project);
  tasks[id] = { 'Backlog': [], 'To Do': [], 'In Bearbeitung': [], 'Erledigt': [] };
  saveData();

  renderProjectCard(project);

  const sel = document.getElementById('task-project');
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  sel.appendChild(opt);

  closeCreateProject();
}

// ---- Bearbeiten ----
function openEditProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  document.getElementById('edit-proj-id').value       = project.id;
  document.getElementById('edit-proj-name').value     = project.name;
  document.getElementById('edit-proj-type').value     = project.type;
  document.getElementById('edit-proj-icon').value     = project.icon;
  document.getElementById('edit-proj-icon-preview').textContent = project.icon;
  document.getElementById('edit-proj-desc').value     = project.desc || '';
  document.getElementById('edit-proj-deadline').value = project.deadline || '';

  document.getElementById('editProjectOverlay').classList.add('open');
}
function closeEditProject() {
  document.getElementById('editProjectOverlay').classList.remove('open');
}
document.getElementById('editProjectOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeEditProject();
});

function submitEditProject(e) {
  e.preventDefault();
  const id       = document.getElementById('edit-proj-id').value;
  const name     = document.getElementById('edit-proj-name').value.trim();
  const type     = document.getElementById('edit-proj-type').value;
  const iconRaw  = document.getElementById('edit-proj-icon').value.trim();
  const icon     = getEmoji(iconRaw);
  const desc     = document.getElementById('edit-proj-desc').value.trim();
  const deadline = document.getElementById('edit-proj-deadline').value;
  if (!name || !type) return;

  const cfg = TYPE_CONFIG[type];
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'kein Datum';

  const idx = projects.findIndex(p => p.id === id);
  const oldName = projects[idx].name;
  projects[idx] = { ...projects[idx], name, type, icon: icon || cfg.defaultIcon, desc, deadlineLabel, deadline };
  saveData();

  // DOM-Karte ersetzen
  const oldCard = document.querySelector(`.project-card[data-project-id="${id}"]`);
  if (oldCard) oldCard.remove();
  renderProjectCard(projects[idx]);

  // Option im Task-Select aktualisieren
  const sel = document.getElementById('task-project');
  for (const opt of sel.options) {
    if (opt.value === oldName) { opt.value = name; opt.textContent = name; break; }
  }

  closeEditProject();
}

// ---- Löschen ----
function confirmDeleteProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  openConfirm(
    'Projekt löschen?',
    `„${project.name}" und alle zugehörigen Aufgaben werden unwiderruflich gelöscht.`,
    () => deleteProject(projectId)
  );
}

function deleteProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  const idx = projects.findIndex(p => p.id === projectId);
  projects.splice(idx, 1);
  delete tasks[projectId];
  saveData();

  document.querySelector(`.project-card[data-project-id="${projectId}"]`)?.remove();

  // Option aus Task-Select entfernen
  const sel = document.getElementById('task-project');
  for (const opt of [...sel.options]) {
    if (opt.value === project.name) { sel.removeChild(opt); break; }
  }
}
