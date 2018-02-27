## CiNotifier Endpoint
This uses Google Cloud Functions

### How to develop

#### Setup
Copy settings.json.sample as settings.json then edit it.

#### HOW-TO LOCAL EXECUTE
```sh
$ node test_run.js <passphrase> <branch_name> <build_state>
```

#### HOW-TO DEPLOY

```sh
$ gcloud beta functions deploy \
  ci_notifier \
  --trigger-http
```

#### HOW-TO REMOTE EXECUTE

```
$ curl https://<your-project-location>.cloudfunctions.net/ci_notifier?passphrase=<your-passphrase>&branch_name=<branch_name>&build_state=<build_state>
```
