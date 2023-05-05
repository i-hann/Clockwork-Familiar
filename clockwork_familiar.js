//Dependencies
const { Client, Intents } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const { prefix, token, commands_channel_id, npcs_channel_id, descriptions_channel_id, voice_channel_id, npc_tables, aws_region } = require('./clockwork_familiar_config.json');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

//AWS
process.env['AWS_REGION'] = aws_region;
const AWS = require('aws-sdk');

//Document Client for DynamoDB
const docClient = new AWS.DynamoDB.DocumentClient();

//Audio player
const audioPlayer = createAudioPlayer();

//Store currently playing song
var current_song = {
    track_index: 'null'
}
//Track if audio can be looped
var audioCanLoop = true;

//Listener to loop audio when it finishes, if it hasn't been stopped
audioPlayer.on(AudioPlayerStatus.Idle, () => {
    if ((current_song.track_index !== 'null') && (audioCanLoop)) {
        try {
            play(current_song.track_index);
        } catch (err) {
            console.log("Error: " + err.message);
        }
    }
})

//Audio track table parameters
const table = {
    id_length: 3,
    name_length: 31,
    tags_length: 27,
    header: "```" + '\n' +
        "AUDIO TRACKS" + '\n' +
        "Use \"!play <id>\" to play a track." + '\n' + '\n' +
        "ID | Title                         | Tags                      |" + '\n' +
        "---|-------------------------------|---------------------------|" + '\n',
    footer: "```"

}

//Scan local audio tracks into an array called "playlist"
const audioFolder = './audio tracks';
var playlist = new Array;
playlist[0] = 'null';
fs.readdir(audioFolder, function (err, files) {
    if (err) {
        return console.log('Unable to scan audio folder: ' + err);
    }

    let index = 1;
    files.forEach(function (file) {

        //Get file extension
        var fileExtension = path.extname(file);
        //Make sure it's an mp3
        if (fileExtension == '.mp3') {

            //Get file name, song name, and file path
            var fileName = file.replace('.mp3', '');
            var songName = fileName.replace(/\s*\(.*?\)\s*/g, '')
            var filePath = audioFolder + '/' + file;
            var songIndex = index.toString();

            //Get tags
            var split = fileName.split('(');
            var songTags = split[1].replace(')', '');

            //Populate playlist
            if (playlist[0] == 'null') {
                playlist[0] = {
                    id: songIndex,
                    name: songName,
                    path: filePath,
                    tags: songTags
                };
                index += 1;
            }
            else {
                playlist.push({
                    id: songIndex,
                    name: songName,
                    path: filePath,
                    tags: songTags
                });
                index += 1;
            }
        }
    })
}) 

//Array for holding npcs
var npcs = [];




//Log into Discord
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
client.login(token);
client.once('ready', function () {
    console.log('Ready!');

    //Login message
    client.channels.cache.get(commands_channel_id).send("I am alive.");


    //Check every 10 seconds to see if anyone is still in the voice channel
    setInterval(() => {
        try {
            const voiceChannel = client.channels.cache.get(voice_channel_id);
            const connection = getVoiceConnection(voiceChannel.guild.id);

            if ((connection) && (voiceChannel.members.size <= 1)) {
                client.channels.cache.get(commands_channel_id).send("No listeners remain. Leaving the voice channel.");
                audioCanLoop = false;
                audioPlayer.stop();
                const connection = getVoiceConnection(voiceChannel.guild.id);
                connection.destroy();
            }
        } catch (err) {
            console.log(moment().format() + ": Error in setInterval: " + err.message);
        }
    }, 10000);

})

client.once('reconnecting', function () {
    console.log('Reconnecting!');
})

client.once('disconnect', function () {
    console.log('Disconnect!');
})


