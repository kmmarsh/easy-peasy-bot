/**
 * A Bot for Slack!
 */


/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
                convo.say("Send me a direct message that say \'set up profile\' to help me get some information about you!");
            }
        });
    }
}

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
    to: '',
    subject: 'Default Message',
    text: 'Default Message'
};


var userProfiles = {};

var carrierMap = {
    alltel: '@message.attel.com', 
    att: '@txt.att.net', 
    nextel: '@messaging.nextel.com', 
    sprint: '@messaging.sprintpcs.com', 
    suncom: '@tms.suncom.com',
    tmobile: '@tmomail.net',
    verizon: '@vtext.com'
};

/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}

var todoList = ["Drink Water", "Fight a Bear", "Eat tacos", "Harass Kevin at www.slack.com"];


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here!")
});

var userName, userPhoneNumber, userCarrier;

controller.hears(
    ['set up profile', 'profile set up'],
    ['direct_message'],
    function(bot, message) {
        bot.startConversation(message, function(err, convo){
            convo.addQuestion("Hello! What is your name?", function(response, convo){
                controller.storage.users.get(message.user, function(err, user_data) {
                    if (!err) {
                        controller.storage.users.save(
                            {
                                ...user_data, 
                                name: response.text
                            });
                    }
                });
                convo.sayFirst("Hi " + response.text);
                convo.next();
            })
            convo.addQuestion("We can set up text notifications now. You will only get them upon request. Say \'no\' to skip this step. What is your phone number?", 
            function(response, convo){
                if(response.text != 'no' || response.text != "No" || response.text != "NO"){
                    controller.storage.users.get(message.user, function(err, user_data) {
                        if (!err) {
                            controller.storage.users.save(
                                {
                                    ...user_data, 
                                    phoneNumber: response.text
                                });
                        }
                    });
                } else {
                    setUpProfile(message.user, userName, userPhoneNumber, userCarrier);                
                }
                convo.next();
            })
            convo.addQuestion("If you want to set up text notifications, could you also tell me your cell phone carrrier? Say 'no' to skip this step. Supported carriers include Alltell, AT&T, Nextel, Sprint, SunCom, T-mobile, and Verizon.",
            function(response, convo){
                if(response.text != 'no' || response.text != "No" || response.text != "NO"){
                    userCarrier = carrierMap[response.text];
                    controller.storage.users.get(message.user, function(err, user_data) {
                        if (!err) {
                            controller.storage.users.save(
                                {
                                    ...user_data, 
                                    carrier: userCarrier,
                                });
                        }
                    });
                    setUpPhone(message.user, userName, userPhoneNumber, userCarrier);
                }
                convo.next();
            })
            convo.say("Your profile has been set up. You will recieve a text notification if your SMS setup was successful. If you do not recieve a message, try again by saying 'set up profile'."); 
            convo.say("You can say things like 'todo list' to view your list, or things like 'add' or 'remove' to edit that list. You can use slash commands like /timer and /break to time your work and breaks! Good luck!");
        })
});

function saveName(name){
    userName = name;
    console.log("userName; " + userName);
}

function saveNumber(number){
    userPhoneNumber = number;
    console.log("userPhoneNumber: " + userPhoneNumber);
}

function saveCarrier(carrier){
    userCarrier = carrierMap[carrier];
    console.log("userCarrier: " + userCarrier);
}

function setUpProfile(user, name, phone, carrier){
    console.log("In setUpProfile!");
    var profile = {
        name: name,
        phoneNumber: phone + carrier,
        carrierExt: carrier,

    }
    userProfiles[user] = profile;
    if(phone && carrier){
        setUpPhone(userProfiles[user]);
    }
    userName = undefined;
    userPhoneNumber = undefined;
    userCarrier = undefined;
}

function setUpPhone(profile){
    mailOptions.to = profile.phoneNumber;
    mailOptions.subject = "Confirmation Message";
    mailOptions.text = "Your text notifications were set up successfully!"
    console.log("setting up that phone");
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    })
}


