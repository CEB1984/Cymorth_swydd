'use strict';

const Editor = (() => {

  let _guide        = null;
  let _saveTimer    = null;
  let _overlayClean = [];
  const SAVE_DEBOUNCE_MS = 800;

  const $stepList    = document.getElementById('stepList');
  const $stepWarning = document.getElementById('stepWarning');
  const $maxLabel    = document.getElementById('maxStepsLabel');
  const $titleInput  = document.getElementById('guideTitle');
  const tmpl               = document.getElementById('stepTemplate');

  $maxLabel.textContent = '100';

  $titleInput.addEventListener('input', () => {
    if (!_guide) return;
    _guide.title = _sanitize($titleInput.value);
    _scheduleSave();
  });

  $stepList.addEventListener('change', _onLabelChange);
  $stepList.addEventListener('input',  _onLabelChange);
  $stepList.addEventListener('click',  _onStepAction);

  let _dragSrc = null;

  $stepList.addEventListener('dragstart', evt => {
    const item = evt.target.closest('.step-item');
    if (!item) return;
    _dragSrc = item;
    evt.dataTransfer.effectAllowed = 'move';
  });
  $stepList.addEventListener('dragover', evt => {
    evt.preventDefault();
    const item = evt.target.closest('.step-item');
    if (item && item !== _dragSrc) item.classList.add('drag-over');
  });
  $stepList.addEventListener('dragleave', evt => {
    const item = evt.target.closest('.step-item');
    if (item) item.classList.remove('drag-over');
  });
  $stepList.addEventListener('drop', evt => {
    evt.preventDefault();
    const target = evt.target.closest('.step-item');
    if (!target || target === _dragSrc || !_dragSrc) return;
    target.classList.remove('drag-over');
    const srcI = _guide.steps.findIndex(s => s.id === _dragSrc.dataset.id);
    const tgtI = _guide.steps.findIndex(s => s.id === target.dataset.id);
    if (srcI < 0 || tgtI < 0) return;
    const [moved] = _guide.steps.splice(srcI, 1);
    _guide.steps.splice(tgtI, 0, moved);
    _reorder(); _render(); _scheduleSave();
  });
  $stepList.addEventListener('dragend', () => {
    _dragSrc = null;
    $stepList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  function _sanitize(str) {
    return String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
  }
  function _reorder() { _guide.steps.forEach((s, i) => { s.order = i; }); }
  function _scheduleSave() { clearTimeout(_saveTimer); _saveTimer = setTimeout(_save, SAVE_DEBOUNCE_MS); }

  async function _save() {
    if (!_guide) return;
    try {
      const result = await Api.guides.update(_guide.id, { title: _guide.title, steps: _guide.steps });
      if (result.warned) setWarned(true);
    } catch (err) { console.error('[editor] save failed:', err.message); }
  }

  function _onLabelChange(evt) {
    const input = evt.target.closest('.step-label-input');
    if (!input || !_guide) return;
    const step = _guide.steps.find(s => s.id === input.closest('.step-item').dataset.id);
    if (step) { step.label = _sanitize(input.value); _scheduleSave(); }
  }

  function _onStepAction(evt) {
    const btn = evt.target.closest('[data-action]');
    if (!btn || !_guide) return;
    const action = btn.dataset.action;
    const idx    = _guide.steps.findIndex(s => s.id === btn.closest('.step-item').dataset.id);
    if (idx < 0) return;
    if (action === 'delete') {
      if (!confirm('Delete this step?')) return;
      _guide.steps.splice(idx, 1);
    } else if (action === 'move-up' && idx > 0) {
      [_guide.steps[idx-1], _guide.steps[idx]] = [_guide.steps[idx], _guide.steps[idx-1]];
    } else if (action === 'move-down' && idx < _guide.steps.length - 1) {
      [_guide.steps[idx], _guide.steps[idx+1]] = [_guide.steps[idx+1], _guide.steps[idx]];
    }
    _reorder(); _render(); _scheduleSave();
  }

  function _cleanupOverlays() { _overlayClean.forEach(fn => fn()); _overlayClean = []; }

  function _render() {
    if (!_guide) return;
    _cleanupOverlays();
    $stepList.innerHTML = '';
    const sorted = _guide.steps.slice().sort((a,b) => a.order - b.order);
    sorted.forEach((step, i) => {
      const node = tmpl.content.cloneNode(true);
      const li   = node.querySelector('.step-item');
      li.dataset.id = step.id;
      li.setAttribute('draggable', 'true');
      li.querySelector('.step-number').textContent = (i+1) + '.';
      const input   = li.querySelector('.step-label-input');
      input.value   = step.label || '';
      const img     = li.querySelector('.step-thumb');
      const canvas  = li.querySelector('.step-overlay');
      const imgWrap = li.querySelector('.step-image-wrap');
      if (step.hasImage) {
        img.src = Api.guides.thumbUrl(_guide.id, step.id);
        img.alt = 'Step ' + (i+1) + ' screenshot';
        _overlayClean.push(Overlay.attach(canvas, img, step.clickX, step.clickY));
      } else {
        imgWrap.hidden = true;
      }
      $stepList.appendChild(node);
    });
  }

  function load(guide) {
    _guide = guide;
    $titleInput.value = guide.title || '';
    _render();
  }

  function addStep(step) {
    if (!_guide) return;
    _guide.steps.push(step);
    _reorder(); _render();
    const items = $stepList.querySelectorAll('.step-item');
    if (items.length) items[items.length-1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    _scheduleSave();
  }

  function addEmptyStep() {
    if (!_guide) return;
    _guide.steps.push({ id: crypto.randomUUID(), order: _guide.steps.length, label: '', hasImage: false, clickX: null, clickY: null });
    _render();
    const inputs = $stepList.querySelectorAll('.step-label-input');
    if (inputs.length) inputs[inputs.length-1].focus();
    _scheduleSave();
  }

  function currentGuideId() { return _guide ? _guide.id : null; }
  function setWarned(bool)   { $stepWarning.hidden = !bool; }

  return { load, addStep, addEmptyStep, currentGuideId, setWarned };

})();