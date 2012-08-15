var Provider = require('../provider.js').Provider;
var ezrss = Provider;
ezrss.prototype.url = 'http://www.ezrss.it/search/?mode=rss&show_name=%show%';
ezrss.prototype.titleRegex = /(\d*)x(\d*)/;
ezrss.prototype.withZero = 0;
exports.ezrss = ezrss;