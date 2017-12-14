'use strict'
const chai = require('chai');
const should = chai.should;
const expect = chai.expect;

/*
destory peer connection 'MIX'

destory connection 'IPX' in group 'Apple'

destory group 'Apple'

*/

const WebSocket = require('ws');


const CRLF = '\r\n';

var msgs = []
var j = {};
j['connection'] = 'MIX';
var data = JSON.stringify(j);
var msg = 'request:81 ' + CRLF +
    'method:DELETE ' + CRLF +
    'path:/webrtc/peerconnection' + CRLF +
    CRLF + data;
msgs.push(msg);

j = {};
j['group'] = 'Apple';
j['connection'] = 'IPX';
var data = JSON.stringify(j);
var msg = 'request:82 ' + CRLF +
    'method:DELETE ' + CRLF +
    'path:/webrtc/peerconnection' + CRLF +
    CRLF + data;
msgs.push(msg);

j = {};
j['group'] = 'Apple';
var data = JSON.stringify(j);
var msg = 'request:83 ' + CRLF +
    'method:DELETE ' + CRLF +
    'path:/webrtc/group' + CRLF +
    CRLF + data;
msgs.push(msg);

/////////////////////////////////////////////////////////////////////
var count = 0;
var ws;
describe('signal bridge test4', function () {
    before(function () {
        ws = new WebSocket('ws://localhost:8181/test4');
    })
    it('destory peer connection and group', function (done) {
        ws.on('open', function open() {
            msgs.forEach(function (data) {
                ws.send(data);
                count++;
            });
        });

        ws.on('message', function (data) {
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