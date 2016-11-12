const Discord = require("discord.js"),
	Oxyl = require("../oxyl.js"),
	framework = require("../framework.js"),
	https = require("https"),
	yt = require("ytdl-core");
const config = framework.config;
var defaultVolume = config.options.commands.defaultVolume;
var data = { queue: {}, current: {}, volume: {}, ytinfo: {}, options: {} };

exports.setRepeat = (guild, value) => {
	var options = data.options;
	if(!options[guild.id]) {
		options[guild.id] = [];
	}
	options[guild.id].repeat = value;
};

exports.getVideoId = (url) => {
	var videoFilter = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;
	var match = url.match(videoFilter);
	if(match && match[1]) {
		return match[1];
	} else {
		return "INVALID_URL";
	}
};

exports.searchVideo = (query) => {
	var ytData = "";
	var options = {
		host: "www.googleapis.com",
		path: `/youtube/v3/search?part=snippet&maxResults=1&type=video&q=${escape(query)}&key=${config.googleKey}`
	};
	return new Promise((resolve, reject) => {
		var request = https.request(options, (res) => {
			res.on("data", (chunk) => {
				ytData += chunk;
			});
			res.on("end", () => {
				if(ytData.indexOf('videoId') >= 0) {
					ytData = JSON.parse(ytData).items[0].id.videoId;
					resolve(ytData);
				} else {
					resolve("NO_RESULTS");
				} });
			res.on("error", () => {
				reject("Error contacting Youtube API");
			});
		});
		request.end();
	});
};

exports.addPlaylist = (playlistId, guild, connection) => {
	var options = {
		host: "www.googleapis.com",
		path: `/youtube/v3/playlistItems?playlistId=${playlistId}&maxResults=50&part=snippet` +
				`&fields=items(snippet(resourceId(videoId)))&key=${config.googleKey}`
	};
	var request = https.request(options, (res) => {
		var ytData = "";
		res.on("data", (chunk) => {
			ytData += chunk;
		});
		res.on("end", () => {
			var info = JSON.parse(ytData).items;
			for(var i = 0; i < info.length; i++) {
				let videoId = info[i].snippet.resourceId.videoId;

				setTimeout(() => {
					exports.addInfo(videoId, guild);
					exports.addQueue(videoId, guild, connection);
				}, i * 25);
			}
		});
		res.on("error", (err) => {
			framework.consoleLog(`Error while contacting Youtube API: ${framework.codeBlock(err.stack)}`, "debug");
		});
	});
	request.end();
};

exports.addInfo = (videoId, guild) => {
	var ytInfo = data.ytinfo;
	var options = {
		host: "www.googleapis.com",
		path: `/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&fields=items(snippet(title),contentDetails(duration))&key=${config.googleKey}`
	};
  // Return a promise for a then in play.js command
	return new Promise((resolve, reject) => {
		var request = https.request(options, (res) => {
			var ytData = "";
			res.on("data", (chunk) => {
				ytData += chunk;
			});
			res.on("end", () => {
				var info = JSON.parse(ytData).items[0], durationParsed = 0;
				var dur = info.contentDetails.duration;
				durationParsed += parseInt(dur.substring(dur.indexOf("T") + 1, dur.indexOf("M"))) * 60;
				durationParsed += parseInt(dur.substring(dur.indexOf("M") + 1, dur.length - 1));
				if(!ytInfo[guild.id]) {
					ytInfo[guild.id] = [];
				}
				ytInfo[guild.id][videoId] = {
					title: info.snippet.title,
					duration: durationParsed
				};
				resolve(ytInfo[guild.id][videoId]);
			});
			res.on("error", (err) => {
				framework.consoleLog(`Error while contacting Youtube API: ${framework.codeBlock(err.stack)}`, "debug");
				reject("Error contacting Youtube API");
			});
		});
		request.end();
	});
};

// Use to assure user is in channel
exports.voiceCheck = (guildMember) => {
	var guild = guildMember.guild;
	var channelMember = guildMember.voiceChannel;
	var channelBot = guild.voiceConnection;
	if(!channelMember || !channelBot) {
		return false;
	} else if(channelBot.channel.id !== channelMember.id) {
		return false;
	} else {
		return guildMember.voiceChannel;
	}
};

exports.getPlayTime = (guild) => exports.getDispatcher(guild).time;

exports.processQueue = (guild, connection) => {
	var queue = data.queue;
	var current = data.current;
	var volume = data.volume;
	if(!queue[guild.id]) {
		queue[guild.id] = [];
	}
	var queueLength = queue[guild.id].length;
	if(!current[guild.id] && queueLength > 0) {
		exports.playVideo(queue[guild.id][0], guild, connection);
		queue[guild.id] = queue[guild.id].slice(1);
	} else if(queueLength <= 0) {
		connection.disconnect();
		delete queue[guild.id];
		delete volume[guild.id];
		delete current[guild.id];
	}
};

exports.addQueue = (videoId, guild, connection) => {
	if(!connection) { connection = guild.voiceConnection; }
	var queue = data.queue;
	if(!queue[guild.id]) {
		queue[guild.id] = [];
	}
	queue[guild.id].push(videoId);
	exports.processQueue(guild, connection);
};

exports.endStream = (guild) => {
	var connection = exports.getDispatcher(guild);
	if(!connection) { return; }

	connection.end();
};

exports.pauseStream = (guild) => {
	var connection = exports.getDispatcher(guild);
	if(!connection) { return; }

	connection.pause();
};

exports.resumeStream = (guild) => {
	var connection = exports.getDispatcher(guild);
	if(!connection) { return; }

	connection.resume();
};

exports.setVolume = (guild, newVolume) => {
	var connection = exports.getDispatcher(guild);
	var volume = data.volume;
	if(newVolume > 100) {
		newVolume = 100;
	} else if(newVolume < 0) {
		newVolume = 0;
	}
	if(!connection) { return; }

	connection.setVolume(newVolume / 200);
	volume[guild.id] = newVolume;
};

exports.leaveVoice = (guild) => {
	guild.voiceConnection.disconnect();
};

exports.getDispatcher = (guild) => {
	if(!guild.voiceConnection) {
		return false;
	} else if(!guild.voiceConnection.player.dispatcher) {
		return false;
	} else {
		return guild.voiceConnection.player.dispatcher;
	}
};

exports.playVideo = (videoId, guild, connection) => {
	var volume = data.volume;
	var current = data.current;
	var ytInfo = data.ytinfo;
	var options = data.options;
	if(!volume[guild.id]) {
		volume[guild.id] = defaultVolume;
	}
	var playVolume = volume[guild.id] / 200;
	current[guild.id] = videoId;

	let url = `http://youtube.com/watch?v=${videoId}`;
	let stream = yt(url, { audioonly: true });

	var dispatcher = connection.playStream(stream, { volume: playVolume });
	dispatcher.on("end", () => {
		delete current[guild.id];
		exports.processQueue(guild, connection);

		if(options[guild.id] && options[guild.id].repeat) {
			exports.addQueue(videoId, guild, connection);
		} else if(ytInfo[guild.id] && ytInfo[guild.id][videoId]) {
			delete ytInfo[guild.id][videoId];
		}
	});
};

exports.getDuration = (number) => {
	var mins = Math.floor(number / 60);
	var secs = Math.floor(number % 60);
	if(mins < 10) {
		mins = `0${mins}`;
	} if(secs < 10) {
		secs = `0${secs}`;
	}
	return `${mins}:${secs}`;
};

exports.data = data;