var express = require('express'),
http = require('http'),
mongoose = require('mongoose'),
TVDB = require('tvdb'),
jade = require('jade'),
FeedParser = require('feedparser'),
url = require('url'),
fs = require('fs');
app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', {layout:true});
app.configure(function(){
	app.use(express['static'](__dirname + '/public'));
	app.use(app.router);
});
var config = require('./config.js').config;
if(config){
	try{
		mongoose.connect('mongodb://' + config['db']['host'] + '/' + config['db']['database'] + '');
		tvdb = new TVDB({apiKey: config['api']['tvdb']});
	}catch(e){
		throw new Error('Database does not exist!');
	}
}else{
	throw new Error('Please make a config file, look at config.example.js.');
}
var Schema = mongoose.Schema;
// TV Show listings
var Show = function Show(name){
	this.schema = new Schema({
		show: {type: String},
		tvdbID: {type: Number},
		name: {type: String},
		number: {type: Number, default: 1},
		season: {type: Number, default: 1},
		airDate: {type: Date}
	});
	this.name = name;
}
//console.log(new Show('test'));
Show.prototype.getEpisodes = function getEpisodes(callback, res){
	var self = this;
	getShow(self.name, function(show){
		self.tvdbID = show.tvdbID;
		var myModel = mongoose.model('episodes', self.schema);
		var eps = [];
		myModel.find({'show': self.name}, function (err, docs) {
			docs.forEach(function(ep){
				eps.push(ep);
			});
			// If this show has no episodes, fetch them.
			if(eps.length == 0){
				self.fetchEpisodes(self.tvdbID, res);
			}else{
				callback(eps);
			}
		});
	});
};
Show.prototype.fetchEpisodes = function fetchEpisodes(tvdbID, res){
	var self = this;
	console.log('Fetching episodes...');
	tvdb.getInfo(tvdbID, function(err, data){
		if(err){
			throw err;
		}else if(!data){
			throw new Error('[TVDB] TVDB ID does not exist!');
		}
		var episodes = data.episodes;
		[].forEach.call(episodes, function(episode){
			var instance = {};
			instance.tvdbID = episode.EpisodeId;
			instance.name = episode.EpisodeName;
			instance.season = episode.Season;
			instance.number = episode.Episode;
			instance.airDate = episode.FirstAired;
			self.addEpisode(instance.tvdbID, instance.name, instance.season, instance.number, instance.airDate, res);
		});
	});
}
Show.prototype.addEpisode = function addEpisode(tvdbID, name, season, number, airDate, res){
	var myModel = mongoose.model('episodes', this.schema);
	var instance = new myModel();
	instance.show = this.name;
	instance.tvdbID = tvdbID;
	instance.name = name;
	instance.season = season;
	instance.number = number;
	instance.airDate = airDate;
	instance.save(function(){
		res.send('<meta http-equiv="refresh" content="0">');
	});
}
function getShow(name, callback){
	var mySchema = new Schema({
		name: {type: String},
		tvdbID: {type: Number},
		overview: {type: String}
	});
	var myModel = mongoose.model('shows', mySchema);
	myModel.find({'name': name}, function (err, docs) {
		if(err){
			throw err;
		}
		if(docs){
			show = docs[0];
			callback(show);
		}
	});
}
function getShows(callback){
	var mySchema = new Schema({
		name: {type: String},
		tvdbID: {type: Number},
		overview: {type: String}
	});
	var myModel = mongoose.model('shows', mySchema);
	var shows = [];
	myModel.find({}, function (err, docs) {
		docs.forEach(function(show){
			shows.push(show);
		});
		callback(shows);
	});
}
function addShow(name, res){
	var mySchema = new Schema({
		name: {type: String},
		tvdbID: {type: String},
		overview: {type: String}
	});	
	var myModel = mongoose.model('shows', mySchema);
	var instance = new myModel();
	if(name){
		tvdb.findTvShow(name, function(err, tvShows){
			if(tvShows.length == 0){
				throw new Error('[TVDB] No TV show returned!');
			}else if(tvShows.length > 1){
				//throw new Error('[TVDB] More than one TV show returned!');
			}
			var tvshow = tvShows[0];
			instance.name = tvshow.name;
			instance.tvdbID = tvshow.id;
			instance.overview = tvshow.overview;
			instance.save(function(err){
				if(err) throw err;
				res.send('{type: \'success\'}');
			});
		});
	}else{
		res.send('{type: \'error\', message: \'Name or IMDB ID not specified.\'}');
	}
}
function downloadIfNotExists(show, needed, res){
	var parser = new FeedParser(), link;
	if(!needed || !show){
		throw new Error('No arguments specified!');
	}
	// Ugly hax
	needed = needed.replace('S', '').split('E');
	needed[0] = parseInt(needed[0], 10);
	needed[1] = parseInt(needed[1], 10);
	if(needed[0] < 10){
		needed[0] = '0' + needed[0];
	}
	if(needed[1] < 10){
		needed[1] = '0' + needed[1];
	}
	parser.parseUrl('http://eztv.ptain.info/cgi-bin/eztv.pl?name=' + encodeURIComponent(show), function findTorrent(error, meta, articles){
		if(error){
			console.log(error);
		}else if(articles.length == 0){
			console.log('No torrents found. This might be an invalid show or episode, or eztv.ptain.info might be down.');
		}else{
			// Abuse of every (http://stackoverflow.com/questions/6260756/how-to-stop-javascript-foreach)
			articles.every(function (article){
				var title = article.title.match(/S(\d*)E(\d*)/);
				var link = article.link;
				if(title){
					var season = title[1];
					var episode = title[2];
					if(needed && needed[0] == season && needed[1] == episode){
						callback(link, res);
						return false;
					}
				}
				return true;
			});
			function callback(link, res){
				if(link){
					console.log('Starting download...');
					download(link, res);
				}else{
					console.log('Could not find S' + needed.join('E') + ' for show ' + show);
					res.send('Could not find S' + needed.join('E') + ' for show ' + show);
				}
			}
		}
	});
}
function download(fileURL, res){
	if(config['torrent'] && config['torrent']['dir']){
		var torrentDir = config['torrent']['dir'];
		var options = {
			host: url.parse(fileURL).host,
			port: 80,
			path: url.parse(fileURL).pathname
		};
		var fileName = url.parse(fileURL).pathname.match(/[^\/]+$/)[0];
		if(fileName == ''){
			console.log('File name is empty! Aborting...');
			return;
		}
		var file = fs.createWriteStream(torrentDir + fileName);
		console.log('Downloading...');
		http.get(options, function(_res) {
			_res.on('data', function(data) {
				file.write(data);
			}).on('end', function() {
				file.end();
				console.log(fileName + ' downloaded to ' + torrentDir);
				res.send(fileName + ' downloaded to ' + torrentDir);
			});
		});
	}
}
app.get('/', function(req, res){
	var shows = getShows(function(shows){
		res.render('shows', {shows: shows});
	});
});
app.get('/show/:show', function(req, res){
	var show = new Show(req.params.show);
	var dt = new Date();
	var date = dt.getTime();
	show.getEpisodes(function(eps){
		res.render('episodes', {showName: req.params.show, eps: eps, currentDate : date})
	}, res);
});
// API
app.get('/api/getShow/:show', function(req, res){
	var show = new Show(req.params.show);
	show.getEpisodes(function(eps){
		res.send('{showName: ' + req.params.show + ', eps: ' + eps + '}');
	});
});
app.get('/api/addShow/:name', function(req, res){
	if(req && req.params.name){
		addShow(req.params.name, res);
	}
});
app.get('/api/download/:show/:episode', function(req, res){
	if(req && req.params.show && req.params.episode){
		downloadIfNotExists(req.params.show, req.params.episode, res);
	}
});
app.listen(1337, function(){
	console.log('AwesomeTV is running on port 1337.');
});