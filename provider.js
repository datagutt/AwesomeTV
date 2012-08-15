
var FeedParser = require('feedparser');
var Provider = function(res){
	this.res = res;
};
Provider.prototype.url = 'http://host.tld/?name=%show%';
Provider.prototype.titleRegex = /S(\d*)E(\d*)/;
Provider.prototype.withZero = 1;
Provider.prototype.getTorrent = function getTorrent(show, needed, callback){
	var parser = new FeedParser(), link, self = this;
	var res = self.res;
	if(!needed || !show){
		throw new Error('No arguments specified!');
	}
	// Ugly hax
	needed = needed.replace('S', '').split('E');
	// Convert from string to number
	needed[0] = parseInt(needed[0], 10);
	needed[1] = parseInt(needed[1], 10);
	if(this.withZero){
		if(needed[0] < 10){
			needed[0] = '0' + needed[0];
		}
		if(needed[1] < 10){
			needed[1] = '0' + needed[1];
		}
	}
	parser.parseUrl(self.url.replace('%show%', encodeURIComponent(show)), function(error, meta, articles){
		if(error){
			console.log(error);
		}else if(articles.length == 0){
			console.log('No torrents found. This might be an invalid show or episode, or the provider might be down.');
		}else{
			// Abuse of every (http://stackoverflow.com/questions/6260756/how-to-stop-javascript-foreach)
			articles.every(function(article){
			console.log(article);
				var title = article.title.match(self.titleRegex);
				var link = article.link;
				if(title){
					var season = title[1];
					var episode = title[2];
					if(needed && needed[0] == season && needed[1] == episode){
						callback(link);
						return false;
					}
				}
				return true;
			});
		}
	});
}
exports.FeedParser = FeedParser;
exports.Provider = Provider;