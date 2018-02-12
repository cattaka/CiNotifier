/**
 * Cloud Function.
 */
const supported_build_state = {
  "building": {
    "value": 1,
    "blinks": [
      0x0000FCC0FCC0FCFC
    ]
  },
  "succeed": {
    "value": 2,
    "blinks": [
      0x0000C3C0C3C0C3C3
    ]
  },
  "error": {
    "value": 3,
    "blinks": [
      0x0000F0C0F0C0F0F0
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
  } else if (!(build_state in supported_build_state) {
    res.status(400).send('Bad build_state : You can use ' + keys(supported_build_state));
  } else if (branch_name == null) {
    res.status(400).send('Bad branh_name is required');
  } else {
    create_promise(
      settings,
      branh_name,
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
  var codes_url = 'https://api.sakura.io/incoming/v1/' + settings.webhook_token;
  var retry_options = {
      retries:3,
      minTimeout:5000
  };
  var promises = settings.module_ids.map(function(module_id) {
    var channelsJson = [];
    channelsJson.push({
        "channel": 0,
        "type": "L",
        "value": build_state_value.value
    });
    build_state_value.blinks.forEach(function(blink) {
      channelsJson.push({
          "channel": 2,
          "type": "L",
          "value": blink
      });
    });
    var p = 0;
    while (p<branh_name.length()) {
      var t = Math.min(p+6, branh_name.length());
      var data = 0;
      for (var i=p;i<t;i++) {
        data = (data << 8) | (0xFF & branh_name.charAt(i));
      }
      channelsJson.push({
          "channel": 1,
          "type": "L",
          "value": data
      });
      p = t;
    }

    var bodyJson = {};
    bodyJson["type"] = "channels";
    bodyJson["module"] = module_id;
    bodyJson["payload"] = { "channels": channelsJson }
    var options = {
        "url": codes_url,
        "method": 'POST',
        "encoding": null,
        "timeout": 3000,
        "headers": [
          "Content-Type": "application/json",
          "Accept": "application/json"
        ],
        "json": bodyJson
    };
    console.log(bodyJson);
    return promiseRetry(retry_options, function (retry, number) {
        return rp(options).catch(retry);
    });
  });
  return Promise.all(promises);
}
