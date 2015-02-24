var config = require("./config.js");
var logger = require("./logger.js");

var zmq = require("zmq");
var msgpack = require("msgpack");
var al = require("node_allosphere");
al.initialize();
require("node-webgl").webgl.Init();

var Sketch = require("./sketch.js").Sketch;

var this_renderer = null;

function Renderer() {
    var self = this;
    this_renderer = self;

    this.sketches = { };

    this.sub = zmq.socket("sub");
    this.sub.connect(config.broadcast);
    this.sub.subscribe("");
    this.push = zmq.socket("push");
    this.push.connect(config.renderer_events);

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

Renderer.prototype.push_to_controller = function(message) {
    var data = msgpack.pack(message);
    this.push.send(data);
};

Renderer.prototype.onMessage = function(message) {
    var self = this;
    if(message.type == "render") {
        al.tick();
    }
    if(message.type == "sketch.message") {
        if(this.sketches[message.sketch])
            this.sketches[message.sketch].onMessage(message.message);
    }
    if(message.type == "sketch.run") {
        var sketch = new Sketch(message.name);
        this.sketches[message.name] = sketch;
        sketch.delegate = {
            broadcast: function() {
                // We don't support broadcast in renderer.
                throw new Exception("broadcast() is not allowed in render().");
            },
            postMessage: function(msg) {
                if(self.isMainRenderer) {
                    self.push_to_controller({
                        type: "sketch.log",
                        name: sketch.name,
                        message: msg
                    });
                }
                if(message.type == "stop") {
                    self.push_to_controller({
                        type: "sketch.stop",
                        name: sketch.name
                    });
                }
            },
            terminate: function() {
                self.push_to_controller({
                    type: "sketch.stop",
                    name: sketch.name
                });
            }
        };
        sketch.loadCode(message.code);
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
