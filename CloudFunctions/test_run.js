var sup = require('./index.js');
var settings = require('./settings.json');

if (process.argv.length < 5) {
    console.log("Usage: test_run <passphrase> <branch_name> <build_state>")
    process.exit(1);
}

var req = {
  "query": {
    "passphrase": process.argv[2],
    "branch_name": process.argv[3],
    "build_state": process.argv[4],
  }
}

var res = {
  "status": function(code) {
    console.log("status_code : " + code);
    return {
      "send": function(body) {
        console.log("body : " + body);
        process.exit(0);
      }
    };
  }
};

sup.ci_notifier(req, res);
