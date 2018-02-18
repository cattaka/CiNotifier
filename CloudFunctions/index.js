/**
 * Cloud Function.
 */
const supported_build_state = {
  "building": {
    "text": "...",
    "blinks": [
      "3C003C003C00FCFC"
    ]
  },
  "succeed_b": {
    "text": "SUC",
    "blinks": [
      "030003000300C3C3"
    ]
  },
  "succeed_g": {
    "text": "SUC",
    "blinks": [
      "0C000C000C00CCCC"
    ]
  },
  "succeed_rgb": {
    "text": "SUC",
    "blinks": [
      "3024180C09060312",
      "213024180C090603",
      "12213024180C0906"
    ]
  },
  "error": {
    "text": "ERR",
    "blinks": [
      "300030003000f0f0"
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
      // console.error(e);
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
      var t = Math.min(p+8, sbn.length);
      var data = str_to_hex_text(sbn.substring(p, t));
      // console.log("D : " + data);
      channelsJson.push({
          "channel": 1,
          "type": "b",
          "value": data
      });
      p = t;
    }
    // =====================================
    // Command for commit branch_name and build_state
    channelsJson.push({
        "channel": 0,
        "type": "b",
        "value": str_to_hex_text(build_state_value.text)
    });
    // =====================================
    // Command for blink
    build_state_value.blinks.forEach(function(blink) {
      channelsJson.push({
          "channel": 2,
          "type": "b",
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
    // console.log(JSON.stringify(bodyJson));
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

function str_to_hex_text(str) {
  var data = "";
  for (var i = 0;i < 8 && i < str.length;i++) {
    var ch = str.codePointAt(i);
    ch = (ch < 0x10) ? "0" + ch.toString(16) : ch.toString(16);
    data += ch;
  }
  while (data.length < 16) {
    data += "0";
  }
  return data.toUpperCase();
}
