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

// ignore this line 

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
				var argument = parseInt(arguments[1], 10);
						const maxLogEntries = 25;
						if (argument > maxLogEntries) {
							message.reply(`Too many logs requested. Showing the first ${maxLogEntries} entries instead.`);
							argument = maxLogEntries;
						}
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
				const maxEmbedLength = 4000;
				for(var i = 0; i < logdata.length; i++) {
 					var obj = logdata[i];
					var invisibleChar = '\u200B';
					var j = i+1
					var entry = `${j}: ${obj.title} - \n${JSON.stringify(obj.data)} ${invisibleChar}\n\n`;
							if (descriptionBuffer.length + entry.length > maxEmbedLength) {
								descriptionBuffer += "...output truncated. Use a smaller !log number for more results.";
								break;
							}
							descriptionBuffer = `${descriptionBuffer}${entry}`;
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
	if (message.content === "!help") {
		const embed = new EmbedBuilder()
			.setTitle('Torn Helper Bot - Commands')
			.setDescription('!ping - checks the bot\'s latency\n!info - shows the bot\'s information\n!log [number] - shows the last [number] of logs from Torn City API\n!help - shows this help message')
		message.reply({ embeds: [embed] });
	}
	if (message.content.startsWith("!whatis")) {
		var arguments = message.content.split(' ');
		var type = arguments[1];
		var ID = parseInt(arguments[2]);
		if (!type || !ID) {
			message.reply("Error! what type of ID it is, and type the ID you wanna convert. Message example: !whatis item 206 (should return Xanax).\nacceptible types are: item, faction, company, property, merits, honors, stocks, and player. If you want to convert a player ID, use !whatis player [ID] instead of !whatis player [name].");
			return;
		} else {
			if (type === "item") {
				async function wrapperWhatisItem() {
					console.log(`querytype is item, ID is ${ID}`);
					var rawResponse = await fetch(`https://api.torn.com/v2/torn/items`, {
						"headers": {
							"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
							"content-type": "applications/json",
							"Authorization": `ApiKey ${process.env.TORN_API}`,
						}
					});
					var data = await rawResponse.json(); // debugging purposes, can be removed later
					var itemName = data.items?.[ID-1]?.name;
					console.log(`itemName is ${itemName}`); // debugging purposes, can be removed later
						if (!itemName) {
							message.reply(`Item ID ${ID} could not be found.`);
							return;
						}
					message.reply(`Item ID ${ID} is ${itemName}.`);
					console.log(`replied with ${itemName} for ${ID} (type = item)`); 
				} 
				wrapperWhatisItem();	
			} else if (type === "faction") {
				async function wrapperWhatisFaction() {
					console.log(`querytype is factions, ID is ${ID}`);
					var rawResponse = await fetch(`https://api.torn.com/v2/faction/${ID}/basic`, {
						"headers": {
							"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
							"content-type": "applications/json",
							"Authorization": `ApiKey ${process.env.TORN_API}`,
						}
					});
					var data = await rawResponse.json();
					var factionName = data.basic.name;
					var factionTag = data.basic.tag;
					var factionOld = data.basic.days_old;
					var factionMembers = `${data.basic.members} / ${data.basic.capacity}`; 
					var factionRespect = data.basic.respect;
					console.log(`faction name is ${factionName}`); 
						if (!factionName) {
							message.reply(`Faction ID ${ID} could not be found.`);
							return;
						}
					message.reply(`Faction ID ${ID} is [${factionTag}] ${factionName}, which is ${factionOld} days old, has ${factionMembers} members, and has ${factionRespect} respect.`);
					console.log(`replied with [${factionTag}] ${factionName}, which is ${factionOld} days old, has ${factionMembers} members, and has ${factionRespect} respect. type = factions)`); 
				} 
				wrapperWhatisFaction();	
			} else if (type === "company") {
				async function wrapperWhatisCompany() {
					console.log(`querytype is company, ID is ${ID}`);
					var rawResponse = await fetch(`https://api.torn.com/v2/company/${ID}/profile`, {
						"headers": {
							"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
							"content-type": "applications/json",
							"Authorization": `ApiKey ${process.env.TORN_API}`,
						}
					});
					var data = await rawResponse.json();
					var companyName = data.profile.name;
					var companyOwner = `${data.profile.director.name} [${data.profile.director.id}] `;
					var companyOld = data.profile.days_old;
					var companyEmployees = `${data.profile.employees.hired} / ${data.profile.employees.capacity}`;
					var companyDailyIncome = data.profile.income.daily;
					console.log(`company name is ${companyName}`); 
						if (!companyName) {
							message.reply(`Company ID ${ID} could not be found.`);
							return;
						}
					message.reply(`Company ID ${ID} is ${companyName}, which is ${companyOld} days old, has ${companyEmployees} employees, and has ${companyDailyIncome} daily income. It is made by ${companyOwner}`);
					console.log(`Company ID ${ID} is ${companyName}, which is ${companyOld} days old, has ${companyEmployees} employees, and has ${companyDailyIncome} daily income. It is made by ${companyOwner} (type = company)`); 
				} 
				wrapperWhatisCompany();	
			} else if (type === "property") {
				async function wrapperWhatisProperty() {
					console.log(`querytype is property, ID is ${ID}`);
					var rawResponse = await fetch(`https://api.torn.com/v2/property/${ID}/property`, {
						"headers": {
							"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
							"content-type": "applications/json",
							"Authorization": `ApiKey ${process.env.TORN_API}`,
						}
					});
					var data = await rawResponse.json();
					var propertyUpkeep = `${data.property.upkeep.property} per day for property fees, and additional ${data.property.upkeep.staff} per day for staff fees`;
					var propertyOwner = `${data.property.owner.name} [${data.property.owner.id}] `;
					var propertyHappiness = data.property.happy;
					var propertyValue = data.property.market_price;
					var propertyType = `${data.property.property.name} [${data.property.property.id}]`;
					message.reply(`Property ID ${ID} is ${propertyType}, which has ${propertyHappiness} happiness, and has a value of ${propertyValue}. It is owned by ${propertyOwner}. Upkeep is ${propertyUpkeep}.`);
					console.log(`Property ID ${ID} is ${propertyType}, which has ${propertyHappiness} happiness, and has a value of ${propertyValue}. It is owned by ${propertyOwner}. Upkeep is ${propertyUpkeep}. (type = property)`); 
				} 
				wrapperWhatisProperty();	
			}
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
