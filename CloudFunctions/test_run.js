var sup = require('./index.js');
var settings = require('./settings.json');

if (process.argv.length < 4) {
    console.log("Usage: test_run <passphrase> <branch_name> <build_state>")
    process.exit(1);
}

var req = {
  "query": {
    "passphrase": process.argv[1],
    "branch_name": process.argv[2],
    "passphrase": process.argv[3],
  }
}
var req = {
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
