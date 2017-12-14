/**
 * Created by GanChao on 2017/11/28.
 */

const PeerConnection = require('./peer_connection');
const axios = require('axios');
const groupDefault = 'default';

class GroupManager {
    constructor() {
        this._groupSet = Object.create(null);
        this._groupSet[groupDefault] = Object.create(null);
    }

    addGroup(groupId, timeout = 5 * 60 * 1000) {
        groupId = groupId || groupDefault;
        if(this._groupSet[groupId]) {
            return false;
        }
        this._groupSet[groupId] = Object.create(null);
/*        let handler = setTimeout(function (group) {
            return function () {
                delete group_manager[group];
                info('the group ' + group + ' destoryed!');
            }
        }(group_id), timeout);
        this._groupSet[groupId]['timeout'] = handler;*/
        return true;
    }

    deleteGroup(groupId) {
        groupId = groupId || groupDefault;
        let connectionSet = this._groupSet[groupId];

        if(connectionSet) {
            for(let connectionId in connectionSet) {
                this.deleteConnection(connectionId, groupId);
            }
            let handler = this._groupSet[groupId]['timeout'];
            clearTimeout(handler);
            delete this._groupSet[groupId];
            console.log(`delete group ${groupId}`);
            return true;
        } else {
            return false;
        }
    }

    addConnection(connectionId, groupId, timeout = 30 * 1000) {
        groupId = groupId || groupDefault;
        let connectionSet = this._groupSet[groupId];

        if(!connectionId || !connectionSet || connectionSet[connectionId]){
            return false;
        } else {
            connectionSet[connectionId] = new PeerConnection(groupId, connectionId, timeout);

/*            if(!connectionSet['timeout']) {
                connectionSet[connectionId].on('timeout', (groupId, connectionId) => {
                    if (groupId === groupDefault) {
                        this.deleteConnection(connectionId, groupId);
                        console.log(`The conncetion ${connectionId} has been destoryed! It hasn\'t changed to \'connected\' in time!`);
                    }
                });
            }*/
            return true;
        }
    }

    deleteConnection(connectionId, groupId) {
        groupId = groupId || groupDefault;
        let connectionSet = this._groupSet[groupId];

        if(!connectionId || !connectionSet || !connectionSet[connectionId]) {
            return false
        } else {
            connectionSet[connectionId].close();
            delete connectionSet[connectionId];
            return true;
        }
    }

    getConnection(connectionId, groupId) {
        groupId = groupId || groupDefault;
        return this._groupSet[groupId][connectionId]
    }

    getGroup(groupId) {
        groupId = groupId || groupDefault;
        return this._groupSet[groupId];
    }

    addWs(name,ws) {
        if(GroupManager.wsPeerconnectionHolder.has(name)) {
            return false;
        }
        GroupManager.wsPeerconnectionHolder.set(name, {
            ws: ws,
            connectionId: null,
            groupId: null
        });
        return true;
    }

    getWs(name) {
        if(GroupManager.wsPeerconnectionHolder.get(name)) {
            return GroupManager.wsPeerconnectionHolder.get(name).ws;
        } else {
            return null;
        }
    }

    setWsPeerconnection(name, connectionId, groupId) {
        if(GroupManager.wsPeerconnectionHolder.has(name) && !GroupManager.wsPeerconnectionHolder.get(name).connectionId) {
            GroupManager.wsPeerconnectionHolder.get(name).connectionId = connectionId;
            GroupManager.wsPeerconnectionHolder.get(name).groupId = groupId;
        }
    }

    onWsClose(name) {
        if(GroupManager.wsPeerconnectionHolder.has(name)) {
            let wsPeerConnection = GroupManager.wsPeerconnectionHolder.get(name),
                groupId = wsPeerConnection.groupId,
                connectionId = wsPeerConnection.connectionId;
            GroupManager.wsPeerconnectionHolder.delete(name);
            return this.deleteConnection(connectionId, groupId);
        } else {
            return false;
        }
    }
}

GroupManager.wsPeerconnectionHolder = new Map();

module.exports = new GroupManager();