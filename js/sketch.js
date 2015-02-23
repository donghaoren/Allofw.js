var vm = require("vm");
var al = require("node_allosphere");
var graphics = require("node_graphics");

function install_builtins(c, sketch) {
    // Math functions and constants.
    [ "E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2",
      "abs", "acos", "asin", "atan", "atan2", "ceil", "cos", "exp",
      "floor", "log", "max", "min", "pow", "random", "round",
      "sin", "sqrt", "tan"
    ].forEach(function(name) {
        c[name] = Math[name];
    });
    // Rendering functions.
    c.console = { };
    c.log = function(message) {
        console.log(message);
    };
    c.console.log = c.log;

    c.frameCount = 0;
    c.broadcast = function() {
        for(var i = 0; i < arguments.length; i++) {
            sketch._broad_arguments[arguments[i]] = true;
        }
    };
    c.allosphere = al;
    c.GL = al.OpenGL;
    c.graphics = graphics;
    // Allow require.
    c.require = require;
}

function Sketch(name) {
    this.name = name;
}


Sketch.prototype.loadCode = function(code) {
    this.context = vm.createContext();
    this.code = code;
    install_builtins(this.context, this);

    try {
        vm.runInContext(code, this.context);
    } catch(e) {
        this._reportException(e);
    }
};

Sketch.prototype.setupRender = function() {
    if(!this.context) return;
    try {
        if(this.context.setupRender) {
            vm.runInContext("setupRender()", this.context);
        } else if(this.context.setupDraw) {
            vm.runInContext("setupDraw()", this.context);
        }
    } catch(e) {
        this._reportException(e);
    }
};

Sketch.prototype.render = function() {
    if(!al) initializeAllosphere();
    if(!this.context) return;
    try {
        if(this.context.render) {
            vm.runInContext("render()", this.context);
        } else if(this.context.draw) {
            vm.runInContext("draw()", this.context);
        }
    } catch(e) {
        this._reportException(e);
    }
};

Sketch.prototype.setupSimulator = function() {
    if(!this.context) return;
    // Update
    this.context.frameCount = 0;
    this.context.timestamp = new Date().getTime() / 1000.0;

    this._broad_arguments = {
        frameCount: true,
        timestamp: true
    };

    try {
        if(this.context.setupSimulator) {
            vm.runInContext("setupSimulator()", this.context);
        } else if(this.context.setupUpdate) {
            vm.runInContext("setupUpdate()", this.context);
        }
    } catch(e) {
        this._reportException(e);
    }
    this._performBroadcast();
};

Sketch.prototype.simulator = function() {
    if(!this.context) return;
    // Update
    this.context.frameCount += 1;
    this.context.timestamp = new Date().getTime() / 1000.0;

    this._broad_arguments = {
        frameCount: true,
        timestamp: true
    };
    try {
        if(this.context.simulator) {
            vm.runInContext("simulator()", this.context);
        } else if(this.context.update) {
            vm.runInContext("update()", this.context);
        }
    } catch(e) {
        this._reportException(e);
    }
    this._performBroadcast();
};

Sketch.prototype.onMessage = function(message) {
    if(!this.context) return;
    if(message.type == "sync") {
        for(var key in message.content) {
            var value = message.content[key];
            this.context[key] = value;
        }
    }
};

Sketch.prototype._performBroadcast = function() {
    bcast_message = {
        type: "sync",
        content: { }
    };
    for(var key in this._broad_arguments) {
        bcast_message.content[key] = this.context[key];
    }
    this._broad_arguments = { };
    this.delegate.broadcast(bcast_message);
};

Sketch.prototype._postMessage = function(str) {
    console.log("[Sketch '" + this.name + "'] " + str);
};

Sketch.prototype._reportException = function(e) {
    this._postMessage(e.stack);
};

exports.Sketch = Sketch;
