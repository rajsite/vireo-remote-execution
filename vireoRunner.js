/*jshint esnext: true*/
'use strict';

// load an XMLHTTPRequest implementation into the global scope
// this allows Vireo to make network requests in the node environment
// optional if the WebVI does not utilize the HTTP gvis
global.XMLHttpRequest = require('xhr2').XMLHttpRequest;

// Use pronounceable url example from jsbin http://jsbin.com/help/pronounceable-urls
var pronounceableId = function (length) {
    var vowels = 'aeiou', consonants = 'bcdfghjklmnpqrstvwxyz', word = '', index = 0, set;
    for (; index < length; index += 1) {
        set = (index % 2 === 0) ? consonants : vowels;
        word += set[Math.floor(Math.random() * set.length)];
    }
    return word;
};

// load the Vireo Constructor Function
var Vireo = require('vireo');

// TODO this has gotten state machiney enough to bring in a library like machina or stately
var VIREO_STATES = Object.freeze({
    // Vireo and the viaCode are loaded in memory, but no control terminals
    // A VI must be queued once before running or writing to controls
    // Currently we enqueue on construction, so externally Vireo should not be in this state
    PREQUEUED: 'PREQUEUED',

    // Vireo has a queued VI. Can write to controls or run
    QUEUED: 'QUEUED',

    // Vireo is running. Can write to controls or run
    RUNNING: 'RUNNING',

    // Vireo has been aborted while running. Cannot queue and continue running.
    ABORTED: 'ABORTED',

    // Vireo, viacode, and controls are loaded in memory.
    // Usually means the VI has run to completion at least once.
    UNQUEUED: 'UNQUEUED',

    // Some fatal error occurred and vireo is in an unrecoverable state. Cannot queue and continue running.
    ERROR: 'ERROR'
});

var instances = new Map();

class VireoRunner {
    constructor (viaCodeWithEnqueue) {
        var enqueueRegex = /^enqueue\s*\((\S*)\)$/m;
        var viaCode = viaCodeWithEnqueue.replace(enqueueRegex, "");
        var enqueueMatch = viaCodeWithEnqueue.match(enqueueRegex);
        this.viaEnqueueCommand = enqueueMatch[0];
        this.viName = enqueueMatch[1];
        this.vireo = new Vireo();
        this.instanceId = pronounceableId(8);

        // register some logging functions (only used for debugging)
        // TODO should check for errors in output when doing loadVia
        this._printLog = [];
        this._printErrorLog = [];

        // TODO limit cache size
        this.vireo.eggShell.setPrintFunction(message => {
            console.log('[Vireo instance ' + this.instanceId + ']:', message);
            this._printLog.push(message)
        });
        this.vireo.eggShell.setPrintErrorFunction(message => {
            console.error('[Vireo instance ' + this.instanceId + ']:', message);
            this._printErrorLog.push(message)
        });

        this.vireo.eggShell.loadVia(viaCode);
        this.state = VIREO_STATES.PREQUEUED;
        this.timer = undefined;

        this._queueIfEmptyQueue();
        if (instances.has(this.instanceId)) {
            throw new Error('Randomly generated instance name collision');
        }

        instances.set(this.instanceId, this);
    }

    _queueIfEmptyQueue () {
        if (this.state !== VIREO_STATES.PREQUEUED && this.state !== VIREO_STATES.UNQUEUED) {
            return;
        }

        this.vireo.eggShell.loadVia(this.viaEnqueueCommand);
        this.state = VIREO_STATES.QUEUED;
    }

    _cleanup () {
        if (this.timer !== undefined) {
            clearImmediate(this.timer);
            this.timer = undefined;
        }

        // TODO perform vireo clean-up like aborting running http requests
    }

    _runExecuteSlicesAsync () {
        if (this.state !== VIREO_STATES.RUNNING) {
            throw new Error('Vireo is unable to continue running, currently in state: ' + this.state);
        }

        var vireoStatus;
        try {
            vireoStatus = this.vireo.eggShell.executeSlices(1000);
        } catch (e) {
            this._cleanup();
            this.state = VIREO_STATES.ERROR;
            throw new Error('Vireo failed to run', e);
        }

        if (vireoStatus > 0) {
            this.timer = setImmediate(() => this._runExecuteSlicesAsync());
        } else {
            this.timer = undefined;
            this.state = VIREO_STATES.UNQUEUED;
        }
    }

    run () {
        this._queueIfEmptyQueue();

        if (this.state !== VIREO_STATES.QUEUED) {
            throw new Error('Vireo is unable to start running, currently in state: ' + this.state);
        }

        this.state = VIREO_STATES.RUNNING;
        this.timer = setImmediate(() => this._runExecuteSlicesAsync());
    }

    abort () {
        if (this.state !== VIREO_STATES.RUNNING) {
            throw new Error('Vireo can only abort a running VI, currently in state: ' + this.state);
        }

        this._cleanup();
        this.state = VIREO_STATES.ABORTED;
    }

    get printLog () {
        return this._printLog.join('\n');
    }

    get printErrorLog () {
        return this._printErrorLog.join('\n');
    }

    getAllControls () {
        return JSON.parse(this.vireo.eggShell.readJSON(this.viName, ''));
    }
}

VireoRunner.VIREO_STATES = VIREO_STATES;
VireoRunner.getVireoRunner = function (instanceId) {
    return instances.get(instanceId);
};
VireoRunner.deleteVireoRunner = function (instanceId) {
    var vireoRunner = instances.get(instanceId);
    if (vireoRunner !== undefined && vireoRunner.state === VIREO_STATES.RUNNING) {
        vireoRunner.abort();
    }
    return instances.delete(instanceId);
};

module.exports = VireoRunner;
