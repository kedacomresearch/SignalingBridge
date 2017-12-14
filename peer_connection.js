/**
 * Created by Gan on 2017/11/14.
 */
const EventEmitter = require('events').EventEmitter;

const STATUS = {
    connecting: 'connecting',
    connected: 'connected',
    disconnected: 'disconnected'
};

const groupDefault = 'default';

class Endpoint {
    constructor(type) {
        this._type = type;
        this._status = STATUS.disconnected;
        this._subscribers = {
            statusSubscribers: new Map(),
            sdpSubscribers: new Map(),
            statisticsSubscribers: new Map(),
            connectionSubscribers: new Map()
        };
        this._storedMsgs = {
            statusMsgs: [],
            sdpMsgs: [],
            statisticsMsgs: [],
            connectionMsgs: []
        };
    }

    getSubscribers(topic) {
        return this._subscribers[`${topic}Subscribers`];
    }

    get status() {
        return this._status;
    }

    set status(val) {
        if(STATUS[val] && this._status !== STATUS.connected) {
            this._status = STATUS[val];
        } else {
            console.log(`Endpoint set status ${val} error!`);
        }
    }

    addSubscriber(topics, subscriber) {
        let topic, num = topics.length;

        for(let i = 0; i < num; ++i) {
            topic = topics[i];
            if(this._subscribers[`${topic}Subscribers`]) {
                this._subscribers[`${topic}Subscribers`].set(subscriber.name, subscriber)
            } else {
                console.log(`${subscriber} subscribe topic ${topic} error!`);
            }
        }
    }

    removeSubscriber(topics, subscriber) {
        let topic, num = topics.length;

        for(let i = 0; i < num; ++i) {
            topic = topics[i];
            if(this._subscribers[`${topic}Subscribers`]) {
                this._subscribers[`${topic}Subscribers`].delete(subscriber.name)
            } else {
                console.log(`Remove subscriber error, topic ${topic} `);
            }
        }
    }

    storeMsg(topic, data) {
        if(this._storedMsgs[`${topic}Msgs`]) {
            this._storedMsgs[`${topic}Msgs`].push(data);
        } else {
            console.log(`stroe msgs from topic: ${topic} error`);
        }
    }

    getStoreMsg(topic) {
        if(this._storedMsgs[`${topic}Msgs`]) {
            return this._storedMsgs[`${topic}Msgs`];
        }
        return null;
    }

    close() {
        this._status = STATUS.disconnected;
        this._subscribers.statusSubscribers.clear();
        this._subscribers.sdpSubscribers.clear();
        this._subscribers.statisticsSubscribers.clear();
        this._subscribers = null;
        this._storedMsgs = null;
    }
}

let global_seq = 1;
const CRLF = '\r\n';
const OFFERER = 'offerer',
    ANSWERER = 'answerer';

class PeerConnection extends EventEmitter {
    constructor(groupId, connectionId, timeout) {
        super();
        this._endpoints = {
            offerer: new Endpoint(OFFERER),
            answerer: new Endpoint(ANSWERER)
        };
        this._connection_id = connectionId;
        this._group_id = groupId;
        this._timeout = typeof timeout === 'number' ? timeout : 60 * 1000;
        this._handler = setTimeout(() => {
            if(!this.connected) {
                this.emit('timeout', this._group_id, this._connection_id);
            }
        }, this._timeout);
    }

    setStatus(val, type) {
        if(this._endpoints[type]) {
            this._endpoints[type].status = val;
        } else {
            console.log(`Set status error! ${type}`);
            return false;
        }
        if(this.connected) {
            clearTimeout(this._handler);
            this._handler = null;
        }
        return true;
    }

    get connectionId () {
        return this._connection_id;
    }

    get groupId() {
        return this._group_id;
    }

    get connected() {
        if(this._endpoints.offerer.status === STATUS.connected && this._endpoints.answerer.status === STATUS.connected) {
            return true;
        }
        return false;
    }

    addSubscriber(topics, subscriber, type) {
        if(this._endpoints[type]) {
            this._endpoints[type].addSubscriber(topics, subscriber);
            this.getStoredMsgNotified(topics, subscriber, type);
            return true;
        }
        else {
            console.log(`add subscriber error! ${type}`);
            return false;
        }
    }

    static pushNotification(subscriber, data) {
        if(subscriber.type === 'http') {
            subscriber.notifyCb(subscriber.notifyAddr, data);
        }

        if(subscriber.type === 'websocket') {
            let notification = 'request:' + (global_seq++) + CRLF +
                'method:PUT' + CRLF +
                'path:/webrtc/notification' + CRLF +
                CRLF + data;
            subscriber.socket.send(notification);
        }
    }

    onPushMsg(topicMsgs, type) {
        let topicMsg,
            topicSubscribers;

        for(let topic in topicMsgs) {
            if(topicMsgs.hasOwnProperty(topic)) {
                topicMsg = topicMsgs[topic];
                if(topic === 'status') {
                    this.setStatus(topicMsg, type);
                }
                topicSubscribers = this._endpoints[type].getSubscribers(topic);
                if(topicSubscribers.size === 0) {
                    this.storeMsg(topic, type, topicMsg)
                } else {
                    let data, message = Object.create(null);

                    message[topic] = topicMsg;
                    data = {
                        endpoint : {
                            type : type,
                            connection : this._connection_id.toString(),
                            group : this._group_id === groupDefault ? '' : this._group_id.toString()
                        },
                        message : message
                    };
                    for (let subscriber of topicSubscribers.values()) {
                        PeerConnection.pushNotification(subscriber, JSON.stringify(data));
                    }
                }
            }
        }
    }

    getStoredMsgNotified(topics, subscriber, type) {
        let topic, storedMsgFromSpecificType;
        let data;

        for(let i = 0; i < topics.length; ++i) {
            topic = topics[i];
            storedMsgFromSpecificType = this._endpoints[type].getStoreMsg(topic);
            let msg, message = Object.create(null);

            while(msg = storedMsgFromSpecificType.shift()) {
                Reflect.set(message, topic, msg);

                data = {
                    endpoint : {
                        type : type,
                        connection : this._connection_id.toString(),
                        group : this._group_id === groupDefault ? '' : this._group_id.toString()
                    },
                    message : message
                };

                PeerConnection.pushNotification(subscriber, JSON.stringify(data));
            }
        }
    }

    removeSubscriber(topics, subscriber, type) {
        if(this._endpoints[type]) {
            this._endpoints[type].removeSubscriber(topics, subscriber);
            return true;
        } else {
            console.log(`remove subscriber error! ${type}`);
            return false;
        }
    }

    storeMsg(topic, type, data) {
        if(this._endpoints[type]) {
            if(!this.connected) {
                this._endpoints[type].storeMsg(topic, data);
                return true;
            }
        } else {
            console.log(`store msg error! ${type}`);
            return false;
        }
    }

    close() {
        if(this._handler) {
            clearTimeout(this._handler);
        }
        this.onConnectionClosed();
        this._endpoints.offerer.close();
        this._endpoints.answerer.close();
        this._endpoints = null;
    }

    onConnectionClosed() {
        let connectionSubscribers = this._endpoints.offerer.getSubscribers('connection'),
            data;
        for(let subscriber of connectionSubscribers.values()) {
            data = {
                endpoint : {
                    type : OFFERER,
                    connection : this._connection_id.toString(),
                    group : this._group_id === groupDefault ? '' : this._group_id.toString()
                },
                message : {
                    connection: 'connection closed'
                }
            };
            PeerConnection.pushNotification(subscriber, JSON.stringify(data));
        }
    }
}

module.exports = PeerConnection;