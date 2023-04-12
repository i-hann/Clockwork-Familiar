

//Dependencies
const { Client, Intents } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

//Config File
const { prefix, token, text_channel_id, voice_channel_id } = require('./clockwork_familiar_config.json');

//Audio player
const audioPlayer = createAudioPlayer();

//Store currently playing song
var current_song = {
    track_index: 'null'
}
//Track if audio is can be looped
var audioCanLoop = true;


//Listener to loop audio when it finishes, if it hasn't been stopped
audioPlayer.on(AudioPlayerStatus.Idle, () => {
    if ((current_song.track_index !== 'null') && (audioCanLoop)) {
        play(current_song.track_index);
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


//Log into Discord
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
client.login(token);
client.once('ready', function () {
    console.log('Ready!');

    //Login message
    client.channels.cache.get(text_channel_id).send("I am alive.");

    //Check every 10 seconds to see if anyone is still in the voice channel
    setInterval(() => {
        const voiceChannel = client.channels.cache.get(voice_channel_id);
        const connection = getVoiceConnection(voiceChannel.guild.id);

        if ((connection) && (voiceChannel.members.size <= 1)) {
            client.channels.cache.get(text_channel_id).send("No listeners remain. Leaving the voice channel.");
            audioCanLoop = false;
            audioPlayer.stop();
            const connection = getVoiceConnection(voiceChannel.guild.id);
            connection.destroy();
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
    if (message.channel.id !== text_channel_id) {
        return;
    }

    //Ignore non-commands
    if (!message.content.startsWith(prefix)) {
        return;
    }

    //!help
    if (message.content.startsWith("!help")) {
        return client.channels.cache.get(text_channel_id).send("```" + '\n' +
            "COMMANDS" + '\n' +
            '\n' +
            "Name            |Description                              |" + '\n' +
            "----------------|-----------------------------------------|" + '\n' +
            "!tracks         |Show full list of audio tracks           |" + '\n' +
            "!tracks <tag>   |Show list of audio tracks matching <tag> |" + '\n' +
            "!play <id>      |Play audio track matching <id>           |" + '\n' +
            "!stop           |Stop playing audio                       |" + '\n' +
            "```");
    }


    //!play <id>
    if (message.content.startsWith("!play")) {

        //Check that user is in a voice channel
        if (!message.member.voice.channel) {
            return client.channels.cache.get(text_channel_id).send("You must be in a voice channel in order for me to play music!");
        }

        //Get the track ID
        const args = message.content.split(" ");
        const track_input = args[1];
        const track_index = track_input - 1;

        //Check that the track exists
        if (!playlist[track_index]) {
            return client.channels.cache.get(text_channel_id).send("There is no audio track with ID " + track_input);
        }

        //Save the selected track
        current_song.track_index = track_index;

        //Play the song
        play(current_song.track_index);
    }

    // !tracks, !tracks <tag>
    if (message.content.startsWith("!tracks")) {

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
                return client.channels.cache.get(text_channel_id).send("No tracks have that tag.");
            }

            //Build a tracks table from those songs and display it
            build_track_table(matching_songs, x, y);
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
            console.log(err);
        }
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
        console.log(err);
    }
}

//Recursive function which takes an array of song objects and creates a track table. If there are too many songs, it creates multiple tables.
async function build_track_table(songs, x, y) {

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
        client.channels.cache.get(text_channel_id).send(track_table);

        isFirstTable = false;
        build_track_table(songs, isFirstTable, index);
    }
    //Else if we don't need another message, send this one and stop
    else {
        track_table = track_table + table.footer;
        client.channels.cache.get(text_channel_id).send(track_table);
    }
}
