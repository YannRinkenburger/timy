let _weekOffset = 0;

function jumpToToday() {
  _weekOffset = 0;
  renderTimeline();
}

function shiftWeek(dir) {
  _weekOffset += dir;
  renderTimeline();
}

function getWeekStart(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mo=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + offset * 7);
  return monday;
}

function getKW(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function renderTimeline() {
  const monday = getWeekStart(_weekOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const today  = isoDate(new Date());
  const kw     = getKW(monday);

  const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  document.getElementById('timeline-subtitle').textContent =
    `KW ${kw} · ${fmt(monday)} – ${fmt(sunday)}`;

  // Alle Tasks mit Deadline sammeln
  const allTasks = [];
  projects.forEach(project => {
    const cfg = TYPE_CONFIG[project.type];
    if (!cfg) return;
    Object.values(tasks[project.id] || {}).flat().forEach(task => {
      if (task.deadlineRaw) allTasks.push({ ...task, project, cfg });
    });
  });

  // Wochentage rendern
  const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const weekEl = document.getElementById('timeline-week');
  weekEl.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayIso = isoDate(day);
    const isToday = dayIso === today;

    const dayTasks = allTasks.filter(t => t.deadlineRaw === dayIso);

    const col = document.createElement('div');
    col.className = 'week-day' + (isToday ? ' today' : '');
    col.innerHTML = `
      <div class="week-day-header">
        <div class="day-name">${DAY_NAMES[i]}</div>
        <div class="day-num" ${isToday ? 'style="color:var(--accent)"' : ''}>${day.getDate()}</div>
      </div>
      <div class="week-day-tasks" id="day-tasks-${i}"></div>
    `;
    weekEl.appendChild(col);

    const tasksEl = col.querySelector(`#day-tasks-${i}`);
    if (dayTasks.length === 0) {
      tasksEl.innerHTML = '<div class="week-task-empty">–</div>';
    } else {
      dayTasks.forEach(t => {
        const done = t.done;
        const div = document.createElement('div');
        div.className = 'week-task';
        div.style.background = t.cfg.iconBg;
        div.style.color = t.cfg.color;
        if (done) { div.style.textDecoration = 'line-through'; div.style.opacity = '0.5'; }
        div.style.cursor = 'pointer';
        div.textContent = t.title + (t.time ? ` · ${t.time}` : '');
        div.onclick = () => openBoard(t.project.id);
        tasksEl.appendChild(div);
      });
    }
  }

  // Deadlines-Liste: alle zukünftigen + heute, sortiert
  const deadlinesEl = document.getElementById('timeline-deadlines');
  deadlinesEl.innerHTML = '';

  const upcoming = allTasks
    .filter(t => t.deadlineRaw >= today)
    .sort((a, b) => a.deadlineRaw.localeCompare(b.deadlineRaw));

  if (upcoming.length === 0) {
    deadlinesEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-faint)">Keine kommenden Deadlines</div>';
    return;
  }

  upcoming.forEach(t => {
    const days = Math.ceil((new Date(t.deadlineRaw) - new Date()) / 86400000);
    const ds = days <= 0 ? { color: 'var(--accent-red)' }
             : days <= 7  ? { color: 'var(--accent-red)' }
             : days <= 14 ? { color: 'var(--accent-orange)' }
             :               { color: 'var(--accent-green)' };
    const daysLabel = days === 0 ? 'Heute'
                    : days === 1 ? 'Morgen'
                    : `in ${days} Tagen`;

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface-2);border-radius:10px;border-left:3px solid ${ds.color};cursor:pointer`;
    row.onclick = () => openBoard(t.project.id);
    row.innerHTML = `
      <div style="flex:1">
        <div style="font-size:0.875rem;font-weight:600">${escHtml(t.title)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t.date} · ${daysLabel}</div>
      </div>
      <span class="project-type-badge ${t.cfg.tagClass}">${escHtml(t.project.name)}</span>
    `;
    deadlinesEl.appendChild(row);
  });
}
