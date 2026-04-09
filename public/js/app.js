'use strict';

(async () => {

  const $guideList      = document.getElementById('guideList');
  const $btnNewGuide    = document.getElementById('btnNewGuide');
  const $emptyState     = document.getElementById('emptyState');
  const $recordPanel    = document.getElementById('recordPanel');
  const $editorPanel    = document.getElementById('editorPanel');
  const $recordTitle    = document.getElementById('recordGuideTitle');
  const $btnRecord      = document.getElementById('btnRecord');
  const $btnStop        = document.getElementById('btnStop');
  const $btnCapture     = document.getElementById('btnCapture');
  const $recordStatus   = document.getElementById('recordStatus');
  const $storageInfo    = document.getElementById('storageInfo');
  const $btnAddStep     = document.getElementById('btnAddStep');
  const $btnExportWord  = document.getElementById('btnExportWord');
  const $btnExportHtml  = document.getElementById('btnExportHtml');
  const $btnDeleteGuide = document.getElementById('btnDeleteGuide');
  const $bookmarkletHint  = document.getElementById('bookmarkletHint');
  const $bookmarkletLink  = document.getElementById('bookmarkletLink');
  const $btnDismissHint   = document.getElementById('btnDismissHint');

  let _activeGuideId = null;
  let _hintDismissed = false;

  function buildBookmarklet() {
    const origin = window.location.origin;
    // Build the bookmarklet code as a plain string — no template literals
    // to avoid conflicts with the outer template literal
    var lines = [
      '(function(){',
      // Alt+S: send capture trigger via BroadcastChannel
      'document.addEventListener("keydown",function(e){',
      'if(e.altKey&&(e.key==="s"||e.key==="S")){',
      'e.preventDefault();',
      'try{var bc=new BroadcastChannel("doc-creator");',
      'bc.postMessage({type:"DOC_CREATOR_CAPTURE"});',
      'bc.close();}catch(ex){}',
      '}});',
      // Click: send DOM context via BroadcastChannel
      'document.addEventListener("click",function(e){',
      'var el=e.target;',
      'var token=Math.random().toString(36).slice(2);',
      'var ctx={',
      'elementTag:el.tagName?el.tagName.toLowerCase():"",',
      'elementText:(el.innerText||el.value||el.textContent||"").trim().slice(0,300),',
      'elementAttributes:{',
      'id:el.id||"",',
      'name:el.name||"",',
      'type:el.type||"",',
      '"aria-label":(el.getAttribute("aria-label")||""),',
      'placeholder:el.placeholder||"",',
      'href:el.href||""},',
      'nearestLabel:(function(){',
      'var l=el.closest("label")||document.querySelector("label[for=\""+el.id+"\"]");',
      'return l?(l.innerText||"").trim().slice(0,200):"";',
      '})(),',
      'pageTitle:document.title||"",',
      'surroundingHTML:(el.closest("form")||el.closest("section")||el.closest("main")||el.parentElement||el).outerHTML.slice(0,2000)',
      '};',
      'try{var bc2=new BroadcastChannel("doc-creator");',
      'bc2.postMessage({type:"DOC_CREATOR_CLICK",token:token,context:ctx});',
      'bc2.close();}catch(ex){}',
      '},true);',
      'alert("DocCreator ready. Alt+S to capture a step.");',
      '})();'
    ];
    return 'javascript:' + encodeURIComponent(lines.join(''));
  }

  $bookmarkletLink.href = buildBookmarklet();
  $btnDismissHint.addEventListener('click', () => { _hintDismissed = true; $bookmarkletHint.hidden = true; });

  function showEmpty() {
    $emptyState.hidden  = false;
    $recordPanel.hidden = true;
    $editorPanel.hidden = true;
  }

  function showGuide() {
    $emptyState.hidden  = true;
    $recordPanel.hidden = false;
    $editorPanel.hidden = false;
    if (!_hintDismissed) $bookmarkletHint.hidden = false;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function loadGuideList() {
    try {
      const guides = await Api.guides.list();
      $guideList.innerHTML = '';
      guides.forEach(g => {
        const li = document.createElement('li');
        li.className  = 'guide-list-item';
        li.dataset.id = g.id;
        li.innerHTML  = '<span class="g-title">' + esc(g.title) + '</span>'
                      + '<span class="g-meta">' + g.stepCount + ' step' + (g.stepCount !== 1 ? 's' : '') + '</span>';
        li.addEventListener('click', () => selectGuide(g.id));
        $guideList.appendChild(li);
      });
      if (_activeGuideId) highlightSidebarItem(_activeGuideId);
    } catch (err) { console.error('[app] guide list load failed:', err.message); }
  }

  function highlightSidebarItem(id) {
    $guideList.querySelectorAll('.guide-list-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }

  async function selectGuide(id) {
    try {
      const guide    = await Api.guides.get(id);
      _activeGuideId = id;
      $recordTitle.textContent = guide.title;
      Editor.load(guide);
      showGuide();
      highlightSidebarItem(id);
    } catch (err) { alert('Could not load guide: ' + err.message); }
  }

  $btnNewGuide.addEventListener('click', async () => {
    const title = prompt('Guide title:', 'Untitled guide');
    if (title === null) return;
    try {
      const guide = await Api.guides.create(title.trim() || 'Untitled guide');
      await loadGuideList();
      await selectGuide(guide.id);
    } catch (err) { alert('Could not create guide: ' + err.message); }
  });

  $btnRecord.addEventListener('click', async () => {
    const guideId = Editor.currentGuideId();
    if (!guideId) { alert('Select or create a guide first.'); return; }
    try {
      $btnRecord.disabled = true;
      $recordStatus.textContent = 'Waiting for tab selection...';
      await Recorder.start(async ({ blob, clickX, clickY, domToken, domContext }) => {
        try {
          const result = await Api.capture.screenshot(guideId, blob, clickX, clickY, domContext, domToken);
          Editor.addStep(result.step);
          if (result.warned) Editor.setWarned(true);
          await loadGuideList();
        } catch (err) { console.error('[app] screenshot upload failed:', err.message); }
        finally { $recordStatus.textContent = '● Recording'; }
      });
      $btnRecord.disabled   = false;
      $btnStop.disabled     = false;
      $btnCapture.disabled  = false;
      $recordStatus.textContent = '● Recording';
      $recordStatus.classList.add('recording');
    } catch (err) {
      $btnRecord.disabled = false;
      $recordStatus.textContent = '';
      if (err.name !== 'NotAllowedError') alert('Could not start recording: ' + err.message);
    }
  });

  $btnStop.addEventListener('click', () => {
    Recorder.stop();
    $btnStop.disabled    = true;
    $btnCapture.disabled = true;
    $btnRecord.disabled  = false;
    $recordStatus.textContent = '';
    $recordStatus.classList.remove('recording');
  });

  $btnCapture.addEventListener('click', () => {
    Recorder.capture();
    $btnCapture.textContent = 'Capturing...';
    setTimeout(() => { $btnCapture.innerHTML = '&#128247; Capture Step <kbd>Alt+S</kbd>'; }, 600);
  });

  $btnAddStep.addEventListener('click', () => Editor.addEmptyStep());

  $btnDeleteGuide.addEventListener('click', async () => {
    const id = Editor.currentGuideId();
    if (!id) return;
    if (!confirm('Delete this guide and all its steps? This cannot be undone.')) return;
    try {
      await Api.guides.delete(id);
      _activeGuideId = null;
      await loadGuideList();
      showEmpty();
    } catch (err) { alert('Delete failed: ' + err.message); }
  });

  $btnExportWord.addEventListener('click', async () => {
    const id    = Editor.currentGuideId();
    const title = document.getElementById('guideTitle').value;
    if (!id) return;
    try {
      $btnExportWord.disabled    = true;
      $btnExportWord.textContent = 'Generating...';
      await Api.exportGuide.word(id, title);
    } catch (err) { alert('Export failed: ' + err.message); }
    finally { $btnExportWord.disabled = false; $btnExportWord.textContent = '\u2193 Word'; }
  });

  $btnExportHtml.addEventListener('click', async () => {
    const id    = Editor.currentGuideId();
    const title = document.getElementById('guideTitle').value;
    if (!id) return;
    try {
      $btnExportHtml.disabled    = true;
      $btnExportHtml.textContent = 'Generating...';
      await Api.exportGuide.html(id, title);
    } catch (err) { alert('Export failed: ' + err.message); }
    finally { $btnExportHtml.disabled = false; $btnExportHtml.textContent = '\u2193 HTML'; }
  });

  async function refreshStorageInfo() {
    try {
      const s = await Api.storage.stats();
      $storageInfo.textContent = s.guideCount + '/' + s.maxGuides + ' guides · ' + s.totalMB + ' MB';
      if (s.guideCount >= s.maxGuides) $storageInfo.style.color = '#cc4400';
    } catch (_) {}
  }

  showEmpty();
  await loadGuideList();
  await refreshStorageInfo();
  setInterval(refreshStorageInfo, 30000);

})();