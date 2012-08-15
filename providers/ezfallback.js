var Provider = require('../provider.js').Provider;
var ezfallback = Provider;
ezfallback.prototype.url = 'http://eztv.ptain.info/cgi-bin/eztv.pl?name=%show%';
ezfallback.prototype.titleRegex = /S(\d*)E(\d*)/;
ezfallback.prototype.withZero = 1;
exports.ezfallback = ezfallback;