client.on('messageCreate', async (message) => {

    //Ignore self
    if (message.author.bot) {
        return;
    }

    //Ignore commands outside of clockwork-familiar channel
    if (message.channel.id !== commands_channel_id) {
        return;
    }

    //Ignore non-commands
    if (!message.content.startsWith(prefix)) {
        return;
    }

    //!help
    if (message.content.startsWith("!help")) {
        return client.channels.cache.get(commands_channel_id).send("```" + '\n' +
            "COMMANDS" + '\n' +
            '\n' +
            "Name            |Description                              |" + '\n' +
            "----------------   |-----------------------------------------|" + '\n' +
            "!tracks            |Show full list of audio tracks           |" + '\n' +
            "!tracks <tag>      |Show list of audio tracks matching <tag> |" + '\n' +
            "!play <id>         |Play audio track matching <id>           |" + '\n' +
            "!stop              |Stop playing audio                       |" + '\n' +
            "!show npctables    |Show NPC Tables that can be loaded       |" + '\n' +
            "!load npctable <i> |Load NPC Table matching <i>              |" + '\n' +
            "!npc <i>           |Describe NPC with name matching <i>      |" + '\n' +
            "```");
    }

    //!play <id>
    if (message.content.startsWith("!play")) {
        try {
            //Check that user is in a voice channel
            if (!message.member.voice.channel) {
                return client.channels.cache.get(commands_channel_id).send("You must be in a voice channel in order for me to play music!");
            }

            //Get the track ID
            const args = message.content.split(" ");
            const track_input = args[1];
            const track_index = track_input - 1;

            //Check that the track exists
            if (!playlist[track_index]) {
                return client.channels.cache.get(commands_channel_id).send("There is no audio track with ID " + track_input);
            }

            //Save the selected track
            current_song.track_index = track_index;

            //Play the song
            play(current_song.track_index);
        } catch (err) {
            console.log(moment().format() + ": Error executing !play: " + err.message);
        }
    }

    // !tracks, !tracks <tag>
    if (message.content.startsWith("!tracks")) {
        try {
            // Get option
            const args = message.content.split(" ");
            const option = args[1];

            //Boolean saying this is the first table
            var x = true;
            //Index saying start at the beginning of the playlist
            var y = 0;

            // !tracks
            if ((option == "") || (option == " ") || (typeof option == 'undefined')) {
                build_track_table(playlist, x, y);
            }

            // !tracks <tag>
            else {
                //Find songs that have the tag
                var matching_songs = new Array;
                for (let i = 0; i < playlist.length; i++) {
                    var tags = String(playlist[i].tags);
                    if ((tags.includes(option)) || ((tags.toLowerCase()).includes(option)) || ((tags.toUpperCase()).includes(option))) {
                        matching_songs.push(playlist[i]);
                    }
                }

                //If nothing has the tag, return
                if (matching_songs.length < 1) {
                    return client.channels.cache.get(commands_channel_id).send("No tracks have that tag.");
                }

                //Build a tracks table from those songs and display it
                build_track_table(matching_songs, x, y);
            }
        } catch (err) {
            console.log(moment().format() + ": Error executing !tracks: " + err.message);
        }

    }

    //!stop
    if (message.content.startsWith("!stop")) {
        try {
            //Disable looping
            audioCanLoop = false;
            //Stop the song
            audioPlayer.stop();

        } catch (err) {
            console.log(moment().format() + ": Error executing !stop: " + err.message);
        }
    }

    //!show npctables
    if (message.content.startsWith("!show npctables")) {
            show_npc_tables();
    }

    //!load npctable <arg>
    if (message.content.startsWith("!load npctable")) {
        const argIndex = message.content.indexOf("npctable") + 8;
        const arg = message.content.substring(argIndex).trim();
        load_npc_table(arg);
    }

    //!npc <arg>
    if (message.content.startsWith("!npc")) {
        const argIndex = message.content.indexOf("!npc") + 4;
        const arg = message.content.substring(argIndex).trim();
        describe_npc(arg);
    }
})

//Recursive function for playing background music
async function play(track_index) {
    try {

        //Create the audio resource
        var resource = createAudioResource(playlist[track_index].path);

        //Join the voice channel
        const channel = client.channels.cache.get(voice_channel_id);
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        });

        //Play the song
        connection.subscribe(audioPlayer);
        audioPlayer.play(resource);

        //Enable looping
        audioCanLoop = true;


    } catch (err) {
        console.log(moment().format() + ": Error in function play(): " + err.message);
    }
}

