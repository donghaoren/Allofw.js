var config = require("./config.js");
var logger = require("./logger.js");

var zmq = require("zmq");
var msgpack = require("msgpack");
var al = require("node_allosphere");
al.initialize();

var Sketch = require("./sketch.js").Sketch;

var this_renderer = null;

function Renderer() {
    var self = this;
    this_renderer = self;

    this.sketches = { };

    this.sub = zmq.socket("sub");
    this.sub.connect(config.broadcast);
    this.sub.subscribe("");

    this.sub.on("message", function(data) {
        var message;
        try {
            message = msgpack.unpack(data);
        } catch(e) {
            logger.log("E_MESSAGE_DECODING");
        }
        try {
            self.onMessage(message);
        } catch(e) {
            logger.log(e.stack);
        }
    });
}

al.onDraw(function() {
    this_renderer.render();
});

Renderer.prototype.render = function() {
    for(var name in this.sketches) {
        this.sketches[name].render();
    }
};

Renderer.prototype.broadcast = function(message) {
    var data = msgpack.pack(message);
    this.pub.send(data);
};

Renderer.prototype.onMessage = function(message) {
    var self = this;
    if(message.type == "render") {
        al.tick();
    }
    if(message.type == "sketch.message") {
        this.sketches[message.sketch].onMessage(message.message);
    }
    if(message.type == "sketch.run") {
        var sketch = new Sketch(message.name);
        this.sketches[message.name] = sketch;
        sketch.loadCode(message.code);
        sketch.delegate = {
            broadcast: function() { }
        };
        sketch.setupRender();
    }
    if(message.type == "sketch.stop") {
        delete this.sketches[message.name];
    }
};

Renderer.prototype.terminate = function() {
    clearInterval(this.timer);
    this.rep.close();
};

exports.Renderer = Renderer;
