var config = require("./config.js");
var logger = require("./logger.js");

var zmq = require("zmq");
var msgpack = require("msgpack");

var Sketch = require("./sketch.js").Sketch;
var ProjectManager = require("./sketch.js").ProjectManager;

var fs = require("fs-extra");
var path = require("path");


function Controller() {
    var self = this;

    this.sketches = { };

    this.socket_rep = zmq.socket("rep");
    this.socket_rep.bind(config.server);

    this.socket_pub = zmq.socket("pub");
    this.socket_pub.bind(config.broadcast);

    this.socket_events = zmq.socket("pub");
    this.socket_events.bind(config.events);

    this.socket_renderer = zmq.socket("pull");
    this.socket_renderer.bind(config.renderer_events);

    this.socket_rep.on("message", function(data) {
        var message;
        try {
            message = msgpack.unpack(data);
        } catch(e) {
            logger.log("E_MESSAGE_DECODING");
        }
        response = { };
        try {
            response = self.onRequest(message);
        } catch(e) {
            logger.log(e.stack);
            response = "E_REQUEST_FAILED";
        }
        self.socket_rep.send(msgpack.pack(response));
    });

    this.socket_renderer.on("message", function(data) {
        var message;
        try {
            message = msgpack.unpack(data);
        } catch(e) {
            logger.log("E_MESSAGE_DECODING");
        }
        response = { };
        try {
            response = self.onRendererEvent(message);
        } catch(e) {
            logger.log(e.stack);
        }
    });

    this.timer = setInterval(function() {
        self.update();
    }, 10);
}

Controller.prototype.update = function() {
    for(var name in this.sketches) {
        this.sketches[name].simulator();
    }
    this.broadcast({ type: "render" });
};

Controller.prototype.broadcast = function(message) {
    var data = msgpack.pack(message);
    this.socket_pub.send(data);
};

Controller.prototype.broadcast_events = function(source, message) {
    var data = msgpack.pack({ source: source, message: message });
    this.socket_events.send(data);
};

Controller.prototype.onRendererEvent = function(message) {
    if(message.type == "sketch.log") {
        this.broadcast_events(message.name, message.message);
    }
    if(message.type == "sketch.stop") {
        this.onRequest(message);
    }
};

Controller.prototype.onRequest = function(message) {
    var self = this;
    if(message.type == "sketch.run") {
        self.broadcast(message);
        var sketch = new Sketch(message.name);
        this.sketches[message.name] = sketch;
        sketch.delegate = {
            broadcast: function(msg) {
                self.broadcast({
                    type: "sketch.message",
                    sketch: sketch.name,
                    message: msg
                });
            },
            postMessage: function(msg) {
                self.broadcast_events(sketch.name, msg);
            },
            terminate: function() {
                self.broadcast({
                    type: "sketch.stop",
                    name: sketch.name
                });
                delete self.sketches[sketch.name];
            }
        };
        sketch.loadCode(message.code);
        sketch.setupSimulator();
        return true;
    }
    if(message.type == "sketch.stop") {
        self.broadcast(message);
        delete this.sketches[message.name];
        return true;
    }
    if(message.type == "sketch.list") {
        var result = [ ];
        for(var name in this.sketches) {
            result.push(name);
        }
        return result;
    }
    if(message.type == "sketch.get_code") {
        if(this.sketches[message.name])
            return this.sketches[message.name].code;
        else
            return null;
    }
    if(message.type == "project.list") {
        return ProjectManager.listProjects();
    }
    if(message.type == "project.delete") {
        var proj = new ProjectManager(message.name);
        proj.delete();
        return true;
    }
    if(message.type == "project.upload_file") {
        var proj = new ProjectManager(message.name);
        proj.uploadFile(message.filename, new Buffer(message.contents, 'base64'));
        return true;
    }
    if(message.type == "project.rename_file") {
        var proj = new ProjectManager(message.name);
        proj.renameFile(message.destination, message.source);
        return true;
    }
    if(message.type == "project.list_files") {
        var proj = new ProjectManager(message.name);
        return proj.listFiles();
    }
    if(message.type == "project.load_project") {
        var proj = new ProjectManager(message.name);
        return proj.loadProject();
    }
    if(message.type == "project.save_project") {
        var proj = new ProjectManager(message.name);
        proj.saveProject(message.project);
        return true;
    }
    return "E_INVALID_MESSAGE";
};

Controller.prototype.terminate = function() {
    clearInterval(this.timer);
    this.socket_rep.close();
};

exports.Controller = Controller;
