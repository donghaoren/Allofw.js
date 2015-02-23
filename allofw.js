var config = require("./js/config.js");

var role = config.role.split(",");

for(var i = 0; i < role.length; i++) {
    if(role[i] == "renderer") {
        var Renderer = require("./js/renderer.js").Renderer;
        var renderer = new Renderer();
    }
    if(role[i] == "simulator") {
        var Controller = require("./js/controller.js").Controller;
        var controller = new Controller();
    }
}
