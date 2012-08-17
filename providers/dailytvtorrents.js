var Provider = require('../provider.js').Provider;
var dailytvtorrents = Provider;
dailytvtorrents.prototype.url = 'http://www.dailytvtorrents.org/rss/show/%show%';
dailytvtorrents.prototype.titleRegex = /S(\d*)E(\d*)/;
dailytvtorrents.prototype.withZero = 1;
dailytvtorrents.prototype.fixTitle = function(title){
	return title.toLowerCase().replace(' ', '-');
}
dailytvtorrents.prototype.parse = function(article, needed, callback){
	var self = this;
	var title = article.title.match(self.titleRegex);
	var link = article.description.match('href="(http://[^"]*)"');
	if(link && link[1]){
		link = link[1];
	}
	if(title){
		var season = title[1];
		var episode = title[2];
		if(needed && needed[0] == season && needed[1] == episode){
			callback(link);
			return false;
		}
	}
	return true;
}

exports.dailytvtorrents = dailytvtorrents;