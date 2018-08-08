/**
 * Helpers for configuring a bot as an app
 * https://api.slack.com/slack-apps
 */

var Botkit = require('botkit');
const Slack = require('slack');
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'slack.tomatobot@gmail.com',
        pass: 'ketchup52'
    }
});

var mailOptions = {
    from: 'slack.tomatobot@gmail.com',
    to: '7702863237@txt.att.net',
    subject: 'Break Timer is Done',
    text: 'Time to Start working again! You break is over!'
};


const Token = "xoxp-410445887827-411616602423-411998604404-5b63cf8c799692bea7a9ee26ac21ca68";
var _bots = {};

function _trackBot(bot) {
    _bots[bot.config.token] = bot;
}

function die(err) {
    console.log(err);
    process.exit(1);
}

module.exports = {
    configure: function (port, clientId, clientSecret, config, onInstallation) {
        var controller = Botkit.slackbot(config).configureSlackApp(
            {
                clientId: clientId,
                clientSecret: clientSecret,
                scopes: [
                    'bot',
                    'dnd:write',
                    'chat:write:bot',
                    'commands',
                    'channels:read',
                    'dnd:read'
                ], //TODO it would be good to move this out a level, so it can be configured at the root level
            }
        );

        controller.setupWebserver(process.env.PORT,function(err,webserver) {
            controller.createWebhookEndpoints(controller.webserver);

            controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
                if (err) {
                    res.status(500).send('ERROR: ' + err);
                } else {
                    res.send('Success!');
                }
            });
        });

        controller.on('create_bot', function (bot, config) {

            if (_bots[bot.config.token]) {
                // already online! do nothing.
            } else {

                bot.startRTM(function (err) {
                    if (err) {
                        die(err);
                    }

                    _trackBot(bot);

                    if (onInstallation) onInstallation(bot, config.createdBy);
                });
            }
        });



        controller.on('slash_command', function (slashCommand, message) {
            switch (message.command) {
                case "/echo": //handle the `/echo` slash command. We might have others assigned to this app too!
                    // The rules are simple: If there is no text following the command, treat it as though they had requested "help"
                    // Otherwise just echo back to them what they sent us.
                    // but first, let's make sure the token matches!
                    if (message.token !== process.env.VERIFICATION_TOKEN) {
                        slashCommand.replyPublic(message, "You are using an unauthorized token!!");
                        return; //just ignore it.
                    }
        
                    // if no text was supplied, treat it as a help command
                    if (message.text === "" || message.text === "help") {
                        slashCommand.replyPrivate(message,
                            "I echo back what you tell me. " +
                            "Try typing `/echo hello` to see.");
                        return;
                    }
        
                    // If we made it here, just echo what the user typed back at them
                    //TODO You do it!
                    slashCommand.replyPublic(message, "1", function() {
                        slashCommand.replyPublicDelayed(message, "2").then(slashCommand.replyPublicDelayed(message, "3"));
                    });
        
                break;
                case "/timer":
                    if (message.token !== process.env.VERIFICATION_TOKEN) {
                        slashCommand.replyPublic(message, "You are using an unauthorized token!!");
                        return; //just ignore it.
                    }
        
                    // if no text was supplied, treat it as a help command
                    if (message.text === "" || message.text === "help") {
                        slashCommand.replyPrivate(message,
                            "I can set a timer for you. " + 
                            "Use format number + interval. " +
                            "Try typing `/timer 15 seconds.");
                        return;
                    }
                    var parseWords = message.text.split(' ');
                    slashCommand.replyPublic(message, "I will set a timer for " + parseWords[0] + " " + parseWords[1] + "!");
                    var seconds = TimeToSeconds(parseWords[0], parseWords[1]);
                    if(parseWords[2]) {determineDND(parseWords[2], seconds, slashCommand, message);}
                    SetTimer(slashCommand, message, seconds);
                break;
                case "/break":
                    var parseWords = message.text.split(' ');
                    slashCommand.replyPublic(message, "I will set a break timer for " + parseWords[0] + " " + parseWords[1] + "!");
                    var seconds = TimeToSeconds(parseWords[0], parseWords[1]);
                    if(parseWords[2]) {breakText(parseWords[2], seconds);}
                    breakTime(slashCommand, message, seconds);
                default:
                    slashCommand.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");
            }
        
        });

        function SetTimer(slashCommand, message, secondsTotal){
            secondsTotal = secondsTotal + 3;
            const doneMessage ="Your timer is done! \n Now would be a good time to look at your To-do list. Would you like to see it?";
            setTimeout(() => slashCommand.replyPublicDelayed(message, doneMessage), secondsTotal*1000);
        }


        function TimeToSeconds(num, interval){  
            interval = interval.toLowerCase();
            if(interval == "minutes" || interval == "minute") num = num *60;
            else if(interval == "hours" || interval == "hour") num = num *60 *60;
            return num;
        }

        function determineDND(setting, seconds, slashCommand, message){
            if(setting == "DND" || setting == 'dnd'){
                var min = (seconds/60);
                controller.storage.users.get(message.user, function(err, user_data) {
                    const access_token = user_data['access_token'];
                    console.log(access_token);
                    if (access_token) {
                        slashCommand.api.dnd.setSnooze({'num_minutes': min, 'token': access_token}, (err, response) =>{
                            if (err) {
                                console.log('error', err);
                            }
                        });
                    }
                });
            }
        }

        function breakTime(slashCommand, message, secondsTotal){
            const doneMessage ="Your break is over! Time to get back to work!";
            setTimeout(() => slashCommand.replyPublicDelayed(message, doneMessage), secondsTotal*1000);
        }

        function breakText(confirmation, secondsTotal){
            if(confirmation == "text" || confirmation == "Text"){
                setTimeout(() => transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                }), secondsTotal*1000);
            }
        }



        controller.storage.teams.all(function (err, teams) {

            if (err) {
                throw new Error(err);
            }

            // connect all teams with bots up to slack!
            for (var t  in teams) {
                if (teams[t].bot) {
                    var bot = controller.spawn(teams[t]).startRTM(function (err) {
                        if (err) {
                            console.log('Error connecting bot to Slack:', err);
                        } else {
                            _trackBot(bot);
                        }
                    });
                }
            }

        });


        return controller;


    }
}
