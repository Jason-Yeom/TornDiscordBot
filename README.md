# TornViewer
A Simple TORN city API Discord Bot with a easy usage, Legal in torn city's automation rules. 
Used to call to torn api from discord, for monitoring

# How to use
### 1. Getting a discord bot
- Go to [Discord Developer Portal Application Management](https://discord.com/developers/applications)
- Click on New Application
- Create your own name and hit `Create`. You might be required to do some account verification and a capcha
- at the side panel, go to menu "Bot". There, you can upload your own profile picture for your bot and banner.
- Click `Token` and click `Reset Token`. after that, a random looking string will appear. Do NOT share this to anyone, and write it down somewhere or save it digitally. you will not be able to see this token again unless you reset the token again. which if you do you will be required to set the token again.
- scroll down, and turn on "Message Content Intent".
- Hit Save changes, and now go to "OAuth2"
- In OAuth2 URL Generator, click on checkbox "bot" and in "Bot Permissions" panel that appears after checking it, check "Send Messages" and "Manage Messages"
- Copy the "Generated URL" below, and go to that URL. You'll be prompted where to invite the discord bot. click on server you would like to invite the bot to, and invite it.
  
### 2. turning the bot on
- go to this github, well you would already be reading in this repository, but anyways heres the link; [TornViewer Link](https://github.com/Jason-Yeom/TornDiscordBot)
- Click on green button `<> Code ▼` and click on `Download ZIP`.
- A ZIP file will be downloaded. after the download finish, extract that file.
- after extracting, go to that directory and follow these steps:
- copy a file named `.env`, from `.env.example` (if you are on Linux, the file might be hidden so ls might not be able to list it, but ls -a works.)
- edit file .env, and set the values. TORN_API=<put your torn full access key here>, DISCORD_TOKEN=<put your discord bot's token we recorded earlier here.>

### 2-1. Windows Set Up
- open Powershell as an administrator. (click on windows key -> type `powershell` directly -> at the option, click on Run as an administrator)
- type or copy paste `powershell -c "irm https://community.chocolatey.org/install.ps1|iex"` and press enter (this installs chocolatey for npm and nodejs installation.)
- after the command is done, next type or copy paste `choco install nodejs --version="24.18.0"`and press enter (this installs nodejs from chocolatey)
- after that command is done, verify your installation by executing following command: `node -v` it should return "v24.18.0".
- after that command is done, finally verify your installation for npm by running this: `npm -v`. it should return "11.16.0".
- we are done preparing!
- open the directory where you extracted the .zip file in file manager.
- use the following shortcuts in the file manager, orders matter; Alt+D (if that doesnt work use Ctrl+L) -> type powershell -> press enter.
- a new powershell window will appear. input the following commands;
- `npm i` this stands for `npm install` and installs all the dependency.
- after that command is done, do `node index.js` this starts the bot, and there you go! discord bot is up and running.
- note that if that powershell window is closed or stopped, the discord bot will not work either.
- so either get a server running with that or just use it when windows is on

### 2-2. Linux Set Up
- note, if you are using linux, i will assume that you are an experienced user.
- Open your terminal.
- Install nodejs and npm. most of the time i just install using package manager, but you can run those commands.
- `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash`
- `\. "$HOME/.nvm/nvm.sh"`
- `nvm install 24`
- verify using `node -v` and `npm -v`
- cd to the directory where you extracted the zip file.
- run `npm i`
- run `node index.js`
- if the terminal window is closed, the bot will stop working
- so either do `sudo npm -g install pm2`
- and do `pm2 start index.js`
- OR
- use gnu `screen` to make a persistent session.

# Commands and syntax
- `!ping` displays if bot is alive
- `!info` displays bot's information
- `!log` displays user's log. syntax: `!log <number of logs>`. example: `!log 10`

<sub>whats torn city? A long term text based MMORPG game! [https://torn.com/](https://torn.com/4045988)</sub>
<sub>JasonYeom [4045988]</sub>