//greeting
controller.hears(
    ['hello', 'hi', 'hey', 'greetings', 'good morning'],
    ['direct_mention', 'mention', 'direct_message'],
    function(bot, message) {
        bot.startConversation(message, function(err, convo){
            convo.say("Hello!");
            convo.say("Here is your To-do List: \n" + formatToDoList(todoList))
            convo.addQuestion("Would you like to start today over with a blank list?", function(response,convo){
                if(response.text == 'yes'|| response.text == 'Yes'){
                    todoList = [];
                    convo.sayFirst("Here is your empty Todo List: " + formatToDoList(todoList));
                    convo.next();
                }
                convo.next();
            })
            convo.addQuestion("Would you like to add anything to your Todo list?", function(response,convo){
                convo.next();
                if(response.text == 'yes'|| response.text == 'Yes'){
                    convo.addQuestion("Please enter the new items for your Todo List, separated by a comma.", function(response, convo){
                        convo.next();
                        var parseItems = response.text.split(',');
                        parseItems.forEach(element => {
                            todoList.push(element);
                        });
                        convo.say("Thanks! Your todo list is now \n" + formatToDoList(todoList));
                    });
                }
                convo.next();

            });
            convo.activate();
        }, {}, 'default'); 
    });

//view todo list
controller.hears(
    ['todo', 'to-do', 'list', 'yes', 'view', 'show'],
    ['direct_mention', 'mention', 'direct_message'],
    function(bot, message) {
        console.log(message.user);
        bot.reply(message, "Here is your To-do List: \n" + formatToDoList(todoList));
    }
);

//add single item
controller.hears(
    ['add', 'new', 'add todo', 'add to todo', 'new todo'],
    ['direct_mention', 'mention', 'direct_message'],
    function(bot, message) {
        bot.startConversation(message, function(err, convo){
            convo.addQuestion("Would you like to add an item to your Todo List?", function(response, convo){
                if(response.text == "yes" || response.text == "Yes"){
                    convo.next();
                    convo.addQuestion("What would you like to add to your todo list?", function(response,convo){
                        todoList.push(response.text);
                        convo.say("Thanks! Your todo list is now \n" + formatToDoList(todoList));
                        convo.next();
                    }, {}, 'default');
                }
                convo.next();
            });
            convo.activate();
        })
    });

//remove single item
    controller.hears(
        ['done', 'finish', 'complete', 'remove', 'off'],
        ['direct_mention', 'mention', 'direct_message'],
        function(bot, message) {
            bot.startConversation(message, function(err, convo){
                convo.addQuestion("Would you like to remove an item from the Todo List?", function(response,convo){
                    convo.next();
                    if(response.text == "yes" || response.text == "Yes"){
                        convo.say("Okay, Here is your To-do List: \n" + formatToDoList(todoList));
                        convo.addQuestion("Which item number would you like to remove?", function(response, convo){
                            var index = response.text;
                            console.log("Index: " + index);
                            if (index > -1) {
                                todoList.splice(index-1, 1);
                            }
                            convo.next();
                            convo.say("Thanks! Your todo list is now \n" + formatToDoList(todoList));
                        })
                    }
                    convo.next();
                }, {}, 'default');
    
            });
            
        });

    //clear entire list
    controller.hears(
        ['start over', 'clear', 'erase'],
        ['direct_mention', 'mention', 'direct_message'],
        function(bot, message) {
            bot.startConversation(message, function(err, convo){
                convo.addQuestion("Would you like to clear your entire Todo List?", function(response,convo){
                    convo.next();
                    if(response.text == "yes" || response.text == "Yes"){
                        todoList = {};
                        convo.say("Okay, Here is your To-do List: \n" + formatToDoList(todoList));
                    }
                    convo.next();
                }, {}, 'default');
    
            });
            
        });


//formats numbered todoList in text box
function formatToDoList(todoList){
    var formatted = "```";
    if(todoList.length > 0){
        todoList.forEach(element => {
            formatted = formatted + (todoList.indexOf(element)+1) + ". " + element + "\n";
        });
    } else{
        formatted = formatted + "Your Todo List is Empty!!";
    }
    formatted = formatted + "```";
    return formatted;
}

// router.post("/", function(req, res, next) {
//     let payload = req.body;
//     res.sendStatus(200);

//     if (payload.event.type === "app_mention") {
//         if (payload.event.text.includes("tell me a joke")) {
//             // Make call to chat.postMessage using bot's token
//         }
//     }
// });

/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */


//controller.on('direct_message,mention,direct_mention', function (bot, message) {
//    bot.api.reactions.add({
//        timestamp: message.ts,
//        channel: message.channel,
//        name: 'robot_face',
//    }, function (err) {
//        if (err) {
//            console.log(err)
//        }
//        bot.reply(message, 'I heard you loud and clear boss.');
//    });

/*
controller.storage.users.get(message.user, function(err, user_data) {
    if (!err) {
        controller.storage.users.save(
            {
                ...user_data, 
                todoList: submission.api_token
            });
    }
});

controller.storage.teams.get(message.team.id, function(err, team_data) {
    if (!err) {
        controller.storage.teams.save(
            {
                ...team_data, 
                v1_url: submission.url
            });
    }
});*/