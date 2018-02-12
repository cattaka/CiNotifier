/**
 * Cloud Function.
 */
const supported_build_state = {
  "building": {
    "value": 1,
    "blinks": [
      0x0000FCFCC0FCC0FC
    ]
  },
  "succeed": {
    "value": 2,
    "blinks": [
      0x0000C3C3C0C3C0C3
    ]
  },
  "error": {
    "value": 3,
    "blinks": [
      0x0000F0F0C0F0C0F0
    ]
  },
};


exports.ci_notifier = (req, res) => {
  var settings = require('./settings.json');

  const passphrase = req.query.passphrase;
  const branch_name = req.query.branch_name;
  const build_state = req.query.build_state;

  if (passphrase !== settings.passphrase) {
    res.status(401).send('Bad passphrase');
  } else if (!(build_state in supported_build_state)) {
    res.status(400).send('Bad build_state : You can use {' + Object.keys(supported_build_state) + "}");
  } else if (branch_name == null) {
    res.status(400).send('Bad branch_name is required');
  } else {
    create_promise(
      settings,
      branch_name,
      supported_build_state[build_state]
    ).then(function() {
      res.status(200).send('Success');
    }).catch(function(e) {
      console.error(e);
      res.status(200).send('Error: ' + e);
    });
  }
};

function create_promise(settings, branch_name, build_state_value) {
  var rp = require("request-promise");
  var promiseRetry = require("promise-retry");

  var codes_url = 'https://api.sakura.io/incoming/v1/' + settings.webhook_token;
  var retry_options = {
      retries:3,
      minTimeout:5000
  };
  var promises = settings.module_ids.map(function(module_id) {
    var channelsJson = [];
    // =====================================
    // Command for branch_name
    var p = 0;
    var sbn = shorten_branch_name(branch_name);
    while (p < sbn.length) {
      // NOTE: Only use lower 53 bit(6byte) because there are limitation of JavaScript
      var t = Math.min(p+6, sbn.length);
      var data = 0;
      for (var i=t-1;i>=p;i--) {
        console.log("C : " + i + " : " + sbn.charAt(i));
        // Do not use bit shift because JavaScript is weird about it!
        data = (data * 256) + (0xFF & sbn.codePointAt(i));
      }
      console.log("D : " + data.toString(16));
      channelsJson.push({
          "channel": 1,
          "type": "L",
          "value": data
      });
      p = t;
    }
    // =====================================
    // Command for commit branch_name and build_state
    channelsJson.push({
        "channel": 0,
        "type": "L",
        "value": build_state_value.value
    });
    // =====================================
    // Command for blink
    build_state_value.blinks.forEach(function(blink) {
      channelsJson.push({
          "channel": 2,
          "type": "L",
          "value": blink
      });
    });

    var bodyJson = {};
    bodyJson["type"] = "channels";
    bodyJson["module"] = module_id;
    bodyJson["payload"] = { "channels": channelsJson }
    var options = {
        "url": codes_url,
        "method": 'POST',
        "encoding": null,
        "timeout": 3000,
        "headers": {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        "json": bodyJson
    };
    console.log(JSON.stringify(bodyJson));
    return promiseRetry(retry_options, function (retry, number) {
        return rp(options).catch(retry);
    });
  });
  return Promise.all(promises);
}


function shorten_branch_name(branch_name) {
  var strs = branch_name.split("/");
  var t;
  if (strs.length <= 1) {
    t = branch_name;
  } else {
    var t1 = strs[strs.length - 2];
    var t2 = strs[strs.length - 1];
    t = t1.substring(0, 3) + "/" + t2;
  }
  return t.substring(0, 16);
}
