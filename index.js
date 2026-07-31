const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

let alertChannel;

let hospitalAlertEnabled = false;
let travelAlertEnabled = false;
let drugAlertEnabled = false;
let boosterAlertEnabled = false;
let medAlertEnabled = false;

let hospitalAlertInterval = null;
let travelAlertInterval = null;
let drugAlertInterval = null;
let boosterAlertInterval = null;
let medAlertInterval = null;

var savedStatusHospital = "";
var savedStatusTravel = "";
var savedStatusDrug = "";
var savedStatusBooster = "";
var savedStatusMed = "";

let playerTag = "";

let discordID = "";



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

const formatUserTag = (name, id) => `${name || 'Unknown'} [${id || 'Unknown'}]`;

// Builds a fixed-size bar string. Always caps at `size` iterations,
// so a bad/zero `max` value from the API can never cause an infinite loop.
const buildBar = (current, max, emoji, size = 10) => {
	if (!Number.isFinite(max) || max <= 0) return "";
	const ratio = Math.min(1, Math.max(0, current / max));
	return emoji.repeat(Math.round(ratio * size));
};

const safeReply = async (message, payload) => {
	try {
		logMessageEvent(message, 'Attempting to send reply', 'log');
		const replyPayload = typeof payload === 'string'
			? { embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(payload)] }
			: payload;
		await message.reply(replyPayload);
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
			const sent = await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Pong').setDescription('Measuring latency...')] });
			const timeSent = Date.now();
			const delay = timeSent - timeCalled;
			await sent.edit({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Pong').setDescription(`Latency: ${delay} ms`)] });
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

			playerTag = formatUserTag(data.profile.name, data.profile.id);
			const embed = new EmbedBuilder()
				.setColor(0x5865f2)
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
				.setColor(0x5865f2)
				.setTitle('Torn Helper Bot - Commands')
				.setDescription('Here are the available commands:')
				.addFields(
					{ name: '!ping', value: 'Checks the bot latency and replies with a pong embed.', inline: false },
					{ name: '!info', value: 'Shows bot information using your Torn API profile.', inline: false },
					{ name: '!log [number]', value: 'Shows the latest log entries from Torn City.', inline: false },
					{ name: '!whatis [type] [id]', value: 'Looks up Torn items, factions, companies, properties, merits, honors, stocks, players, or forum threads.', inline: false },
					{ name: '!help', value: 'Shows this help message.', inline: false },
					{ name: '!bars', value: 'Shows your current bar values. Such as energy, nerve, happiness, and life.', inline: false },
					{ name: '!set', value: 'Sets the current channel as the destination for alert messages.', inline: false },
					{ name: '!alert [type] [interval(optional)]', value: 'Toggles an alert on/off. Types: hospital, travel, drug, booster, med. Interval is in seconds (default 30).', inline: false }
				);
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
				const companyOwner = formatUserTag(data.profile.director?.name, data.profile.director?.id);
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
				const propertyOwner = formatUserTag(data.property.owner?.name, data.property.owner?.id);
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

			if (type === 'thread') {
				const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/forum/${ID}/posts?limit=5&stripTags=true`);
				if (error || !Array.isArray(data?.posts)) {
					logMessageEvent(message, `!whatis thread failed for ID ${ID}: ${error?.message || 'missing posts data'}`, 'warn');
					await safeReply(message, `Thread ID ${ID} could not be fetched right now.`);
					return;
				}

				const posts = data.posts.slice(0, 5);
				if (posts.length === 0) {
					logMessageEvent(message, `!whatis thread returned no posts for ID ${ID}`, 'warn');
					await safeReply(message, `Thread ID ${ID} does not contain any posts.`);
					return;
				}

				const previewLines = posts.map((post, index) => {
					const author = formatUserTag(post?.author?.username, post?.author?.id);
					const content = (post?.content || '').replace(/\s+/g, ' ').trim();
					const shortContent = content.length > 140 ? `${content.slice(0, 137)}...` : content;
					return `${index + 1}. ${author}: ${shortContent || '[empty message]'}`;
				});

				const embed = new EmbedBuilder()
					.setColor(0x5865f2)
					.setTitle(`Thread ${ID} Latest Posts`)
					.setDescription(previewLines.join('\n'));
				await safeReply(message, { embeds: [embed] });
				logMessageEvent(message, `!whatis thread succeeded for ID ${ID} with ${posts.length} posts`, 'log');
				return;
			}

			logMessageEvent(message, `Unsupported !whatis type: ${type}`, 'warn');
			await safeReply(message, 'Unsupported type. Supported types are: item, faction, company, property, merit, honor, stock, player, and thread.');
		}
		if (message.content === '!bars') {
			const { data, error } = await safeFetchJson(message, `https://api.torn.com/v2/user/bars`);
			if (error || !data?.bars) {
				logMessageEvent(message, `!bars failed: ${error?.message || 'missing bar data'}`, 'warn');
				await safeReply(message, 'Could not fetch bar information right now.');
				return;
			}

			var maxenergy = data.bars.energy.maximum;
			var currentenergy = data.bars.energy.current;

			var maxnerve = data.bars.nerve.maximum;
			var currentnerve = data.bars.nerve.current;

			var maxhappiness = data.bars.happy.maximum;
			var currenthappiness = data.bars.happy.current;

			var maxlife = data.bars.life.maximum;
			var currentlife = data.bars.life.current;

			// Fixed-size bars — buildBar() always does at most 10 iterations,
			// so a zero/weird `max` from the API can never hang the bot.
			var EnergyBuffer = buildBar(currentenergy, maxenergy, "🟩");
			var NerveBuffer = buildBar(currentnerve, maxnerve, "🟥");
			var HappinessBuffer = buildBar(currenthappiness, maxhappiness, "🟨");
			var LifeBuffer = buildBar(currentlife, maxlife, "🟦");

			var finalBuffer = `**Energy: ** ${EnergyBuffer} ${currentenergy} / ${maxenergy}\n**Nerve:    ** ${NerveBuffer} ${currentnerve} / ${maxnerve}\n**Happy:   ** ${HappinessBuffer} ${currenthappiness} / ${maxhappiness}\n**Life:           ** ${LifeBuffer} ${currentlife} / ${maxlife}`;
			await safeReply(message, finalBuffer);
		}
		if (message.content === "!set") {
			alertChannel = message.channel;
			await safeReply(message, 'Alert channel is successifuly set to #' + message.channel.name);
		}
		if (message.content.startsWith("!alert")) {
			const { data: discordData, error: discordError } = await safeFetchJson(message, "https://api.torn.com/v2/user/discord");
			if (discordError || !discordData?.discord?.user_id) {
				await safeReply(message, "Unable to fetch your Discord ID right now.");
				return;
			}
			discordID = discordData.discord.user_id;
			if (!alertChannel) {
				await safeReply(message, "No alert channel set. Go to the channel you'd like to set as one and run !set to set one.");
				return;
			}
			const alertArguments = message.content.trim().split(/\s+/);
			let alertType = alertArguments[1];
			let alertCheckInterval = parseInt(alertArguments[2], 10);
			if (!alertType) {
				await safeReply(message, "Invalid alert syntax. Use: !alert <type> <interval(optional)>\naccepted types are hospital, travel, drug (drug cooldown expire), booster (booster cooldown expire), med (medical cooldown expire)");
				return;
			}
			if (Number.isNaN(alertCheckInterval)) {
				alertCheckInterval = 30;
			}
			if (alertType === "hospital") {
				if (!hospitalAlertEnabled) {
					// Fetch first — only mark the alert as enabled once we know setup actually succeeded.
					const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/basic");
					if (error || !data?.profile?.status) {
						await safeReply(message, "Unable to fetch your hospital status right now.");
						return;
					}

					hospitalAlertEnabled = true;
					savedStatusHospital = data.profile.status;
					logMessageEvent(message, '[alerts] enabling hospital alerts', 'log');
					await safeReply(message, "Hospital alerts have been enabled.");

					hospitalAlertInterval = setInterval(async () => {
						if (!hospitalAlertEnabled) {
							logMessageEvent(message, '[alerts] hospital interval skipped because alerts are disabled', 'log');
							return;
						}
						logMessageEvent(message, `[alerts] hospital check tick | interval=${alertCheckInterval}s`, 'log');
						const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/basic");
						if (error || !data?.profile?.status) {
							return;
						}
						if (savedStatusHospital.state !== data.profile.status.state && data.profile.status.state === "Hospital") {
							logMessageEvent(message, `[alerts] hospital alert triggered | old=${JSON.stringify(savedStatusHospital)} new=${JSON.stringify(data.profile.status)}`, 'log');
							var hospitalBuffer = `<@${discordID}>, You are ${data.profile.status.description}! ${data.profile.status.details}`;
							const hospitalEmbed = new EmbedBuilder()
								.setColor(0x8d2c2c)
								.setTitle('Hospital Alert')
								.setDescription(hospitalBuffer);
							await alertChannel.send({ embeds: [hospitalEmbed] });
							savedStatusHospital = data.profile.status;
						} else if (savedStatusHospital.state !== data.profile.status.state && data.profile.status.state === "Okay") {
							logMessageEvent(message, `[alerts] hospital release alert triggered | old=${JSON.stringify(savedStatusHospital)} new=${JSON.stringify(data.profile.status)}`, 'log');
							savedStatusHospital = data.profile.status;
							var okayBuffer = `You are now released from the hospital! <@${discordID}>`;
							const okayEmbed = new EmbedBuilder()
								.setColor(0x2c8d2c)
								.setTitle('Hospital Alert')
								.setDescription(okayBuffer);
							await alertChannel.send({ embeds: [okayEmbed] });
						} else {
							logMessageEvent(message, `hospital status is not changed`);
							savedStatusHospital = data.profile.status;
						}
					}, alertCheckInterval * 1000);
				} else {
					hospitalAlertEnabled = false;
					logMessageEvent(message, '[alerts] disabling hospital alerts', 'log');
					await safeReply(message, "Hospital alerts have been disabled.");
					if (hospitalAlertInterval) {
						clearInterval(hospitalAlertInterval);
						hospitalAlertInterval = null;
					}
				} 
			}
			if (alertType === "travel") {
				if (!travelAlertEnabled) {
					// Fetch first — only mark the alert as enabled once we know setup actually succeeded.
					const {data, error} = await safeFetchJson(message, "https://api.torn.com/v2/user/basic");
					if (error || !data?.profile?.status) {
						await safeReply(message, "Unable to fetch your travel status right now.");
						return;
					}

					travelAlertEnabled = true;
					savedStatusTravel = data.profile.status;
					logMessageEvent(message, '[alerts] enabling travel alerts', 'log');
					await safeReply(message, "Travel alerts have been enabled.");

					travelAlertInterval = setInterval(async () => {
						if (!travelAlertEnabled) {
							logMessageEvent(message, '[alerts] travel interval skipped because alerts are disabled', 'log');
							return;
						}
						logMessageEvent(message, `[alerts] travel check tick | interval=${alertCheckInterval}s`, 'log');
						const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/basic");
						if (error || !data?.profile?.status) {
							return;
						}
						if (savedStatusTravel.state !== data.profile.status.state && data.profile.status.state === "Travel") {
							// var travelBuffer = `<@${discordID}>, You are ${data.profile.status.description}! ${data.profile.status.details}`; // travel should not send a message
							savedStatusTravel = data.profile.status;
						} else if (savedStatusTravel.state !== data.profile.status.state && data.profile.status.state === "Okay") {
							var landingBuffer = `You are now landing! <@${discordID}>`;
							const landingEmbed = new EmbedBuilder()
								.setColor(0x50b8c0)
								.setTitle('Travel Landing Alert')
								.setDescription(landingBuffer);
							await alertChannel.send({ embeds: [landingEmbed] });
							savedStatusTravel = data.profile.status;
						} else {
							logMessageEvent(message, `travel status is not changed`);
							savedStatusTravel = data.profile.status;
						}
					}, alertCheckInterval * 1000);
				} else {
					travelAlertEnabled = false;
					logMessageEvent(message, '[alerts] disabling travel alerts', 'log');
					await safeReply(message, "Travel alerts have been disabled.");
					if (travelAlertInterval) {
						clearInterval(travelAlertInterval);
						travelAlertInterval = null;
					}
					savedStatusTravel = "";
				} 
			}
			if (alertType === "drug") {
				if (!drugAlertEnabled) {
					// Fetch first — only mark the alert as enabled once we know setup actually succeeded.
					const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/cooldowns");
					if (error || !data?.cooldowns?.drug) {
						await safeReply(message, "Unable to fetch your drug cooldown right now.");
						return;
					}

					drugAlertEnabled = true;
					savedStatusDrug = parseInt(data.cooldowns.drug, 10);
					logMessageEvent(message, '[alerts] enabling drug alerts', 'log');
					await safeReply(message, "Drug alerts have been enabled.");

					drugAlertInterval = setInterval(async () => {
						if (!drugAlertEnabled) {
							return;
						}
						const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/cooldowns");
						if (error || !data?.cooldowns?.drug) {
							return;
						}
						const currentDrugCooldown = parseInt(data.cooldowns.drug, 10);
						if (savedStatusDrug > 0 && currentDrugCooldown <= 0) {
							logMessageEvent(message, `[alerts] drug alert triggered | lastSeen=${savedStatusDrug} current=${currentDrugCooldown}`, 'log');
							var drugBuffer = `<@${discordID}>, You are no longer under the influence of a drug!`;
							const drugEmbed = new EmbedBuilder()
								.setColor(0x8d2c2c)
								.setTitle('Drug Alert')
								.setDescription(drugBuffer);
							await alertChannel.send({ embeds: [drugEmbed] });
						}
						savedStatusDrug = currentDrugCooldown;
					}, alertCheckInterval * 1000);
				} else {
					drugAlertEnabled = false;
					logMessageEvent(message, '[alerts] disabling drug alerts', 'log');
					await safeReply(message, "Drug alerts have been disabled.");
					if (drugAlertInterval) {
						clearInterval(drugAlertInterval);
						drugAlertInterval = null;
					}
					savedStatusDrug = 0;
				} 
			}
			if (alertType === "booster") {
				if (!boosterAlertEnabled) {
					// Fetch first — only mark the alert as enabled once we know setup actually succeeded.
					const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/cooldowns");
					if (error || data?.cooldowns?.booster === undefined) {
						await safeReply(message, "Unable to fetch your booster cooldown right now.");
						return;
					}

					boosterAlertEnabled = true;
					savedStatusBooster = parseInt(data.cooldowns.booster, 10);
					logMessageEvent(message, '[alerts] enabling booster alerts', 'log');
					await safeReply(message, "Booster alerts have been enabled.");

					boosterAlertInterval = setInterval(async () => {
						if (!boosterAlertEnabled) {
							return;
						}
						const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/cooldowns");
						if (error || data?.cooldowns?.booster === undefined) {
							return;
						}
						const currentBoosterCooldown = parseInt(data.cooldowns.booster, 10);
						if (savedStatusBooster > 0 && currentBoosterCooldown <= 0) {
							logMessageEvent(message, `[alerts] booster alert triggered | lastSeen=${savedStatusBooster} current=${currentBoosterCooldown}`, 'log');
							var boosterBuffer = `<@${discordID}>, Your booster cooldown has expired!`;
							const boosterEmbed = new EmbedBuilder()
								.setColor(0x8d2c2c)
								.setTitle('Booster Alert')
								.setDescription(boosterBuffer);
							await alertChannel.send({ embeds: [boosterEmbed] });
						}
						savedStatusBooster = currentBoosterCooldown;
					}, alertCheckInterval * 1000);
				} else {
					boosterAlertEnabled = false;
					logMessageEvent(message, '[alerts] disabling booster alerts', 'log');
					await safeReply(message, "Booster alerts have been disabled.");
					if (boosterAlertInterval) {
						clearInterval(boosterAlertInterval);
						boosterAlertInterval = null;
					}
					savedStatusBooster = 0;
				}
			}
			if (alertType === "med") {
				if (!medAlertEnabled) {
					// Fetch first — only mark the alert as enabled once we know setup actually succeeded.
					const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/cooldowns");
					if (error || data?.cooldowns?.medical === undefined) {
						await safeReply(message, "Unable to fetch your medical cooldown right now.");
						return;
					}

					medAlertEnabled = true;
					savedStatusMed = parseInt(data.cooldowns.medical, 10);
					logMessageEvent(message, '[alerts] enabling med alerts', 'log');
					await safeReply(message, "Medical cooldown alerts have been enabled.");

					medAlertInterval = setInterval(async () => {
						if (!medAlertEnabled) {
							return;
						}
						const { data, error } = await safeFetchJson(message, "https://api.torn.com/v2/user/cooldowns");
						if (error || data?.cooldowns?.medical === undefined) {
							return;
						}
						const currentMedCooldown = parseInt(data.cooldowns.medical, 10);
						if (savedStatusMed > 0 && currentMedCooldown <= 0) {
							logMessageEvent(message, `[alerts] med alert triggered | lastSeen=${savedStatusMed} current=${currentMedCooldown}`, 'log');
							var medBuffer = `<@${discordID}>, Your medical cooldown has expired!`;
							const medEmbed = new EmbedBuilder()
								.setColor(0x8d2c2c)
								.setTitle('Medical Alert')
								.setDescription(medBuffer);
							await alertChannel.send({ embeds: [medEmbed] });
						}
						savedStatusMed = currentMedCooldown;
					}, alertCheckInterval * 1000);
				} else {
					medAlertEnabled = false;
					logMessageEvent(message, '[alerts] disabling med alerts', 'log');
					await safeReply(message, "Medical cooldown alerts have been disabled.");
					if (medAlertInterval) {
						clearInterval(medAlertInterval);
						medAlertInterval = null;
					}
					savedStatusMed = 0;
				}
			}
		}
	} catch (error) {
		await handleCommandError(message, 'Message handler', error);
	}
});

client.login(process.env.DISCORD_TOKEN);