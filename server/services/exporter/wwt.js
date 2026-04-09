'use strict';

const ASSET_BASE = require('path').join(__dirname, '../../../assets') + '/';

const wwtTemplate = {
  name:        'WWT',
  description: 'World Wide Technology brand template.',
  assetBase:   ASSET_BASE,
  assets: {
    logo:         ASSET_BASE + 'wwt-logo.png',
    logoWhite:    ASSET_BASE + 'wwt-logo-white.png',
    monogram:     ASSET_BASE + 'wwt-monogram.png',
    gradientRule: ASSET_BASE + 'wwt-gradient-rule.png',
  },
  logoAspectRatio:     4.7900,
  monogramAspectRatio: 1.9793,
  gradientRuleRatio:   132.7083,
  styles: {
    fontFamily:   'Arial',
    baseFontSize: 11,
    headingSize:  22,
    subheadSize:  16,
    colors: {
      heading:    '0086EA',
      body:       '262626',
      accent:     '0086EA',
      border:     '0086EA',
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
    logoWidthPt:      108,
    monogramWidthPt:  64,
  },
  header: { left: 'LOGO', right: null },
  footer: { left: 'World Wide Technology', right: 'Page {page}' },
};

module.exports = wwtTemplate;
