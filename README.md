# Clockwork-Familiar
A Discord bot that helps you run Dungeons & Dragons (or other tabletop rpg) sessions. It runs out of an AWS EC2 Instance, queries NPC and Description tables out of DynamoDB, and plays locally stored mp3 music and/or ambience over the voice channel.

## Current Features
The bot currently supports the following text commands:
```
    !help - Shows all available commands
    !tracks <tag> - Show list of audio tracks matching <tag>
    !play <id> - Play audio track matching <id>
    !stop - Stop playing audio and leave the voice channel (this also happens by default if the voice channel is empty)
    !show npctables - Shows NPC Tables that can be loaded from DynamoDB
    !load npctable <i> - Loads an NPC Table with table name partially matching <i>
    !npc <i> - Describes an NPC with name partially matching <i> from the currently loaded table
```

## Dependencies
```
  @discordjs/voice: 0.9.0
  @discord.js: 13.6.0
  fs: 0.0.1
  path: 0.12.7
  aws-sdk: 2.1368.0
```

## Config File
clockwork_familiar_config.json:
```
  {
    "token": "<Your bot token>",
    "prefix": "!",
    "commands_channel_id": "<Your channel id for bot commands>",
    "npcs_channel_id": "<Your channel id for npc descriptions and pictures>",
    "descriptions_channel_id": "<Your channel id for location descriptions">,
    "voice_channel_id": "<Your channel id for voice>",
    "npc_tables": [
	    "<Name of DynamoDB NPC table>",
	    "<Name of DynamoDB NPC table>",
        ...
    ],
    "aws_region": "<AWS region where DynamoDB tables are located>"
  }
```

## Adding the bot to your Discord server
  1. Select the bot in the Discord Developer Portal and go to OAuth2 -> URL Generator. Check the boxes for "bot" and "applications.commands". Copy the URL and paste it into the browser. Select the Discord server for the bot to join.
  2. In clockwork_familiar.config.json, update the four channel_id values to the channels you want the bot to be using in your Discord server (right-click a channel and select "Copy Channel ID"). The "commands" channel is a text channel where you will deliver commands to the bot. The "npcs" channel is a text channel where the bot will enter NPC names, descriptions, and pictures. The "descriptions" channel is a text channel where the bot will enter location descriptions. The "voice" channel id is where the bot will place music.


## AWS - EC2 Instance Setup
  1. Launch an Ubuntu EC2 instance (free tier) with the following User Data:
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
  3. Copy the following files to your /home/ubuntu/ directory (I use WinSCP for this, look up a tutorial if needed):
  ```
        clockwork_familiar.js
        clockwork_familiar_config.json
  ```
  4. Create a directory in /home/ubuntu called "audio tracks" and fill it with mp3 files of songs you want to use for your game (again, I use WinSCP). Optionally, make songs searchable via Tag by adding tags separated by commas in parentheses at the end of the song name.
     Example mp3 files:
  ```
        Barovian Village (Town, Night).mp3
        Dark and Stormy (Ambient, Rain).mp3
        Winter Woods (Forest, Snow).mp3
  ```


## AWS - DynamoDB
  1. You can create as many NPC tables as you wish. Make sure they are all in the same AWS region, and the region is correctly noted in clockwork_familiar_config.json. 
  2. The items in the tables should have a Name (string partition key - name of the NPC), Description (string), and Picture (string - an imgur link).
  
  
## AWS - IAM
  1. Create a User that can access DynamoDB with ReadOnly privileges (look up a tutorial if needed).
  2. Assign the User to your EC2 Instance.
  

## Running the Bot in EC2
  1. In the /home/ubuntu directory, use the CLI to run the command:
  ```
        pm2 start clockwork_familiar.js
  ```
  2. (Optional) You can include a scheduled daily restart:
  ```
        pm2 start clockwork_familiar.js --cron-restart="0 8 * * 0-7"
  ```
  
  

