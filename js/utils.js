function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- localStorage ----
const STORAGE_KEY_PROJECTS = 'timy_projects';
const STORAGE_KEY_TASKS    = 'timy_tasks';

function loadData() {
  try {
    const p = localStorage.getItem(STORAGE_KEY_PROJECTS);
    const t = localStorage.getItem(STORAGE_KEY_TASKS);
    return {
      projects: p ? JSON.parse(p) : [],
      tasks:    t ? JSON.parse(t) : {},
    };
  } catch {
    return { projects: [], tasks: {} };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  localStorage.setItem(STORAGE_KEY_TASKS,    JSON.stringify(tasks));
}

// ---- Zentraler Datenspeicher (wird aus localStorage befüllt) ----
const stored = loadData();
const projects = stored.projects;
const tasks    = stored.tasks;

let currentProjectId = projects.length > 0 ? projects[0].id : null;
