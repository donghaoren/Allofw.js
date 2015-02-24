var fs = require('fs');
var yaml = require('js-yaml');
var os = require("os");
var path = require("path");

var config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));

var hostname = os.hostname();

for(var key in config) {
    exports[key] = config[key];
}

if(config[hostname]) {
    for(var key in config[hostname]) {
        exports[key] = config[hostname][key];
    }
}

exports.workspace_directory = path.resolve(exports.workspace_directory);