//Recursive function which takes an array of song objects and creates a track table. If there are too many songs, it creates multiple tables.
async function build_track_table(songs, x, y) {
    try {
        var isFirstTable = x;
        var index = y;
        var atMaxSize = false;

        if (isFirstTable) {
            var track_table = table.header;
        }
        else {
            var track_table = "```" + "(cont.)" + '\n' + '\n';
        }

        //Construct a row for each song
        for (let i = index; i < songs.length; i++) {
            if (!atMaxSize) {
                //Fill out the ID section (length: 3)
                var id_string = songs[i].id;
                while (id_string.length < table.id_length) {
                    id_string += " ";
                }

                //Fill out the Name section (length: 25)
                var name_string = songs[i].name;
                while (name_string.length < table.name_length) {
                    name_string += " ";
                }

                //Fill out the Tags section (length: 32)
                var tags_string = songs[i].tags;
                while (tags_string.length < table.tags_length) {
                    tags_string += " ";
                }

                //Construct the row
                var new_row = id_string + "|" + name_string + "|" + tags_string + "|" + '\n';
                //Add to the table
                track_table = track_table + new_row;

                //index increments up
                index++;

                //Check if we need another message
                if (track_table.length > 1800) {
                    atMaxSize = true;
                }
            }
        }

        //If we need another message then we send this one and then build another
        if ((atMaxSize) && (index < songs.length)) {
            track_table = track_table + table.footer;
            client.channels.cache.get(commands_channel_id).send(track_table);

            isFirstTable = false;
            build_track_table(songs, isFirstTable, index);
        }
        //Else if we don't need another message, send this one and stop
        else {
            track_table = track_table + table.footer;
            client.channels.cache.get(commands_channel_id).send(track_table);
        }
    } catch (err) {
        console.log(moment().format() + ": Error in build_track_table: " + err.message);
    }
}

//Function for showing the available NPC tables
async function show_npc_tables() {
    try {
        client.channels.cache.get(commands_channel_id).send("NPC Tables:");
        for (var i = 0; i < npc_tables.length; i++) {
            client.channels.cache.get(commands_channel_id).send((i + 1) + ". " + npc_tables[i]);
        }
    }
    catch (err) {
        client.channels.cache.get(commands_channel_id).send("Error in show_npc_tables(): " + err.message);
    }
}

//Function for loading an NPC table
async function load_npc_table(arg) {
    try {
        var possibleMatches = [];
        var regex = new RegExp(arg, 'i');
        var i = 0

        //Find all possible matches for the input value
        while (i < npc_tables.length) {
            if (regex.test(npc_tables[i])) {
                possibleMatches.push(npc_tables[i]);
            }
            i++;
        }

        //Input is not specific enough
        if (possibleMatches.length > 1) {
            client.channels.cache.get(commands_channel_id).send("I found " + possibleMatches.length + " NPC tables that match '" + arg + "'.");
        }

        //Input has no matches
        else if (possibleMatches.length === 0) {
            client.channels.cache.get(commands_channel_id).send("I did not find any NPC tables matching '" + arg + "'.");
        }

        //Input has exactly 1 match
        else if (possibleMatches.length === 1) {
            client.channels.cache.get(commands_channel_id).send("Loading NPC Table: " + possibleMatches[0]);
            var tableNameString = possibleMatches[0];
            var npcTableParams = {
                TableName: tableNameString
            };
            docClient.scan(npcTableParams, function (err, data) {
                if (err) {
                    client.channels.cache.get(commands_channel_id).send("Error scanning NPC Table: " + err.message);
                } else {
                    npcs = data.Items;
                    client.channels.cache.get(commands_channel_id).send('Loaded ' + npcs.length + ' NPCs from ' + tableNameString);
                }
            })
        }
    } catch (err) {
        console.log(moment().format() + ": Error in load_npc_table(): " + err.message);
    }
}

//Function for describing an NPC from the table
async function describe_npc(arg) {
    try {
        var possibleMatches = [];
        var regex = new RegExp(arg, 'i');
        var i = 0
        while (i < npcs.length) {
            if (regex.test(npcs[i].Name)) {
                possibleMatches.push(npcs[i]);
            }
            i++;
        }
        //Query is not specific enough
        if (possibleMatches.length > 1) {
            client.channels.cache.get(commands_channel_id).send("I found " + possibleMatches.length + " NPCs that match that name. Please be more specific.");
        }
        //Query has no matches
        else if (possibleMatches.length === 0) {
            client.channels.cache.get(commands_channel_id).send("I did not find any NPCs matching that name.");
        }
        //Query has exactly 1 match
        else if (possibleMatches.length === 1) {
            var selectedNPC = possibleMatches[0];
            client.channels.cache.get(commands_channel_id).send("I found the NPC: " + selectedNPC.Name);
            //Post picture
            client.channels.cache.get(npcs_channel_id).send(
              '\n' +
              selectedNPC.Picture + '\n'
            );
            //Post name and description
            client.channels.cache.get(npcs_channel_id).send(
              '\n' + 
              "**" + selectedNPC.Name + "**" + '\n' +
              selectedNPC.Description + '\n' +
              "----------------------------------------------------------"
            );
        }

    } catch (err) {
        console.log(moment().format() + ": Error in describe_npc(): " + err.message);
    }
}