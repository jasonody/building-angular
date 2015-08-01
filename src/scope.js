'use strict';

function initWatchValue() { }

function Scope() {
	
	this.$$watchers = [];
}

Scope.prototype.$watch = function (watchFn, listenerFn) {
	
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function () { },
		last: initWatchValue
	};
	
	this.$$watchers.push(watcher);
};

Scope.prototype.$$digestOnce = function () {
	
	var self = this;
	var newValue, oldValue, dirty;
	
	this.$$watchers.forEach(function (watcher) {
		
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;

		if (newValue !== oldValue) {
			watcher.last = newValue;
			watcher.listenerFn(newValue, 
												 (oldValue === initWatchValue ? newValue : oldValue), 
												 self);
			dirty = true;
		}
	});
	
	return dirty;
};

Scope.prototype.$digest = function () {
	
	var dirty;
	
	do {
		
		dirty = this.$$digestOnce();
	} while (dirty);
};