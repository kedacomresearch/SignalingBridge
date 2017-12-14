require('http').createServer(function (req, res) {
    req.on('data', function (data) {
        console.log(JSON.parse(data.toString()));
    });
    req.on('end', function () {})
}).listen(80);