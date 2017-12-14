const http = require('http');

var callback = function (response) {
    var chunk = [];
    response.on('data', function (data) {
        chunk.push(data);
    });
    response.on('end', function () {
        var buf = Buffer.concat(chunk);
        var fs = require('fs');
        fs.writeFile("debug.json", buf.toString(), function(err) {
            if(err) {
                return console.log(err);
            }
        });
        console.log(JSON.parse(buf.toString()));
    });
}
var options = {
    port: 8081,
    method: 'POST',
    path: '/webrtc/debug',
}

var req = http.request(options, callback);
req.write(JSON.stringify({
    'debug': 'test'
}));
req.end();