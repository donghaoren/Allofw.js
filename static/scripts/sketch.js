var wamp = new Wampy("/ws", { realm: "anonymous" });
var response_t = {
    onSuccess: function() {},
    onError: function(err) { console.log('RPC call failed with error ' + err); }
};

function Project(name, language, tabs) {
    this.name = name;
    this.language = language;
    if(tabs !== undefined) {
        this.tabs = tabs;
    } else {
        this.tabs = [ { name: "Main", code: "// Project Name: " + name + "\n" } ];
    }
};

Project.prototype.createTab = function(name, code) {
    if(name == "") return;
    if(!code) code = "// Tab: " + name + "\n";
    var tab = {
        name: name,
        code: code
    };
    this.tabs.push(tab);
    return tab;
};

Project.prototype.save = function(callback) {
    wamp.call("allofw.project.save_project", {
        name: this.name,
        project: {
            name: this.name,
            language: this.language,
            tabs: this.tabs.slice()
        }
    }, {
        onSuccess: function() {
            callback(false);
        },
        onError: function() {
            callback("E_FAILED");
        }
    });
};

Project.load = function(name, callback) {
    wamp.call("allofw.project.load_project", {
        name: name
    }, {
        onSuccess: function(result) {
            var p = result[0];
            callback(false, new Project(p.name, p.language, p.tabs));
        },
        onError: function() {
            callback("E_FAILED");
        }
    });
};


var subscribed_sketch = null;
function Sketch_Run(name, code) {
    var sketch_to_subscribe = "allofw.event.sketch." + md5(name);
    if(subscribed_sketch != sketch_to_subscribe) {
        if(subscribed_sketch) {
            wamp.unsubscribe(subscribed_sketch);
        }
        wamp.subscribe(sketch_to_subscribe, function(msg) {
            var message = msg[0];
            if(message.type == "log") {
                $("#log-area").append($("<div></div>").addClass("log").text(message.text));
            }
            if(message.type == "exception") {
                var line = message.stack.match(/\(__code__(\d+)\:(\d+):(\d+)/);
                var text = message.text;
                if(line) {
                    var tabNumber = parseInt(line[1]);
                    var lineNumber = parseInt(line[2]);
                    var columnNumber = parseInt(line[3]);
                    tabName = code.tabs[tabNumber].name;
                    text += " (tab: " + tabName + ", line: " + lineNumber + ", column: " + columnNumber + ")";
                }
                var elem = $("<div></div>").addClass("exception").text("Exception: " + text);
                elem.append($("<div></div>").text(message.stack));
                $("#log-area").append(elem);
                elem.click(function() {
                    $(this).children().slideDown();
                    if(line) {
                        SetCurrentTab(gCurrentProject.tabs[tabNumber]);
                        editor.setCursor(lineNumber - 1, columnNumber - 1);
                        editor.focus();
                    }
                });
            }
            $("#log-area").scrollTop($("#log-area").prop("scrollHeight"));
        });
        subscribed_sketch = sketch_to_subscribe;
    }
    $("#log-area").children().remove();
    wamp.call("allofw.sketch.run", {
        name: name,
        code: code
    }, response_t);
}

function Sketch_Stop(name) {
    wamp.call("allofw.sketch.stop", {
        name: name
    }, response_t);
}
