# README #

StatsD Warp10 publisher backend

### Overview ###

* This is a pluggable backend for [StatsD](https://home.cityzendata.net/quasar/signin?continue=https://home.cityzendata.net/), which publishes stats to Warp10 (https://home.cityzendata.net/quasar/signin). The syntax of this plugin is similar to the Opentsdb backend (https://github.com/danslimmon/statsd-opentsdb-backend)

### Installation ###

* npm https://bitbucket.org/aurelien_hebert/statsd-warp10-backend/

### Configuration ###

* You have to give basic information about your Warp10 server to use

```
{ warpHost: 'warp.cityzendata.net'
, warpPath: 'path'
, token: 'yourtoken'
, className: "statsd.testing"
, bufferSize: 100
, backends: [ "statsd-warp10-backend" ]
}
```

* This will create/update your data on your account cityzen data. Classname correspond to the prefix of each GTS created by statsd, buffersize isn't implemented yet.

### Issues ###
* If you want to contribute:

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. Push the branch up to GitHub
5. Send a pull request

* contact : contact@cityzendata.com