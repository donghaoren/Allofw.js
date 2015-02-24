var gCurrentProject = null;
var gCurrentTab = null;

var editor = CodeMirror($("#text-code").get(0), {
    value: "",
    lineNumbers: true,
    styleActiveLine: true,
    mode: "javascript",
    keyMap: "sublime",
    indentUnit: 4,
    autoCloseBrackets: true,
    matchBrackets: true,
    showCursorWhenSelecting: true,
    theme: "default"
});

$("#select-theme").change(function() {
    editor.setOption("theme", $("#select-theme").val());
});

$(window).resize(function() {
    $("#text-area").css("top", $("#toolbar").outerHeight() + "px");
    editor.setSize($("#text-area").width(), $("#text-area").height());
});
$(window).resize();
$(function() {
    $(".sortable").sortable();
    $(".sortable").disableSelection();
});
ModalManageTabs = { };

$("#modal-manage-tabs").on("show.bs.modal", function() {
    ModalManageTabs.load();
});

$("#modal-manage-tabs-confirm").click(function() {
    ModalManageTabs.save();
    $("#modal-manage-tabs").modal("hide");
});

$("#modal-manage-tabs-new-tab").click(function() {
    var tab = gCurrentProject.createTab($("#modal-manage-tabs-new-tab-name").val().trim());
    $("#modal-manage-tabs-new-tab-name").val("");
    var template = $($("#template-modal-tab-list").html());
    template.find("[data-text-from=name]").text(tab.name);
    template.find("[data-value-from=name]").val(tab.name);
    template.data().tab = tab;
    $("#modal-manage-tabs-tab-list").append(template);
    template.hide().slideDown();
});

ModalManageTabs.load = function() {
    $("#modal-manage-tabs-tab-list").children().remove();
    $("#modal-manage-tabs-tab-list").append(gCurrentProject.tabs.map(function(tab) {
        var template = $($("#template-modal-tab-list").html());
        template.find("[data-text-from=name]").text(tab.name);
        template.find("[data-value-from=name]").val(tab.name);
        template.data().tab = tab;
        return template;
    }));
};
ModalManageTabs.save = function() {
    gCurrentProject.tabs = $("#modal-manage-tabs-tab-list li").toArray().map(function(item) {
        $(item).data().tab.name = $(item).find("[data-value-from=name]").val();
        return $(item).data().tab;
    });
    LoadProject(gCurrentProject);
};

var updateCodeChanges = function() {
    if(gCurrentTab) {
        gCurrentTab.code = editor.getValue();
    }
};

// Run and stop buttons.
$("#btn-run").click(function() {
    updateCodeChanges();
    var name = gCurrentProject.name;
    var code = editor.getValue();
    Sketch_Run(name, gCurrentProject);
});

$("#btn-stop").click(function() {
    var name = gCurrentProject.name;
    Sketch_Stop(name);
});

$("#btn-save").click(function() {
    updateCodeChanges();
    gCurrentProject.save();
});

function LoadProject(project) {
    gCurrentProject = project;
    $(".tablist-item").remove();
    $("#menu-tab-list").prepend(project.tabs.map(function(tab) {
        var template = $($("#template-tab-list").html());
        template.find("[data-text-from=name]").text(tab.name);
        template.data().tab = tab;
        return template;
    }));
    if(project.tabs.indexOf(gCurrentTab) >= 0) {
        SetCurrentTab(gCurrentTab);
    } else {
        SetCurrentTab(project.tabs[0]);
    }
}

function SetCurrentTab(tab) {
    updateCodeChanges();
    gCurrentTab = tab;
    $(".tabsbutton").text(tab.name);
    editor.setValue(tab.code);
}

function Project_Load(name) {
    Project.load(name, function(err, project) {
        if(!err) {
            LoadProject(project);
            $("#modal-startup").modal("hide");
        }
    });
}

$(function() {
    $("#modal-startup").modal("show");
    wamp.call("allofw.project.list", { }, {
        onSuccess: function(result) {
            result = result[0];
            result.forEach(function(name) {
                var template = $($("#template-modal-startup-project-list").html());
                template.find("[data-text-from=name]").text(name);
                $("#modal-startup-project-list").append(template);
                template.data().name = name;
            });
        }, onError: function() { }
    });
});

// LoadProject(new Project("Untitled", "javascript"));
