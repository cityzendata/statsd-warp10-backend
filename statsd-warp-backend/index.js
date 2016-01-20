//
//   Copyright 2016  Cityzen Data
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
//

/*
 * Flush stats to warp10 (http://cityzendata.net/).
 *
 * To enable this backend, include 'warp10' in the backends
 * configuration array:
 *
 *   backends: ['statsd-warp10-backend']
 *
 * This backend supports the following config options:
 *
 *   warpHost: Hostname of warp server
 *   warpPath: Path to the warp to push
 *   warpToken: Yoken to contact to your account
 *   classname: to give to your GTS
 *   bufferSize: SizeLimit of buffer
 */

	var util = require('util');
	var debug;
	var flushInterval;
	var warpHost;
	var warpPath;
	var warpToken;
	var className;
	var bufferSize;
	var tagPrefix;

	// prefix configuration
	var globalPrefix;
	var prefixPersecond;
	var prefixCounter;
	var prefixTimer;
	var prefixGauge;
	var prefixSet;

	// set up namespaces
	var legacyNamespace = true;
	var globalNamespace  = [];
	var counterNamespace = [];
	var timerNamespace   = [];
	var gaugesNamespace  = [];
	var setsNamespace     = [];

	var warpStats = {};

	function PostCode(codestring) 
	{	
		var contentType = 'text/plain';	  
	  
		// We need this to build our post string
		var querystring = require('querystring');
		var http = require('https');
		var fs = require('fs');
	    
	    // An object of options to indicate where to post to
	    var post_options = 
	    {
		    host: warpHost,
			port: '443',
			path: warpPath,
		    method: 'POST',
		    headers: {
		            'X-CityzenData-Token' : warpToken,
		            'Content-type': contentType
	        }
	    };

    	// Set up the request
		var post_req = http.request(post_options, function(res) 
		{
		    res.setEncoding('utf8');
		    if(res.StatusCode === 200)
		    {
		    	warpStats.last_flush = Math.round(new Date().getTime() * 1000);
		    }
		    else
		    {
		    	warpStats.last_exception = Math.round(new Date().getTime() * 1000);
		    }
		    res.on('data', function (chunk) {
		    	if (debug) {
		            util.log('Response: ' + chunk);
		          }
		    });
		});

		// post the data
		post_req.write(codestring);
		post_req.end();
	}
	
	var post_stats = function warp_post_stats(statString) 
	{
	  var last_flush = (warpStats.last_flush || 0) * 1000000;
	  var last_exception = (warpStats.last_exception || 0) * 1000000;

	  var ts = Math.round(new Date().getTime() * 1000);
      var namespace = globalNamespace.concat('statsd');
      statString += ts + '// ' + className + '.' +  namespace.join(".") + '.warpStats.last_exception{source=statsd} ' + last_exception + "\n";
      statString += ts + '// ' + className + '.' + namespace.join(".") + '.warpStats.last_flush{source=statsd} ' + last_flush + "\n";
	  
	  PostCode(statString);
	}
	
	// Returns a list of "tagname=tagvalue" strings from the given metric name.
	function parse_tags(metric_name) 
	{
	  var parts = metric_name.split(".");
	  var tags = [];
	  var current_tag_name = "";
	  for (i in parts) {
	    var p = parts[i]
	    if (p.indexOf(tagPrefix) == 0) {
	      var tag_name = p.split(tagPrefix)[1];
	      current_tag_name = tag_name
	    } else if (current_tag_name != "") {
	      tags.push(current_tag_name + "=" + p);
	      current_tag_name = "";
	    }
	  }

	  return tags;
	}

	// Strips out all tag information from the given metric name
	function strip_tags(metric_name) 
	{
	  var parts = metric_name.split(".");
	  var rslt_parts = [];
	  while (parts.length > 0) {
	    if (parts[0].indexOf(tagPrefix) == 0) {
	      parts.shift();
	      parts.shift();
	      continue;
	    }
	    rslt_parts.push(parts.shift());
	  }

	  return rslt_parts.join(".");
	}


	var flush_stats = function warp_flush(ts, metrics) 
	{
	  var suffix = "source=statsd";
	  var starttime = Date.now();
	  var statString = '';
	  var numStats = 0;
	  var key;
	  var timer_data_key;
	  var counters = metrics.counters;
	  var gauges = metrics.gauges;
	  var timers = metrics.timers;
	  var sets = metrics.sets;
	  var timer_data = metrics.timer_data;
	  var statsd_metrics = metrics.statsd_metrics;
	  ts = ts*1000000

	  for (key in counters) {
	    var tags = parse_tags(key);
	    var stripped_key = strip_tags(key)

	    var namespace = counterNamespace.concat(stripped_key);
	    var value = counters[key];

	    if (legacyNamespace === true) {
	    var joinTagSuffix = "";
	    (tags === null || /^\s*$/.test(tags)) ? joinTagSuffix = "" : joinTagSuffix=",";	
	      statString += ts + '// ' + className + '.' + 'stats_counts.' + key + '{' + tags.join(',') + joinTagSuffix + suffix + '} ' + value  + '\n';
	    } else {
	    var joinTagSuffix = "";
	    (tags === null || /^\s*$/.test(tags)) ? joinTagSuffix = "" : joinTagSuffix=",";
	      statString += ts + '// ' + className + '.' + namespace.concat('count').join(".") + '{'  + tags.join(',') + joinTagSuffix + suffix + '} ' + value + '\n';
	    }

	    numStats += 1;
	  }

	  for (key in timer_data) {
	    if (Object.keys(timer_data).length > 0) {
	      for (timer_data_key in timer_data[key]) {
	        var tags = parse_tags(key);
	        var stripped_key = strip_tags(key)

	        var namespace = timerNamespace.concat(stripped_key);
	        var the_key = namespace.join(".");
		    var joinTagSuffix = "";
		    (tags === null || /^\s*$/.test(tags)) ? joinTagSuffix = "" : joinTagSuffix=",";	
	        statString += ts + '// ' + className + '.' + the_key + '.' + timer_data_key + '{'+ tags.join(',')  + joinTagSuffix + suffix + '} ' + timer_data[key][timer_data_key];
	      }

	      numStats += 1;
	    }
	  }

	  for (key in gauges) {
	    var tags = parse_tags(key);
	    var stripped_key = strip_tags(key)

	    var namespace = gaugesNamespace.concat(stripped_key);
	    var joinTagSuffix = "";
	    (tags === null || /^\s*$/.test(tags)) ? joinTagSuffix = "" : joinTagSuffix=",";	
	    statString += ts + '// ' + className + '.' + namespace.join(".") + '{' + tags.join(',') + joinTagSuffix + suffix + '} ' + gauges[key] + '\n';
	    numStats += 1;
	  }

	  for (key in sets) {
	    var tags = parse_tags(key);
	    var stripped_key = strip_tags(key)

	    var namespace = setsNamespace.concat(stripped_key);
	    var joinTagSuffix = "";
	    (tags === null || /^\s*$/.test(tags)) ? joinTagSuffix = "" : joinTagSuffix=",";	
	    statString += ts + '// ' + className + '.' + namespace.join(".") + '.count' + '{' + tags.join(',') + joinTagSuffix + suffix + '} ' + sets[key].values().length + '\n';
	    numStats += 1;
	  }

	  var namespace = globalNamespace.concat('statsd');
	  if (legacyNamespace === true) {
	    statString += ts + '// ' + className + '.' + 'numStats' + '{'+ suffix + '} ' + numStats + '\n';
	    statString += ts + '// ' + className + '.' + 'stats.statsd.warpStats.calculationtime{' + suffix + '} ' + (Date.now() - starttime) + '\n';
	    for (key in statsd_metrics) {
	      statString += ts + '// ' + className + '.' + 'stats.statsd.' + key  + '{'+ suffix + '} ' + statsd_metrics[key] + '\n';
	    }
	  } else {
	    statString += ts + '// ' + className + '.' + namespace.join(".") + '.numStats{' + suffix + '} ' + numStats + '\n';
	    statString += ts + '// ' + className + '.' + namespace.join(".") + '.warpStats.calculationtime{' + suffix + '} ' + (Date.now() - starttime) + '\n';
	    for (key in statsd_metrics) {
	      var the_key = namespace.concat(key);
	      statString += ts + '// ' + className + '.' + the_key.join(".") + '{' + suffix + '} ' + statsd_metrics[key] + '\n';
	    }
	  }
	
	  post_stats(statString);
	};

	var backend_status = function warp_status(writeCb) 
	{
	  for (stat in warpStats) {
	    writeCb(null, 'warp', stat, warpStats[stat]);
	  }
	};

	exports.init = function warp_init(startup_time, config, events) 
	{
	  debug = config.debug;
	  warpHost = config.warpHost;
	  warpPath = config.warpPath;
	  warpToken = config.warpToken;
	  tagPrefix = config.tagPrefix;
	  className = config.className;
	  bufferSize = config.bufferSize;
	  config.warp = config.warp || {};
	  globalPrefix    = config.warp.globalPrefix;
	  prefixCounter   = config.warp.prefixCounter;
	  prefixTimer     = config.warp.prefixTimer;
	  prefixGauge     = config.warp.prefixGauge;
	  prefixSet       = config.warp.prefixSet;
	  legacyNamespace = config.warp.legacyNamespace;

	  // set defaults for prefixes
	  globalPrefix  = globalPrefix !== undefined ? globalPrefix : "stats";
	  prefixCounter = prefixCounter !== undefined ? prefixCounter : "counters";
	  prefixTimer   = prefixTimer !== undefined ? prefixTimer : "timers";
	  prefixGauge   = prefixGauge !== undefined ? prefixGauge : "gauges";
	  prefixSet     = prefixSet !== undefined ? prefixSet : "sets";
	  legacyNamespace = legacyNamespace !== undefined ? legacyNamespace : true;


	  if (legacyNamespace === false) {
	    if (globalPrefix !== "") {
	      globalNamespace.push(globalPrefix);
	      counterNamespace.push(globalPrefix);
	      timerNamespace.push(globalPrefix);
	      gaugesNamespace.push(globalPrefix);
	      setsNamespace.push(globalPrefix);
	    }

	    if (prefixCounter !== "") {
	      counterNamespace.push(prefixCounter);
	    }
	    if (prefixTimer !== "") {
	      timerNamespace.push(prefixTimer);
	    }
	    if (prefixGauge !== "") {
	      gaugesNamespace.push(prefixGauge);
	    }
	    if (prefixSet !== "") {
	      setsNamespace.push(prefixSet);
	    }
	  } else {
	      globalNamespace = ['stats'];
	      counterNamespace = ['stats'];
	      timerNamespace = ['stats', 'timers'];
	      gaugesNamespace = ['stats', 'gauges'];
	      setsNamespace = ['stats', 'sets'];
	  }

	  warpStats.last_flush = startup_time;
	  warpStats.last_exception = startup_time;

	  flushInterval = config.flushInterval;

	  events.on('flush', flush_stats);
	  events.on('status', backend_status);

	  return true;
	};
