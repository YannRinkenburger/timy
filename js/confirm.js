let _confirmCallback = null;

function openConfirm(title, msg, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  _confirmCallback = onConfirm;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  _confirmCallback = null;
}

document.getElementById('confirm-ok').addEventListener('click', () => {
  if (_confirmCallback) _confirmCallback();
  closeConfirm();
});

document.getElementById('confirmOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeConfirm();
});
