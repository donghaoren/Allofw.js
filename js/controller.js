var config = require("./config.js");
var logger = require("./logger.js");

var zmq = require("zmq");
var msgpack = require("msgpack");

var Sketch = require("./sketch.js").Sketch;

function Controller() {
    var self = this;

    this.sketches = { };

    this.rep = zmq.socket("rep");
    this.rep.bind(config.server);
    this.pub = zmq.socket("pub");
    this.pub.bind(config.broadcast);

    this.rep.on("message", function(data) {
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
        }
        self.rep.send(msgpack.pack(response));
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
    this.pub.send(data);
};

Controller.prototype.onRequest = function(message) {
    var self = this;
    if(message.type == "sketch.run") {
        self.broadcast(message);
        var sketch = new Sketch(message.name);
        this.sketches[message.name] = sketch;
        sketch.loadCode(message.code);
        sketch.delegate = {
            broadcast: function(msg) {
                self.broadcast({
                    type: "sketch.message",
                    sketch: sketch.name,
                    message: msg
                });
            }
        };
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
    return "E_INVALID_MESSAGE";
};

Controller.prototype.terminate = function() {
    clearInterval(this.timer);
    this.rep.close();
};

exports.Controller = Controller;

// var fs = require("fs");



// var sketch = new Sketch("untitled");

// sketch.loadCode(fs.readFileSync('code.js', 'utf8'));

// sketch.update();
// sketch.render();
