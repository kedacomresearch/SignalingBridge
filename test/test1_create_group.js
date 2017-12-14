'use strict'
const chai = require('chai');
const should = chai.should;
const expect = chai.expect;

/*
create peer connection 'MIX'

create group 'Apple'

create connection 'IPX' in group 'Apple'
create connection 'IP8' in group 'Apple'

*/

const WebSocket = require('ws');

const CRLF = '\r\n';

var msgs = []
var j = {};
j['connection'] = 'MIX';
var data = JSON.stringify(j);
var msg = 'request:11' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/peerconnection' + CRLF +
    CRLF + data;
msgs.push(msg);

j = {};
j['group'] = 'Apple';
var data = JSON.stringify(j);
var msg = 'request: 12 ' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/group' + CRLF +
    CRLF + data;
msgs.push(msg);

j = {};
j['group'] = 'Apple';
j['connection'] = 'IPX';
var data = JSON.stringify(j);
var msg = 'request:13 ' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/peerconnection' + CRLF +
    CRLF + data;
msgs.push(msg);

j = {};
j['group'] = 'Apple';
j['connection'] = 'IP8';
var data = JSON.stringify(j);
var msg = 'request:14 ' + CRLF +
    'method:POST' + CRLF +
    'path:/webrtc/peerconnection' + CRLF +
    CRLF + data;
msgs.push(msg);
/////////////////////////////////////////////////////////////////////
var count = 0;
var ws;
describe('signal bridge test1', function () {
    before(function () {
        ws = new WebSocket('ws://localhost:8181/test1');
    })
    it('create peer connection and group', function (done) {
        ws.on('open', function open() {
            msgs.forEach(function (data) {
                ws.send(data);
                count++;
            });
        });

        ws.on('message', function (data) {
            console.log(data.toString() + '\n');
            expect(data.toString().indexOf('200')).to.be.not.equal(-1);
            count--;
            if (count == 0) {
                done();
            }
        });
    })
});