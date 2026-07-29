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

const formatMessageContext = (message) => {
	const guildName = message.guild?.name || 'DM';
	const channelName = message.channel?.name || message.channel?.id || 'unknown';
	return `guild=${guildName} channel=${channelName} user=${message.author?.tag || message.author?.id || 'unknown'} (${message.author?.id || 'unknown'})`;
};

const logMessageEvent = (message, detail, level = 'log') => {
	const timestamp = new Date().toISOString();
	const output = level === 'warn'
		? console.warn
		: level === 'error'
			? console.error
			: console.log;

	output(`[${timestamp}] ${detail} | ${formatMessageContext(message)} | content="${message.content || ''}"`);
};

const safeReply = async (message, payload) => {
	try {
		logMessageEvent(message, 'Attempting to send reply', 'log');
		await message.reply(payload);
		logMessageEvent(message, 'Reply sent successfully', 'log');
	} catch (error) {
		logMessageEvent(message, `Reply failed: ${error?.message || error}`, 'error');
	}
};

const safeFetchJson = async (message, url, options = {}) => {
	try {
		logMessageEvent(message, `Fetching Torn API: ${url}`, 'log');

		if (!process.env.TORN_API) {
			throw new Error('Missing TORN_API environment variable.');
		}

		const response = await fetch(url, {
			method: 'GET',
			...options,
			headers: {
				'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
				'content-type': 'application/json',
				Authorization: `ApiKey ${process.env.TORN_API}`,
				...(options.headers || {})
			}
		});

		if (!response.ok) {
			throw new Error(`Torn API responded with HTTP ${response.status}`);
		}

		const data = await response.json();
		logMessageEvent(message, `Fetched Torn API successfully from ${url}`, 'log');
		return { data, error: null };
	} catch (error) {
		logMessageEvent(message, `Torn API request failed for ${url}: ${error?.message || error}`, 'error');
		return { data: null, error };
	}
};

