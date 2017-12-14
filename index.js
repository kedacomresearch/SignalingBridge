const ws = require('ws');
const http = require('http');
const STATUS_CODES = require('./status_code.js').STATUS_CODES;
const groupManager = require('./group_manager');

const https = require('https');
const fs = require("fs");

const privateKey = fs.readFileSync('./sslfiles/private.pem', 'utf8');
const certificate = fs.readFileSync('./sslfiles/file.crt', 'utf8');
const credentials = {
    key: privateKey,
    cert: certificate
};

/*----------------------util-----------------------*/
const colors = require('colors');

const CRLF = '\r\n';
const pingInterval = 60000;

function trace(arg) {
    console.log(arg.gray + '\n');
}

function error(arg) {
    console.log(arg.red + '\n');
}

function info(arg) {
    console.log(arg.green + '\n');
}

function send(res, status_code, content) {
    if (res.type === 'ws') {
        let msg = 'response:' + res.cseq + CRLF +
            'status_code:' + status_code + CRLF +
            'description:' + STATUS_CODES[status_code] + CRLF +
            CRLF + content;

        res.ws.send(msg);
    } else {
        res.writeHead(status_code, {
            "Content-Type": "application/octet-stream",
            "Connection": "Keep-Alive"
        });
        res.write(content);
        res.end();
    }
    info(content);
}

function parse_msg(ws_data) {
    let index = ws_data.indexOf(`${CRLF}${CRLF}`),
        body = ws_data.slice(index + CRLF.length*2);

    if (index === -1) {
        error('invalid websocket msg! no \r\n!');
        return null;
    }
    let headersString = ws_data.slice(0, index + CRLF.length),
        header = Object.create(null),
        start = 0;

    while (true) {
        let pos = headersString.indexOf(CRLF, start);

        if (pos === -1) {
            break;
        }
        let line = headersString.slice(start, pos);

        start = pos + CRLF.length;

        let arr = line.split(':'),
            key = arr[0].trim(),
            value = arr[1].trim();

        switch (key) {
            case 'request':
            case 'response':
            case 'status_code':
                {
                    header[key] = Number.parseInt(value);
                    break;
                }
            case 'method':
                {
                    header.method = value;
                    break;
                }
            case 'path':
                {
                    header.url = value;
                    break;
                }
        }
    }

    if (!header.request && !header.response) {
        error('invalid websocket msg! no seq id!');
        return null;
    }

    return {
        header : header,
        body : body
    };
}

function onWsMessage(data) {
    let chunk;

    if (typeof data !== 'string') {
        chunk = data.toString();
    } else {
        chunk = data;
    }

    let parser = parse_msg.call(null, chunk),
        res = {
            type : 'ws',
            ws : this,
            cseq : 0
        };

    if (!parser) {
        send(res, 400, 'invalid websocket msg!');
        return;
    }

    if (parser.header.request) {
        if (!parser.header.url) {
            send(res, 400, 'invalid websocket msg! without path!');
            return;
        }
        if (!parser.header.method) {
            send(res, 400, 'invalid websocket msg! without method!');
            return;
        }
        res.cseq = parser.header.request;
        parser.header.wsName = this.name;
        OnMessage(parser.body, parser.header, res);
    }
}

function OnHttpRequest(req, res) {
    let chunk = [];

    req.on('data', function (data) {
        chunk.push(data);
    });

    req.on('end', function () {
        let buf = Buffer.concat(chunk);

        OnMessage(buf, req, res);
    })
}

/*--------------------------http server---------------------*/

const httpServer = http.createServer(OnHttpRequest).listen(8181);

let insecureWss = new ws.Server({
    server : httpServer
});

insecureWss.on('connection', onWsConnection);

/*--------------------------httpws server---------------------*/
const httpsServer = https.createServer(credentials, OnHttpRequest).listen(8383);

let secureWss = new ws.Server({
    server : httpsServer
});

secureWss.on('connection', onWsConnection);

function heartbeat() {
    trace(`${this.name} heartbeat`);
    this.isAlive = true;
}

