'use strict'
const chai = require('chai');
const should = chai.should;
const expect = chai.expect;

/*
subscribe peer connection 'MIX' 'offerer' 'sdp' status'

subscribe group 'Apple' all connection all type 'sdp'

subscribe connection 'IPX' in group 'Apple' 'offerer' 'statistics'

*/

const WebSocket = require('ws');

const CRLF = '\r\n';
// var suber = "http://127.0.0.1:80";
var suber = "test3";

var msgs = []
var j = {};
j['endpoint'] = [{
    "type": "offerer",
    "connection": "MIX",
    "topic": ["sdp", "status"]
}];
j["notify_addr"] = suber;
var data = JSON.stringify(j);
var msg = 'request:21 ' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/subscription' + CRLF +
    CRLF + data;
msgs.push(msg);
/*-------------------------------------------------------*/
j = {};
j['endpoint'] = [{
    "type": "offerer",
    "connection": "IPX",
    "group": "Apple",
    "topic": ["statistics"]
}];
j["notify_addr"] = suber;
var data = JSON.stringify(j);
var msg = 'request:22 ' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/subscription' + CRLF +
    CRLF + data;
msgs.push(msg);
/*-------------------------------------------------------*/

j = {};
j['endpoint'] = [{
    "type": "offerer",
    "group": "Apple",
    "topic": ["sdp"]
}];
j["notify_addr"] = suber;
var data = JSON.stringify(j);
var msg = 'request:23 ' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/subscription' + CRLF +
    CRLF + data;
msgs.push(msg);
/*-------------------------------------------------------*/

j = {};
j['endpoint'] = [{
    "type": "offerer",
    "connection": "MIX",
    "topic": ["sdp", "status"]
}];
j["notify_addr"] = suber;
var data = JSON.stringify(j);
var msg = 'request:24 ' + CRLF +
    'method:DELETE' + CRLF +
    'path:/webrtc/subscription' + CRLF +
    CRLF + data;
// msgs.push(msg);
/////////////////////////////////////////////////////////////////////
var count = 0;
var ws;
describe('signal bridge test2', function () {
    before(function () {
        ws = new WebSocket('ws://localhost:8181/test3');
    })
    it('subscribe topics', function (done) {
        ws.on('open', function open() {
            msgs.forEach(function (data) {
                ws.send(data);
                count++;
            });
        });

        ws.on('message', function (data) {
            if (data.toString().indexOf('request') != -1) {
                console.log(data.toString());
            } else
                console.log(data.toString() + '\n');
            if (data.toString().indexOf('200') != -1) {
                count--;
                if (count == 0) {
                    done();
                }
            }
        });
    })
});