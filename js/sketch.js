var vm = require("vm");
var al = require("node_allosphere");
var graphics = require("node_graphics");
//var webgl = require("node-webgl").webgl;
var util = require("util");
var fs = require("fs-extra");
var path = require("path");
var config = require("./config.js");
var coffeescript = require("coffee-script");

function install_builtins(c, sketch) {
    // Math functions and constants.
    // Note: Not all of them are supported in NodeJS.
    ["E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2",
     "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh",
     "cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor",
     "fround", "hypot", "imul", "log", "log1p", "log2", "log10", "max",
     "min", "pow", "random", "round", "sign", "sin", "sinh", "sqrt",
     "tan", "tanh", "trunc"
    ].forEach(function(name) {
        c[name] = Math[name];
    });

    // Rendering functions.
    c.println = function() {
        var items = [];
        for(var i = 0; i < arguments.length; i++) {
            items.push(util.inspect(arguments[i]));
        }
        sketch._postMessage({
            type: "log",
            text: items.join(" ")
        });
    };
    c.console = { };
    c.print = c.println;
    c.console.log = c.log;

    c.exit = function() {
        sketch.delegate.terminate();
    }

    c.frameCount = 0;
    c.broadcast = function() {
        for(var i = 0; i < arguments.length; i++) {
            sketch._broad_arguments[arguments[i]] = true;
        }
    };

    // Common data types.
    c.Float32Array = Float32Array;
    c.Float64Array = Float64Array;

    c.Allosphere = al;
    c.GL = al.OpenGL;
    c.Graphics = graphics;
    //c.WebGL = webgl;

    // Allow require.
    c.require = require;
}

function Sketch(name) {
    this.name = name;
    this.working_directory = (new ProjectManager(name)).root;
}

Sketch.prototype.loadCode = function(project) {
    var self = this;
    this.context = vm.createContext();
    this.project = project;
    install_builtins(this.context, this);
    try {
        this.scripts = this.project.tabs.map(function(tab, index) {
            if(self.project.language == "coffee-script") {
                return new vm.Script(coffeescript.compile(tab.code), "__code__" + index);
            } else {
                return new vm.Script(tab.code, "__code__" + index);
            }
        });
    } catch(e) {
        this._reportException(e);
        return;
    }
    try {
        process.chdir(this.working_directory);
        for(var i = 0; i < this.scripts.length; i++) {
            this.scripts[i].runInContext(this.context);
        }
    } catch(e) {
        this._reportException(e);
    }
};

Sketch.prototype.callFunction = function(name) {
    if(!this.context) return;
    try {
        process.chdir(this.working_directory);
        if(this.context[name]) {
            vm.runInContext(name + "();", this.context);
        }
    } catch(e) {
        this._reportException(e);
    }
};

Sketch.prototype.setupRender = function() {
    this.callFunction("setupRender");
    this.callFunction("setupDraw");
};

Sketch.prototype.render = function() {
    if(!al) initializeAllosphere();
    this.callFunction("render");
    this.callFunction("draw");
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

    this.callFunction("setupSimulator");
    this.callFunction("setupUpdate");

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
    this.callFunction("simulator");
    this.callFunction("update");
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

Sketch.prototype._postMessage = function(message) {
    this.delegate.postMessage(message);
};

Sketch.prototype._reportException = function(e) {
    this._postMessage({
        type: "exception",
        stack: e.stack,
        text: e.message
    });
    this.delegate.terminate();
};

function ProjectManager(name) {
    if(!name.match(/^[0-9a-zA-Z\.\-\_\ ]+$/)) {
        throw new Error("E_INVALID_PROJECT_NAME");
    }
    this.root = path.join(config.workspace_directory, name + ".project");
    this.name = name;
};

ProjectManager.prototype._getPath = function(file) {
    return path.join(this.root, file);
};

ProjectManager.prototype._ensureDirectory = function() {
    fs.ensureDirSync(this.root);
};

ProjectManager.prototype.listFiles = function() {
    this._ensureDirectory();
    var files = fs.readdirSync(this.root);
    files = files.filter(function(filename) {
        var path = this._getPath(filename);
        return fs.statSync(path).isFile();
    });
};

ProjectManager.prototype.renameFile = function(dest, src) {
    this._ensureDirectory();
    fs.renameSync(this._getPath(src), this._getPath(dest));
};

ProjectManager.prototype.uploadFile = function(dest, content) {
    this._ensureDirectory();
    fs.writeFileSync(dest, content);
};

ProjectManager.prototype.saveProject = function(project) {
    this._ensureDirectory();
    fs.writeFileSync(this._getPath("code.json"), JSON.stringify(project));
};

ProjectManager.prototype.loadProject = function() {
    return JSON.parse(fs.readFileSync(this._getPath("code.json")));
};

ProjectManager.listProjects = function() {
    var dirs = fs.readdirSync(config.workspace_directory);
    dirs = dirs.filter(function(filename) {
        var path = config.workspace_directory + "/" + filename;
        return fs.statSync(path).isDirectory() && filename.substr(-8) == ".project";
    });
    dirs = dirs.map(function(x) {
        return x.slice(0, x.length - 8);
    });
    return dirs;
};

exports.Sketch = Sketch;
exports.ProjectManager = ProjectManager;
