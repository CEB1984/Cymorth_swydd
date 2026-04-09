'use strict';

const defaultTemplate = {
  name:        'Default',
  description: 'Neutral placeholder styling.',
  styles: {
    fontFamily:   'Arial',
    baseFontSize: 11,
    headingSize:  16,
    subheadSize:  12,
    colors: {
      heading:    '222222',
      body:       '333333',
      accent:     '0066CC',
      border:     'CCCCCC',
      background: 'FFFFFF',
    },
  },
  layout: {
    pageWidth:        12240,
    pageHeight:       15840,
    marginTop:        1440,
    marginRight:      1440,
    marginBottom:     1440,
    marginLeft:       1440,
    imageMaxWidthDXA: 9360,
  },
  header: { left: null, right: null },
  footer: { left: null, right: 'Page {page}' },
};

const templates = {
  default: defaultTemplate,
  wwt:     require('./wwt'),
};

function getTemplate(name) { return templates[name] || templates.wwt; }
function listTemplates() {
  return Object.entries(templates).map(([key, t]) => ({ key, name: t.name, description: t.description }));
}

module.exports = { getTemplate, listTemplates };
