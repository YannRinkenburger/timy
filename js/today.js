function renderTodayModal() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const dayName = today.toLocaleDateString('de-DE', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('today-date').textContent =
    `${dayName}, ${dateStr} · Hier sind deine empfohlenen Aufgaben für heute`;

  // Alle offenen Tasks sammeln (nicht in Erledigt)
  const allTasks = [];
  projects.forEach(project => {
    const cfg = TYPE_CONFIG[project.type];
    if (!cfg) return; // unbekannter Typ (z.B. alter Datensatz)
    const projectTasks = tasks[project.id] || {};
    Object.entries(projectTasks).forEach(([col, colTasks]) => {
      if (col === 'Erledigt') return;
      colTasks.forEach(task => {
        allTasks.push({ ...task, project, cfg });
      });
    });
  });

  // Sortierung: zuerst nach Deadline-Nähe, dann ohne Deadline
  const todayMs = today.getTime();
  const sorted = [...allTasks].sort((a, b) => {
    if (!a.deadlineRaw && !b.deadlineRaw) return 0;
    if (!a.deadlineRaw) return 1;
    if (!b.deadlineRaw) return -1;
    return new Date(a.deadlineRaw) - new Date(b.deadlineRaw);
  });

  // Max 7 Aufgaben empfehlen
  const recommended = sorted.slice(0, 7);

  // Deadline bald = innerhalb 7 Tage
  const soonCount = allTasks.filter(t => {
    if (!t.deadlineRaw) return false;
    const days = Math.ceil((new Date(t.deadlineRaw) - todayMs) / 86400000);
    return days >= 0 && days <= 7;
  }).length;

  // Gesamtzeit
  const totalTime = recommended.reduce((sum, t) => {
    return sum + (t.time ? parseFloat(t.time) : 0);
  }, 0);

  document.getElementById('today-count').textContent = recommended.length;
  document.getElementById('today-time').textContent  = totalTime > 0 ? `${totalTime}h` : '–';
  document.getElementById('today-deadlines').textContent = soonCount;

  // Task-Liste rendern
  const container = document.getElementById('today-tasks');
  container.innerHTML = '';

  if (recommended.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0">Keine offenen Aufgaben – alles erledigt! 🎉</div>';
    return;
  }

  recommended.forEach((t, i) => {
    const days = t.deadlineRaw
      ? Math.ceil((new Date(t.deadlineRaw) - todayMs) / 86400000)
      : null;

    const urgency = days === null ? 'prio-low'
                  : days <= 7    ? 'prio-high'
                  : days <= 14   ? 'prio-mid'
                  :                'prio-low';

    const metaParts = [t.project.name];
    if (days !== null) {
      if (days < 0)  metaParts.push('Abgelaufen');
      else if (days === 0) metaParts.push('Heute fällig');
      else if (days === 1) metaParts.push('Morgen fällig');
      else metaParts.push(`In ${days} Tagen`);
    }

    const row = document.createElement('div');
    row.className = `today-task ${urgency}`;
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <div class="today-task-num">${i + 1}</div>
      <div class="today-task-body">
        <div class="today-task-title">${escHtml(t.title)}</div>
        <div class="today-task-meta">${metaParts.join(' · ')}</div>
      </div>
      <span class="today-task-tag ${t.cfg.tagClass}">${escHtml(t.project.type)}</span>
      ${t.time ? `<div class="today-task-time">${t.time}</div>` : ''}
    `;
    row.onclick = () => { closeToday(); openBoard(t.project.id); };
    container.appendChild(row);
  });
}
