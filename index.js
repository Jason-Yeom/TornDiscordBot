const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
require('dotenv').config();

/*
async function UserBasic() {
	const rawResponseUserBasic = await fetch('https://api.torn.com/v2/user/basic', {
		method: "GET",
		headers: {
			"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
			"content-type": "applications/json",
			"Authorization": `ApiKey ${process.env.TORN_API}`
		}
	});

	const UserBasicJson = await rawResponseUserBasic.json;

	const playerTag = `${UserBasicJson.user.name} [${UserBasicJson.profile.id}]`;
};
*/

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});


client.once(Events.ClientReady, (readyClient) => {
	console.log(`logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, (message) => {
	if (message.author.bot) return;
	
	if (message.content === "!ping") {
		try { 
			async function pingEdit() {
				console.log("!ping detected!");
				var timeCalled = await Date.now();
				console.log(`got current time when !ping was called, ${timeCalled}`);
				var sent = await message.reply("Pong!");
				console.log(`sent the reply, "Pong!"`)
				var timeSent = await Date.now();
				console.log(`got the current time when Ping was sent, ${timeSent}`)
				var delay = await timeSent - timeCalled;
				console.log(`calculated the delay, ${delay}`);
				await sent.edit(`Pong! ${delay} ms`)
				console.log(`edited the message to; "Pong! ${delay} ms"`)
			}
			pingEdit();
		} catch (err) {
			var time = Date.now();
			console.error(`Time editing for !ping ran at epoch ${time} failed, defaulted to fallback by just not editing.`)
			return;
		}
	}

	if (message.content === "!info") {
		try {
			async function wrapper(){
			console.log(`!info detected`);
			async function UserBasic() {
				var rawResponseUserBasic = await fetch('https://api.torn.com/v2/user/basic', {
					method: "GET",
					headers: {
						"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
						"content-type": "applications/json",
						"Authorization": `ApiKey ${process.env.TORN_API}`
					}
				});
				console.log(`fetching from torn, path is https://api.torn.com/v2/user/basic`);
				var UserBasicJson = await rawResponseUserBasic.json();
				var textJson = await JSON.stringify(UserBasicJson);
				console.log(`converting it to json, result is ${textJson}`)
				var playerTag = `${UserBasicJson.profile.name} [${UserBasicJson.profile.id}]`;
				console.log(`player tag is ${playerTag}`);
				return playerTag;
			};
			const playerTag = await UserBasic();

			const embed = new EmbedBuilder()
				.setTitle('Bot Information')
				.setDescription(`Torn Helper Bot - configured to use ${playerTag}'s API information.`)
			message.reply({"embeds": [embed]});
			};
			wrapper();

		} catch (err) {
			console.error(`Error!: ${err}`);
			const embed = new EmbedBuilder()
				.setTitle("An Error Occured")
				.setDescription(`Error: ${err}`)
			message.reply({"embeds": [embed]});
			return;
		}
	}

	if (message.content.startsWith("!log")) {
		try {
			async function logger() {
				var arguments = message.content.split(' ');
				var argument = arguments[1];
				if (isNaN(argument)) {
					message.reply("Error! Enter a correct number of logs you wanna view. Message example: !log 10")
					return;
				};
				var rawResponseLog = await fetch('https://api.torn.com/v2/user/log', {
					"method": "GET",
					"headers": {
						"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
						"content-type": "applications/json",
						"Authorization": `ApiKey ${process.env.TORN_API}`,
					}
				});
				var log = await rawResponseLog.json();
				var logString = JSON.stringify(log);
				var listLog = [];
				var buffer = "[";
				try {
					for (var i=0; i<argument; i++ ) {
						var title = log.log[i].details.title;
						var titletext = JSON.stringify(title);
						var data = log.log[i].data;
						var datatext = JSON.stringify(data);
						var buffer = buffer + `{"title":${titletext},"data":${datatext}},`;
					};
				} catch (err) {
					message.reply(`Error accured while getting the JSON. most of the time, this is due to the log query being too long. Try lowering it to 100. \n ${err}`)
					console.error(`Error accured while getting the JSON. most of the time, this is due to the log query being too long. Try lowering it to 100. following is the error log/ ${err}`);
					return;
				}
				buffer = buffer.slice(0, -1);
				buffer = `${buffer}]`;
				// json is made in logdata, configure it to be readable and sendable and send it via embed.
				try {
					var logdata = JSON.parse(buffer);
				} catch (err) {
					message.reply(`Error! probably this is due to using negative numbers. following is the error log: ${err}`)
					console.error(`${err} happened while parsing JSON. JSON's text version was ${buffer}`);
					return;
				}
				var descriptionBuffer = "";
				for(var i = 0; i < logdata.length; i++) {
 					var obj = logdata[i];
					var invisibleChar = '\u200B';
					var j = i+1
					descriptionBuffer = `${descriptionBuffer}${j}: ${obj.title} - \n${JSON.stringify(obj.data)} ${invisibleChar}\n\n`
				};
				var logembed = new EmbedBuilder()
					.setColor(0xa8e843)
					.setTitle('Torn City Log Viewer')
					.setURL('https://www.torn.com/page.php?sid=log')
					.setDescription(descriptionBuffer)
				message.reply({ embeds: [logembed] });
			};
			logger();
		} catch (err) {
			message.reply(`an error accured; ${err}`);
			console.error(`Error accured while !log: ${err}`);
			return;
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
