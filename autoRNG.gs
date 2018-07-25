var VERSION = "3.1.0";
var TWITTER_HANDLE = "autoRNG";

function start() {
  // Store user variables  
  var props = PropertiesService.getScriptProperties();

  props.setProperties({
    MAX_TWEET_ID: 1 //stores ID of last tweet read by bot
  });
    
  // Delete exiting triggers, if any    
  var triggers = ScriptApp.getProjectTriggers();  
  for(var i=0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
    
  // Setup a time-based trigger for the Bot to fetch and process incoming Tweets 
  // every minute. If your Google Script is running out of quota, change the
  // time to 5 or 10 minutes though the bot won't offer real-time answers then.  
  ScriptApp.newTrigger("readTweets")
           .timeBased()
           .everyMinutes(1)
           .create();   
  // Setup a time-based trigger to post a random number every hour
  ScriptApp.newTrigger("postNumber")
           .timeBased()
           .everyHours(1)
           .create();  
           
  Logger.log("Script starting");
  // Email me when the script starts
  var emailAddress = Session.getActiveUser().getEmail();
  //GmailApp.sendEmail(emailAddress, 'Auto RNG script initialized', 'Auto RNG script has been initialized.');
  postNumber();
}

function getService() {
  props = PropertiesService.getScriptProperties();
  return OAuth1.createService('Twitter')
      // Set the endpoint URLs.
      .setAccessTokenUrl('https://api.twitter.com/oauth/access_token')
      .setRequestTokenUrl('https://api.twitter.com/oauth/request_token')
      .setAuthorizationUrl('https://api.twitter.com/oauth/authorize')

      // Set the consumer key and secret.
      .setConsumerKey(props.getProperty("TWITTER_CONSUMER_KEY"))
      .setConsumerSecret(props.getProperty("TWITTER_CONSUMER_SECRET"))

      // Set the name of the callback function in the script referenced
      // above that should be invoked to complete the OAuth flow.
      .setCallbackFunction('authCallback')

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties());
}

/**
 * Handles the OAuth callback.
 */
function authCallback(request) {
  var service = getService();
  var authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied');
  }
}

function postNumber(){
  Logger.log("postNumber:enter");  
  var service = getService();
  if (service.hasAccess()){
    Logger.log("postNumber has access");
    payload = 
    {
      status: getRandNumber(0, 100, false)
    };
    sendTweet(service, payload);
  } else {
    var authorizationUrl = service.authorize();
    Logger.log('Open the following URL and re-run the script: %s',
        authorizationUrl);
  }
}

function readTweets(){
  var props = PropertiesService.getScriptProperties();
  var service = getService();
  if (service.hasAccess()){
    Logger.log("readTweets has access"); 
    
    var url = 'https://api.twitter.com/1.1/statuses/mentions_timeline.json';
    query_string ="?since_id="+ props.getProperty("MAX_TWEET_ID");
    url = url + query_string;
    
    var response = service.fetch(url, {
      encoding: false,
      method: 'get'
    });
    
    var tweets = JSON.parse(response.getContentText());
    
    for (var i=tweets.length-1; i>=0; i--) {
      answer = parseInt(getAnswer(tweets[i].text));
      Logger.log(answer);
      props.setProperty("MAX_TWEET_ID", tweets[i].id_str);
      
      var payload = {
        in_reply_to_status_id: props.getProperty("MAX_TWEET_ID"),
        status: "@" + tweets[i].user.screen_name + " " + answer
      };
      sendTweet(service, payload);
    }
    Logger.log("Last read tweet:"+ props.getProperty("MAX_TWEET_ID"));
    
    
  } else {
    var authorizationUrl = service.authorize();
    Logger.log('Open the following URL and re-run the script: %s',
        authorizationUrl);
  }
}

function getAnswer(request){
  var namesWithNumbers = /@\w*[0-9]+\w*/g;
  request = request.replace(namesWithNumbers,"");
  Logger.log(request);
  var pattern = /([0-9]+)/g;  
  
  number = pattern.exec(request);
  max = (number != null) ? number[0] : 100;
  
  number = pattern.exec(request);  
  min = (number != null) ? number[0] : 0;
 
  if (min > max){
    var temp = min;
    min = max;
    max = temp;
  }
  
  var answer = getRandNumber(min, max, false);
  Logger.log("min:" + min + " max:" + max + ": " + answer);
  return answer;
}

function sendTweet(service, payload){
   var url = 'https://api.twitter.com/1.1/statuses/update.json';
   var payload = payload;
   payload.lat = getRandNumber(-90,90, true);
   payload.long = getRandNumber(-180,180, true);
   Logger.log(JSON.stringify(payload, null, 2));
   var response = service.fetch(url, {
      method: 'post',
      payload: payload
   });
}
 
// encodeURIComponent isn't enough for oAuth as it does encode certain
// characters like !, *, (), etc. Thank you +Martin Hawksey - you are awesome
function encodeString (q) {
   var str =  encodeURIComponent(q);
   str = str.replace(/!/g,'%21');
   str = str.replace(/\*/g,'%2A');
   str = str.replace(/\(/g,'%28');
   str = str.replace(/\)/g,'%29');
   str = str.replace(/'/g,'%27');
   return str;
}

function getRandNumber(min, max, wantReal){
  max = parseInt(max);
  min = parseInt(min);
  num = (Math.random() * (max - min + 1) + min);
  if (!wantReal){
    num = Math.floor(num);
  }
  return num; 
}
