'use strict';

const Api = (() => {

  async function request(method, path, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function upload(path, formData) {
    const res = await fetch(path, { method: 'POST', body: formData, credentials: 'same-origin' });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  const guides = {
    list:     ()         => request('GET',    '/api/guides'),
    get:      (id)       => request('GET',    '/api/guides/' + id),
    create:   (title)    => request('POST',   '/api/guides', { title }),
    update:   (id, data) => request('PUT',    '/api/guides/' + id, data),
    delete:   (id)       => request('DELETE', '/api/guides/' + id),
    thumbUrl: (guideId, stepId) => '/api/guides/' + guideId + '/thumb/' + stepId,
  };

  const capture = {
    screenshot(guideId, pngBlob, clickX, clickY, domContext, domToken) {
      const fd = new FormData();
      fd.append('screenshot', pngBlob, 'screenshot.png');
      fd.append('guideId', guideId);
      if (clickX != null) fd.append('clickX', String(clickX));
      if (clickY != null) fd.append('clickY', String(clickY));
      if (domToken)   fd.append('domToken', domToken);
      if (domContext) fd.append('domContext', JSON.stringify(domContext));
      return upload('/api/capture/screenshot', fd);
    },
  };

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function safeFilename(title) {
    return (title || 'guide').replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_').slice(0, 80) || 'guide';
  }

  const exportGuide = {
    async word(guideId, title) {
      const res = await fetch('/api/export/' + guideId + '/word', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Export failed: HTTP ' + res.status);
      triggerDownload(await res.blob(), safeFilename(title) + '.docx');
    },
    async html(guideId, title) {
      const res = await fetch('/api/export/' + guideId + '/html', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Export failed: HTTP ' + res.status);
      triggerDownload(await res.blob(), safeFilename(title) + '.html');
    },
  };

  const storage = { stats: () => request('GET', '/api/storage') };
  const health  = { check: () => request('GET', '/api/health') };

  return { guides, capture, exportGuide, storage, health };

})();