function onWsConnection(ws, request) {
    let name = request.url.slice(1);

    if(!name || !groupManager.addWs(name, ws)) {
        info('connection repeted at: ' + request.url);
        ws.close(1001, `${request.url} connection repeated`);
        return;
    }
    ws.isAlive = true;
    ws.name = name;
    ws.on('pong', heartbeat);
    ws.on('message', onWsMessage);
    ws.on('close', function (code, message) {
        trace(`Client ${this.name} closed!`);
        groupManager.onWsClose(this.name);
    });
}

setInterval(function ping() {
    secureWss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping('', false, true);
    });

    insecureWss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping('', false, true);
    });
}, pingInterval);

//////////////////////////////////////////////////////////////////////////////

const groupDefault = 'default';

/*----------------------message entry-------------------------*/

function OnMessage(data, req, res) {
    if (req.headers) {
        trace(JSON.stringify(req.headers));
    }

    let dataStr;

    if (typeof data !== 'string') {
        dataStr = data.toString();
    } else {
        dataStr = data;
    }
    trace(dataStr);

    let dataObj = JSON.parse(dataStr);

    if (dataObj === undefined) {
        send(res, 400, 'Invalid parameters! Can\'t parse!');
        return;
    }

    let path = req.url;

    switch (path) {
        case '/webrtc/peerconnection':
            OnPeerConnection(dataObj, req, res);
            break;
        case '/webrtc/group':
            OnGroup(dataObj, req, res);
            break;
        case '/webrtc/subscription':
            OnSubscribe(dataObj, req, res);
            break;
        case '/webrtc/push':
            OnPush(dataObj, req, res);
            break;
        default:
            send(res, 404, 'API Not found!');
            break;
    }
}
/*-----------------------------------------------*/

/*---------------------detail processing--------------------------*/
/////////////////////////////////////////////////////////////////////
//create and destroy peer connection
function OnPeerConnection(dataObj, req, res) {
    let method = req.method;

    if (method === 'POST') {
        let ret = groupManager.addConnection(dataObj.connection, dataObj.group, dataObj.timeout);

        if(!ret) {
            send(res, 400, `Invalid parameters ${JSON.stringify(dataObj)}, OnAddConnection !`);
            return;
        }
        send(res, 200, `Peer connnection ${dataObj.connection} created Successfully!`);
        return;
    }

    if (method === 'DELETE') {

        let ret = groupManager.deleteConnection(dataObj.connection, dataObj.group);

        if(!ret) {
            send(res, 400, `Invalid parameters ${JSON.stringify(dataObj)}, OnDeleteConnection !`);
            return;
        }
        send(res, 200, `The connection ${dataObj.connection} was destroyed!`);
    }
}

//create  and destroy group
function OnGroup(dataObj, req, res) {
    let method = req.method;

    if (method === 'POST') {
        let ret = groupManager.addGroup(dataObj.group, dataObj.timeout);

        if(!ret) {
            send(res, 400, `Invalid parameters ${JSON.stringify(dataObj)}! onAddGroup!`);
            return;
        }
        send(res, 200, `Create group ${dataObj.group} successfully!`);
        return;
    }

    if (method === 'DELETE') {
        let ret = groupManager.deleteGroup(dataObj.group);

        if(!ret) {
            send(res, 400, `Invalid parameters ${JSON.stringify(dataObj)}! onDeleteGroup!`);
            return;
        }
        send(res, 200, `Destroy the group ${dataObj.group} successfully`);
    }
}

/////////////////////////////////////////////////////////////////////
//subscribe and unsubscribe topic
function OnSubscribe(dataObj, req, res) {
    let method = req.method;

    if (method === 'POST' || method === 'DELETE') {
        SubTopic(method, dataObj, req, res);
    } else {
        send(res, 400, 'Request not supported!');
    }
}

function getSubscriber(notifyAddr) {
    let subscriber = Object.create(null);
    if(notifyAddr.indexOf('http://') !== -1) {
        subscriber.type = 'http';
        subscriber.notifyCb = _http_request;
        subscriber.notifyAddr = notifyAddr;
        subscriber.name = notifyAddr;
    } else {
        let ws = groupManager.getWs(notifyAddr);
        subscriber.type = 'websocket';
        subscriber.socket = ws;
        subscriber.name = ws.name;
    }
    return subscriber;
}

