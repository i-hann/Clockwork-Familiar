# Clockwork-Familiar
A simple Discord bot running out of an EC2 instance that contributes to a Dungeons and Dragons session in various ways.

#Dependencies
```
  @discordjs/voice: 0.9.0
  @discord.js: 13.6.0
  fs: 0.0.1
  path: 0.12.7
```


## Config
clockwork_familiar_config.json:
```
  {
    "token": "<Your bot token>",
    "prefix": "!",
    "bot_channel_id": "<Your text channel id>",
    "voice_channel_id": "<Your voice channel id>"
  }
  ```
  
  
## Add bot to Discord server
  1. Select the bot in the Discord Developer Portal and go to OAuth2 -> URL Generator. Check the boxes for "bot" and "applications.commands". Copy the URL and paste it into the browser. Select the Discord server for the bot to join.
  2. In clockwork_familiar.config.json, update "bot_channel_id" to the ID of the text channel where you want the bot to read commands and send messages. Update "voice_channel_id" to the ID of the voice channel where you want the bot to play music.
  
  
## AWS EC2 Setup
  1. Launch an Ubuntu EC2 instance (free tier) with the User Data:
  ```
        sudo apt update
        sudo apt install nodejs
        sudo apt install npm
        npm install @discord.js
        npm install @discordjs/voice
        npm install fs
        npm install path
        npm install pm2
  ```
  2. Set up an SSH connection to your EC2 instance (look up tutorials if needed).
  3. Copy the following files to your npm directory (I use WinSCP for this, look up tutorials if needed:
  ```
        clockwork_familiar.js
        clockwork_familiar_config.json
  ```
  4. Create a directory in /npm called "audio tracks" and fill it with mp3 files of songs you want to use for your game (again, I use WinSCP). Optionally, make songs searchable via Tag by adding tags separated by commas in parentheses at the end of the song name.
     Example mp3 files:
  ```
        Barovian Village (Town, Night).mp3
        Dark and Stormy (Ambient, Rain).mp3
        Winter Woods (Forest, Snow).mp3
  ```

  
## Running the Bot in EC2
  1. In the npm directory, use the CLI to run the command:
  ```
        pm2 start clockwork_familiar.js --max-memory-restart 100M
  ```
  2. (Optional) Add a max memory threshold:
  ```
        --max-memory-restart 100M
  ```
  3. (Optional) Add a scheduled daily restart:
  ```
        --cron-restart="0 8 * * 0-7"
  ```
  
  
## Using the Bot in Discord
The bot currently supports the following text commands:
```
    !help - Shows all available commands
    !tracks <tag> - Show list of audio tracks matching <tag>
    !play <id> - Play audio track matching <id>
    !stop - Stop playing audio and leave the voice channel (this also happens by default if the voice channel is empty)
```
