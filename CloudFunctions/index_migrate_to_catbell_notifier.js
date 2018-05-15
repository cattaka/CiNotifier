/**
 * If you are going replace CiNotifier with CatbellNotifier,
 * replace this file with index.js
 */
exports.ci_notifier = (req, res) => {
	var settings = require('./settings.json');
	var rp = require("request-promise");
	var promiseRetry = require("promise-retry");

	const passphrase = req.query.passphrase;
	const branch_name = req.query.branch_name;
	const build_state = req.query.build_state;

	if (passphrase !== settings.passphrase) {
		res.status(401).send('Bad passphrase');
		return;
	} else if (branch_name == null || branch_name.legnth == 0) {
		res.status(400).send('Bad branch_name is required');
		return;
	}

	var replaced_state;
	if (build_state == "building") {
		replaced_state = "begin";
	} else if (build_state == "succeed_b"
		|| build_state == "succeed_g"
		|| build_state == "succeed_rgb") {
		replaced_state = "success";
	} else {
		replaced_state = "error";
	}

	var url = "https://us-central1-catbell-notifier.cloudfunctions.net/notify"
		+ "?token=" + settings.token_catbell_notifier
		+ "&topic=" + settings.topic_catbell_notifier
		+ "&state=" + replaced_state
		+ "&item=" + branch_name;

	var retry_options = {
	      retries:3,
	      minTimeout:15000
	  };
	var options = {
	    "url": url,
	    "method": 'GET',
	    "timeout": 10000
	};
	// console.log(JSON.stringify([url, retry_options, options]));
	return promiseRetry(retry_options, function (retry, number) {
	    return rp(options).catch(retry);
	}).then(function() {
	  res.status(200).send('Success');
	}).catch(function(e) {
	  res.status(200).send('Error: ' + e + " : " + JSON.stringify([url, retry_options, options]));
	});
};