//detail processing sub and unsub topic
function SubTopic(method, dataObj, req, res) {

    if (!dataObj.endpoint || !(dataObj.endpoint instanceof Array)) {
        send(res, 400, `Invalid parameters ${JSON.stringify(dataObj)}!`);
        return;
    }

    let endpoint;

    for (let i = 0; i < dataObj.endpoint.length; ++i) {
        endpoint = dataObj.endpoint[i];

        let group_id,
            subscriber = getSubscriber(dataObj.notify_addr);

        if (!endpoint.connection && endpoint.group) {
            //all connection in group
            group_id = endpoint.group;

            let peerConnectionSet = groupManager.getGroup(group_id);

            for (let connection_id in peerConnectionSet) {
                if (connection_id === 'timeout')
                    continue;
                let rc = _subTopic(method, group_id, connection_id, endpoint.topic, subscriber, endpoint.type, req);

                if (!rc) {
                    send(res, 400, `Invalid parameters: ${JSON.stringify(dataObj)} onSubscribeTopic!`);
                    return;
                }
            }
        } else {
            group_id = endpoint.group;
            let connection_id = endpoint.connection;

            let rc = _subTopic(method, group_id, connection_id, endpoint.topic, subscriber, endpoint.type,req);
            if (!rc) {
                send(res, 400, `Invalid parameters: ${JSON.stringify(dataObj)} onSubscribeTopic!`);
                return;
            }
        }
    }

    if (method === 'POST') {
        send(res, 200, 'Successfully add subscribers!');
    } else {
        send(res, 200, 'Successfully remove subscribers!');
    }
}
//detail processing sub and unsub topic
function _subTopic(method, group_id, connection_id, topics, subscriber, type, req) {
    let peerConnection = groupManager.getConnection(connection_id, group_id);

    if(! peerConnection) {
        return false;
    }

    let rc;

    if(method.toUpperCase() === 'POST') {
        req && req.wsName && groupManager.setWsPeerconnection(req.wsName, connection_id, group_id);
        rc = peerConnection.addSubscriber(topics, subscriber, type);
    }
    if(method.toUpperCase() === 'DELETE') {
        rc = peerConnection.removeSubscriber(topics, subscriber, type);
    }
    if (!rc) {
        return false;
    }
    return true;
}

////////////////////////////////////////////////////////////////////
//push messages
function OnPush(dataObj, req, res) {
    if (req.method !== 'PUT') {
        send(res, 501, 'Method not implemented!');
        return;
    }

    let endpoint = dataObj.endpoint,
        group_id = endpoint.group || groupDefault;
    let connection_id = endpoint.connection,
        peerConnection = groupManager.getConnection(connection_id, group_id);

    if (!peerConnection) {
        send(res, 400, 'The connection is not established!');
        return;
    }
    peerConnection.onPushMsg(dataObj.message, endpoint.type);

    send(res, 200, 'Push message successfully!');
}

let callback = function (response) {
    // var chunk = [];
    // response.on('data', function (data) {
    //     chunk.push(data);
    // });
    // response.on('end', function () {
    //     var buf = Buffer.concat(chunk);
    // });
};

function _http_request(url, data) {
    let dest_host, dest_port;
    let start = url.indexOf('http://');
    let host = url.slice(start + 7);
    let index = host.indexOf(':');
    if (index === -1) {
        dest_port = 80;
        dest_host = host;
    } else {
        dest_port = host.slice(index + 1);
        dest_host = host.slice(0, index);

    }
    let options = {
        host: dest_host,
        port: dest_port,
        method: 'PUT',
        path: '/webrtc/notification',
        // timeout: 5000,
        headers: {
            "Content-Length": data.length
        }
    };
    let req = http.request(options, callback, 'server');
    req.setTimeout(5000, () => {
        req.abort();
    });
    req.on('error', (err) => {});
    req.write(data);
    req.end();
}