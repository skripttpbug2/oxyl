const util = require("util");
const config = framework.config;

exports.cmd = new Oxyl.Command("eval", async message => {
	let guild = message.channel.guild, channel = message.channel, author = message.author, member = message.member;
	// So the executor can use in eval

	let msg = await message.channel.createMessage("Executing code...");
	try {
		let output = await eval(`(async function(){${message.argsPreserved[0]}}).call()`);
		output = util.inspect(output, { depth: 0 }).substring(0, 1900);
		for(let i in config.private) {
			if(typeof i === "object") {
				for(let i2 in config.private[i]) output = output.replace(new RegExp(config.private[i2], "ig"), "no u");
			} else {
				output = output.replace(new RegExp(config.private[i], "ig"), "no u");
			}
		}
		msg.edit(`:white_check_mark: **Output:** ${framework.codeBlock(output, "js")}`);
	} catch(error) {
		msg.edit(`:x: **Error:** ${framework.codeBlock(error)}`);
	}

	return false;
}, {
	type: "creator",
	description: "Execute code",
	args: [{
		type: "text",
		label: "code"
	}]
});
