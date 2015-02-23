exports.INFO     = 0;
exports.WARNING  = 1;
exports.ERROR    = 2;
exports.FATAL    = 3;

exports.log = function(message, level) {
    if(level === undefined) level = exports.INFO;
    console.log(message, level);
}
