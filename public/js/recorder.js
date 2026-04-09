'use strict';

const Recorder = (() => {

  let _stream    = null;
  let _video     = null;
  let _canvas    = null;
  let _ctx       = null;
  let _onCapture = null;
  let _active    = false;
  let _triggerSource = null;

  const _pendingDom = new Map();
  const DOM_TTL_MS  = 8000;

  window.addEventListener('message', (evt) => {
    if (evt.data && evt.data.type === 'DOC_CREATOR_CLICK') {
      const { token, context } = evt.data;
      if (token && context) {
        _pendingDom.set(token, { context, expiresAt: Date.now() + DOM_TTL_MS });
        for (const [k, v] of _pendingDom) {
          if (v.expiresAt < Date.now()) _pendingDom.delete(k);
        }
        if (_active) _captureFrame(null, null, token);
      }
    }
  });

  function _captureFrame(clickX, clickY, domToken) {
    if (!_video || !_canvas || !_ctx) return;
    const vw = _video.videoWidth;
    const vh = _video.videoHeight;
    if (!vw || !vh) return;
    _canvas.width  = vw;
    _canvas.height = vh;
    _ctx.drawImage(_video, 0, 0, vw, vh);
    _canvas.toBlob(blob => {
      if (!blob || !_onCapture) return;
      let resolvedContext = null;
      if (domToken && _pendingDom.has(domToken)) {
        resolvedContext = _pendingDom.get(domToken).context;
        _pendingDom.delete(domToken);
      }
      _onCapture({ blob, clickX, clickY, domToken, domContext: resolvedContext });
    }, 'image/png');
  }


  // BroadcastChannel — receives messages from bookmarklet in target tab
  // Works cross-tab within same browser, no CORS needed
  let _bc = null;

  function _startBroadcastListener() {
    try {
      _bc = new BroadcastChannel('doc-creator');
      _bc.onmessage = (evt) => {
        if (evt.data && evt.data.type === 'DOC_CREATOR_CAPTURE') {
          _captureFrame(null, null, null);
        } else if (evt.data && evt.data.type === 'DOC_CREATOR_CLICK') {
          const { token, context } = evt.data;
          if (token && context) {
            _pendingDom.set(token, { context, expiresAt: Date.now() + DOM_TTL_MS });
            _captureFrame(null, null, token);
          }
        }
      };
    } catch(e) { console.warn('BroadcastChannel not available:', e.message); }
  }

  function _stopBroadcastListener() {
    if (_bc) { _bc.close(); _bc = null; }
  }
  async function start(onCapture) {
    if (_active) return;
    _stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
    _video  = document.createElement('video');
    _video.muted = true;
    _video.srcObject = _stream;
    await _video.play();
    _canvas    = document.createElement('canvas');
    _ctx       = _canvas.getContext('2d');
    _onCapture = onCapture;
    _active    = true;
    _startBroadcastListener();
    _stream.getVideoTracks()[0].addEventListener('ended', () => { if (_active) stop(); });

    // Listen for capture triggers from the bookmarklet (via SSE)
    _triggerSource = new EventSource('/api/capture/trigger-listen');
    _triggerSource.onmessage = () => { if (_active) _captureFrame(null, null, null); };
  }

  function stop() {
    if (!_active) return;
    _active = false;
    if (_triggerSource) { _triggerSource.close(); _triggerSource = null; }
    _stopBroadcastListener();
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    _video = null; _canvas = null; _ctx = null; _onCapture = null;
    _pendingDom.clear();
  }

  // Manual capture — called by the Capture Step button
  function capture() {
    if (!_active) return;
    _captureFrame(null, null, null);
  }

  function isActive() { return _active; }

  return { start, stop, capture, isActive };

})();