const handleCommandError = async (message, context, error) => {
	logMessageEvent(message, `${context} failed: ${error?.message || error}`, 'error');
	await safeReply(message, `That command could not be completed right now. ${error?.message || error}`);
};

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) {
		logMessageEvent(message, 'Ignored bot message', 'log');
		return;
	}

	logMessageEvent(message, 'Received message', 'log');

	try {
		if (message.content === '!ping') {
			logMessageEvent(message, 'Handling !ping command', 'log');
			const timeCalled = Date.now();
			const sent = await message.reply('Pong!');
			const timeSent = Date.now();
			const delay = timeSent - timeCalled;
			await sent.edit(`Pong! ${delay} ms`);
			logMessageEvent(message, `!ping completed with ${delay} ms latency`, 'log');
			return;
		}

		if (message.content === '!info') {
			logMessageEvent(message, 'Handling !info command', 'log');
			const { data, error } = await safeFetchJson(message, 'https://api.torn.com/v2/user/basic');
			if (error || !data?.profile) {
				logMessageEvent(message, `!info failed: ${error?.message || 'missing profile data'}`, 'warn');
				await safeReply(message, 'Unable to fetch your Torn info right now.');
				return;
			}

			const playerTag = `${data.profile.name} [${data.profile.id}]`;
			const embed = new EmbedBuilder()
				.setTitle('Bot Information')
				.setDescription(`Torn Helper Bot - configured to use ${playerTag}'s API information.`);
			await safeReply(message, { embeds: [embed] });
			logMessageEvent(message, `!info succeeded for ${playerTag}`, 'log');
			return;
		}

		if (message.content.startsWith('!log')) {
			const args = message.content.trim().split(/\s+/);
			let argument = parseInt(args[1], 10);
			const maxLogEntries = 25;
			logMessageEvent(message, `Handling !log with arguments: ${args.slice(1).join(', ') || 'none'}`, 'log');

			if (!Number.isInteger(argument) || argument < 1) {
				logMessageEvent(message, 'Invalid !log usage: missing or invalid number', 'warn');
				await safeReply(message, 'Error! Enter a correct number of logs you want to view. Example: !log 10');
				return;
			}

			if (argument > maxLogEntries) {
				logMessageEvent(message, `!log request exceeded max; truncating to ${maxLogEntries}`, 'warn');
				await safeReply(message, `Too many logs requested. Showing the first ${maxLogEntries} entries instead.`);
				argument = maxLogEntries;
			}

			const { data, error } = await safeFetchJson(message, 'https://api.torn.com/v2/user/log');
			if (error || !Array.isArray(data?.log)) {
				logMessageEvent(message, `!log failed: ${error?.message || 'missing log array'}`, 'warn');
				await safeReply(message, 'Unable to fetch logs right now. Try a smaller number of entries.');
				return;
			}

			const logEntries = data.log.slice(0, argument);
			if (logEntries.length === 0) {
				logMessageEvent(message, '!log returned no entries', 'warn');
				await safeReply(message, 'No log entries were returned for that request.');
				return;
			}

			const descriptionBuffer = [];
			const maxEmbedLength = 4000;
			let bufferLength = 0;

			for (let i = 0; i < logEntries.length; i++) {
				const entry = logEntries[i];
				const title = entry?.details?.title || 'Untitled';
				const dataPayload = entry?.data ? JSON.stringify(entry.data) : '{}';
				const text = `${i + 1}: ${title} -\n${dataPayload}\n\n`;

				if (bufferLength + text.length > maxEmbedLength) {
					descriptionBuffer.push('...output truncated. Use a smaller !log number for more results.');
					break;
				}

				descriptionBuffer.push(text);
				bufferLength += text.length;
			}

			const logembed = new EmbedBuilder()
				.setColor(0xa8e843)
				.setTitle('Torn City Log Viewer')
				.setURL('https://www.torn.com/page.php?sid=log')
				.setDescription(descriptionBuffer.join(''));

			await safeReply(message, { embeds: [logembed] });
			logMessageEvent(message, `!log succeeded with ${logEntries.length} entries`, 'log');
			return;
		}

		if (message.content === '!help') {
			logMessageEvent(message, 'Handling !help command', 'log');
			const embed = new EmbedBuilder()
				.setTitle('Torn Helper Bot - Commands')
				.setDescription('!ping - checks the bot\'s latency\n!info - shows the bot\'s information\n!log [number] - shows the last [number] of logs from Torn City API\n!help - shows this help message');
			await safeReply(message, { embeds: [embed] });
			logMessageEvent(message, '!help completed', 'log');
			return;
		}

		if (message.content.startsWith('!whatis')) {
			const args = message.content.trim().split(/\s+/);
			const type = args[1];
			const ID = parseInt(args[2], 10);
			logMessageEvent(message, `Handling !whatis with type=${type || 'none'} id=${ID || 'none'}`, 'log');

			if (!type || !Number.isInteger(ID) || ID < 1) {
				logMessageEvent(message, 'Invalid !whatis usage: missing type or ID', 'warn');
				await safeReply(message, 'Error! Provide both a type and a valid ID. Example: !whatis item 206');
				return;
			}

			if (type === 'item') {
				const { data, error } = await safeFetchJson(message, 'https://api.torn.com/v2/torn/items');
				if (error || !Array.isArray(data?.items)) {
					logMessageEvent(message, `!whatis item failed for ID ${ID}: ${error?.message || 'missing items array'}`, 'warn');
					await safeReply(message, `Item ID ${ID} could not be fetched right now.`);
					return;
				}

				const itemName = data.items[ID - 1]?.name;
				if (!itemName) {
					logMessageEvent(message, `!whatis item could not find ID ${ID}`, 'warn');
					await safeReply(message, `Item ID ${ID} could not be found.`);
					return;
				}

				await safeReply(message, `Item ID ${ID} is ${itemName}.`);
				logMessageEvent(message, `!whatis item succeeded for ID ${ID}: ${itemName}`, 'log');
				return;
			}

			if (type === 'faction') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/faction/${ID}/basic`);
				if (error || !data?.basic) {
					logMessageEvent(message, `!whatis faction failed for ID ${ID}: ${error?.message || 'missing basic data'}`, 'warn');
					await safeReply(message, `Faction ID ${ID} could not be fetched right now.`);
					return;
				}

				const factionName = data.basic.name;
				const factionTag = data.basic.tag;
				const factionOld = data.basic.days_old;
				const factionMembers = `${data.basic.members} / ${data.basic.capacity}`;
				const factionRespect = data.basic.respect;

				if (!factionName) {
					logMessageEvent(message, `!whatis faction could not find ID ${ID}`, 'warn');
					await safeReply(message, `Faction ID ${ID} could not be found.`);
					return;
				}

				await safeReply(message, `Faction ID ${ID} is [${factionTag}] ${factionName}, which is ${factionOld} days old, has ${factionMembers} members, and has ${factionRespect} respect.`);
				logMessageEvent(message, `!whatis faction succeeded for ID ${ID}: ${factionName}`, 'log');
				return;
			}

			if (type === 'company') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/company/${ID}/profile`);
				if (error || !data?.profile) {
					logMessageEvent(message, `!whatis company failed for ID ${ID}: ${error?.message || 'missing profile data'}`, 'warn');
					await safeReply(message, `Company ID ${ID} could not be fetched right now.`);
					return;
				}

				const companyName = data.profile.name;
				const companyOwner = `${data.profile.director?.name || 'Unknown'} [${data.profile.director?.id || 'Unknown'}]`;
				const companyOld = data.profile.days_old;
				const companyEmployees = `${data.profile.employees?.hired || 0} / ${data.profile.employees?.capacity || 0}`;
				const companyDailyIncome = data.profile.income?.daily || 0;

				if (!companyName) {
					logMessageEvent(message, `!whatis company could not find ID ${ID}`, 'warn');
					await safeReply(message, `Company ID ${ID} could not be found.`);
					return;
				}

				await safeReply(message, `Company ID ${ID} is ${companyName}, which is ${companyOld} days old, has ${companyEmployees} employees, and has ${companyDailyIncome} daily income. It is made by ${companyOwner}`);
				logMessageEvent(message, `!whatis company succeeded for ID ${ID}: ${companyName}`, 'log');
				return;
			}

			if (type === 'property') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/property/${ID}/property`);
				if (error || !data?.property) {
					logMessageEvent(message, `!whatis property failed for ID ${ID}: ${error?.message || 'missing property data'}`, 'warn');
					await safeReply(message, `Property ID ${ID} could not be fetched right now.`);
					return;
				}

				const propertyUpkeep = `${data.property.upkeep?.property || 0} per day for property fees, and additional ${data.property.upkeep?.staff || 0} per day for staff fees`;
				const propertyTotalUpkeep = (data.property.upkeep?.property || 0) + (data.property.upkeep?.staff || 0);
				const propertyOwner = `${data.property.owner?.name || 'Unknown'} [${data.property.owner?.id || 'Unknown'}]`;
				const propertyHappiness = data.property.happy || 0;
				const propertyValue = data.property.market_price || 0;
				const propertyType = `${data.property.property?.name || 'Unknown'} [${data.property.property?.id || 'Unknown'}]`;

				await safeReply(message, `Property ID ${ID} is ${propertyType}, which has ${propertyHappiness} happiness, and has a value of ${propertyValue}. It is owned by ${propertyOwner}. Upkeep is ${propertyUpkeep}, which totals to ${propertyTotalUpkeep} per day.`);
				logMessageEvent(message, `!whatis property succeeded for ID ${ID}: ${propertyType}`, 'log');
				return;
			}

			if (type === 'merit') {
				const { data, error } = await safeFetchJson(message, 'https://api.torn.com/v2/torn/merits');
				if (error || !Array.isArray(data?.merits)) {
					logMessageEvent(message, `!whatis merit failed for ID ${ID}: ${error?.message || 'missing merits array'}`, 'warn');
					await safeReply(message, `Merit ID ${ID} could not be fetched right now.`);
					return;
				}

				const meritName = data.merits[ID - 1]?.name;
				const meritDescription = data.merits[ID - 1]?.description;

				if (!meritName) {
					logMessageEvent(message, `!whatis merit could not find ID ${ID}`, 'warn');
					await safeReply(message, `Merit ID ${ID} could not be found.`);
					return;
				}

				await safeReply(message, `Merit ID ${ID} is ${meritName}, which has the description: ${meritDescription}`);
				logMessageEvent(message, `!whatis merit succeeded for ID ${ID}: ${meritName}`, 'log');
				return;
			}

			if (type === 'honor') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/torn/${ID}/honors`);
				if (error || !Array.isArray(data?.honors) || data.honors.length === 0) {
					logMessageEvent(message, `!whatis honor failed for ID ${ID}: ${error?.message || 'missing honor data'}`, 'warn');
					await safeReply(message, `Honor ID ${ID} could not be fetched right now.`);
					return;
				}

				const honor = data.honors[0];
				const honorName = honor?.name;
				const honorDescription = honor?.description;
				const honorCirculation = honor?.circulation;
				const honorRarity = honor?.rarity;
				const honorGroup = honor?.type?.title || 'unknown';

				if (!honorName) {
					logMessageEvent(message, `!whatis honor could not find ID ${ID}`, 'warn');
					await safeReply(message, `Honor ID ${ID} could not be found.`);
					return;
				}

				await safeReply(message, `Honor ID ${ID} is ${honorName}, which has the description: ${honorDescription}. It has a circulation of ${honorCirculation}, is ${honorRarity} rarity, and belongs to the ${honorGroup} group.`);
				logMessageEvent(message, `!whatis honor succeeded for ID ${ID}: ${honorName}`, 'log');
				return;
			}

			if (type === 'stock') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/torn/${ID}/stocks`);
				if (error || !data?.stocks) {
					logMessageEvent(message, `!whatis stock failed for ID ${ID}: ${error?.message || 'missing stock data'}`, 'warn');
					await safeReply(message, `Stock ID ${ID} could not be fetched right now.`);
					return;
				}

				const stock = data.stocks;
				const stockName = stock?.name || 'Unknown';
				const stockTag = stock?.acronym || 'Unknown';
				const stockPrice = stock?.market?.price || 0;
				const stockShares = stock?.market?.shares || 0;
				const stockInvestors = stock?.market?.investors || 0;
				const stockPassive = stock?.bonus?.passive ? 'gives the investors passive bonus.' : 'does not give the investors passive bonus.';
				const stockBonusRequirement = stock?.bonus?.requirement || 0;
				const stockBonusDescription = stock?.bonus?.description || 'No bonus description available.';

				await safeReply(message, `Stock ID ${ID} is ${stockName} (${stockTag}), priced at ${stockPrice} with ${stockShares} shares. Currently, ${stockInvestors} investors are involved. If you invest ${stockBonusRequirement}, you can get a bonus of ${stockBonusDescription}. This bonus ${stockPassive}.`);
				logMessageEvent(message, `!whatis stock succeeded for ID ${ID}: ${stockName}`, 'log');
				return;
			}

			if (type === 'player') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/user/${ID}/basic`);
				if (error || !data?.profile) {
					logMessageEvent(message, `!whatis player failed for ID ${ID}: ${error?.message || 'missing profile data'}`, 'warn');
					await safeReply(message, `Player ID ${ID} could not be fetched right now.`);
					return;
				}

				const playerName = `${data.profile.name} [${data.profile.id}]`;
				const playerLevel = data.profile.level || 'unknown';
				const playerStatus = `${data.profile.status?.state || 'Unknown'} - ${data.profile.status?.description || 'No status available'}`;
				const playerGender = data.profile.gender || 'A';

				await safeReply(message, `${playerGender} player ${playerName} is at level ${playerLevel} and has the status: ${playerStatus}.`);
				logMessageEvent(message, `!whatis player succeeded for ID ${ID}: ${playerName}`, 'log');
				return;
			}

			logMessageEvent(message, `Unsupported !whatis type: ${type}`, 'warn');
			await safeReply(message, 'Unsupported type. Supported types are: item, faction, company, property, merit, honor, stock, and player.');
		}
	} catch (error) {
		await handleCommandError(message, 'Message handler', error);
	}
});

client.login(process.env.DISCORD_TOKEN);
