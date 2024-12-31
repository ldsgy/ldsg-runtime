import { EventEmitter } from 'node:events';

class SwimlaneEmitter extends EventEmitter {}

export const swimlaneEmitter = new SwimlaneEmitter();

swimlaneEmitter.setMaxListeners(10);

class SwimlaneProcessReadyEmitter extends EventEmitter {}

export const swimlaneProcessReadyEmitter = new SwimlaneProcessReadyEmitter();

swimlaneProcessReadyEmitter.setMaxListeners(10);
