const Discord = require("discord.js"),
	music = require("../../modules/music.js"),
	Oxyl = require("../../oxyl.js"),
	framework = require("../../framework.js");

Oxyl.registerCommand("stop", "music", (message, bot) => {
	var voice = music.voiceCheck(message.member);
	var guild = message.guild;
	if(!voice) {
		return "you and Oxyl must both be in the same channel to stop the music";
	} else {
		voice.leave();
		music.clearData(guild);
		return `Stopped the music in ${voice.name}`;
	}
}, ["end"], "Stop the music in your channel", "[]");
