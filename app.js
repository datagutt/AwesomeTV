var express = require('express'),
http = require('http'),
mongoose = require('mongoose'),
TVDB = require('tvdb'),
jade = require('jade'),
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
var providers = config['providers'] ? config['providers'] : ['ezrss', 'ezfallback', 'dailytvtorrents'];
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
Show.prototype.getEpisodes = function getEpisodes(callback, res){
	var self = this;
	getShow(self.name, function(show){
		self.tvdbID = show.tvdbID;
		var myModel = mongoose.model('episodes', self.schema);
		var eps = [], specials = [];
		myModel.find({'show': self.name}, function (err, docs) {
			// If this show has no episodes, fetch them.
			if(docs.length == 0){
				self.fetchEpisodes(self.tvdbID, res);
			}else{
				// Add everything under season 0 to 'Specials'
				var filteredEps = docs.forEach(function(ep, i){
					if(ep.season == 0){
						specials.push(ep);
					}else{
						eps.push(ep);
					}
					if(i >= (docs.length - 1)){
						// Sort using tvdbID
						var sortedEps = eps.sort(function(ep, ep2){
							return ep.tvdbID - ep2.tvdbID;
						});
						callback(sortedEps);
					}
				});
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
function download(fileURL, res){
	if(config['torrent'] && config['torrent']['dir']){
		var torrentDir = config['torrent']['dir'];
		var options = {
			host: url.parse(fileURL).host,
			port: 80,
			path: url.parse(fileURL).pathname
		};
		try{
			var fileName = url.parse(fileURL).pathname.match(/[^\/]+$/)[0];
		}catch(e){
			console.log('File name could not be extracted! Aborting...');
			return;
		}
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
		providers.every(function(provider){
			var r = require('./providers/' + provider + '.js');
			var provider = new r[provider](res);
			if(typeof provider.getTorrent == 'function'){
				provider.getTorrent(req.params.show, req.params.episode, function(link){
					if(link){
						console.log('Starting download...');
						download(link, res);
						return false;
					}else{
						console.log('Could not find S' + needed.join('E') + ' for show ' + show);
						res.send('Could not find S' + needed.join('E') + ' for show ' + show);
					}
				});
			}
			return true;
		});
	}
});
app.listen(1337, function(){
	console.log('AwesomeTV is running on port 1337.');
});