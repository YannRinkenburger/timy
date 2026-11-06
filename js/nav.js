function showPage(id, skipBoardRender) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach((t, i) => {
    const tabs = ['projects', 'board', 'timeline'];
    t.classList.toggle('active', tabs[i] === id);
  });
  if (id === 'board' && !skipBoardRender && typeof renderAllBoard === 'function') {
    renderAllBoard();
  }
  if (id === 'timeline' && typeof renderTimeline === 'function') {
    renderTimeline();
  }
}

function closeToday() {
  document.getElementById('todayOverlay').style.display = 'none';
}

document.getElementById('todayOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeToday();
});
