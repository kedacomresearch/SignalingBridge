'use strict'
const chai = require('chai');
const should = chai.should;
const expect = chai.expect;
const colors = require('colors');

function trace(arg) {
    console.log(arg.gray);
}

/*
push peer connection 'MIX' 'offerer' 

create group 'Apple'

create connection 'IPX' in group 'Apple'
create connection 'IP8' in group 'Apple'

*/

const WebSocket = require('ws');

const CRLF = '\r\n';

var msgs = []
var j = {};
j['endpoint'] = {
    "type": "offerer",
    "connection": "MIX"
};
j['message'] = {
    'sdp': '~~~~~~~~~hello world~~~~~~~~~~~',
    'status': 'connecting'
}
var data = JSON.stringify(j);
var msg = 'request:31 ' + CRLF +
    'method:PUT' + CRLF +
    'path:/webrtc/push' + CRLF +
    CRLF + data;
msgs.push(msg);

j['endpoint'] = {
    "type": "answerer",
    "connection": "IPX",
    "group": "Apple"
};
j['message'] = {
    'sdp': '~~~~~~~~~hello world IPX~~~~~~~~~~~'
}
var data = JSON.stringify(j);
var msg = 'request:32 ' + CRLF +
    'method:PUT' + CRLF +
    'path:/webrtc/push' + CRLF +
    CRLF + data;
msgs.push(msg);


/////////////////////////////////////////////////////////////////////
var count = 0;
var ws;
describe('signal bridge test3', function () {
    before(function () {
        ws = new WebSocket('ws://localhost:8181/test2');
    })
    it('push msgs', function (done) {
        ws.on('open', function open() {
            msgs.forEach(function (data) {
                ws.send(data);
                count++;
            });
        });

        ws.on('message', function (data) {
            if (data.toString().indexOf('request') != -1) {
                trace(data.toString());
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